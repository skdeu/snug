use std::collections::HashSet;
use std::fs;
use std::path::{Component, Path, PathBuf};

use tauri::Manager;

#[tauri::command]
pub fn read_markdown(path: String) -> Result<String, String> {
    let file = Path::new(&path);
    if !file.exists() {
        return Err(format!("File not found: {path}"));
    }
    let bytes = fs::read(file).map_err(|error| format!("Could not read file: {error}"))?;
    String::from_utf8(bytes)
        .map(|text| text.trim_start_matches('\u{FEFF}').to_string())
        .map_err(|error| format!("File is not valid UTF-8: {error}"))
}

#[tauri::command]
pub fn write_markdown(path: String, contents: String) -> Result<(), String> {
    fs::write(&path, contents).map_err(|error| format!("Could not save file: {error}"))
}

#[tauri::command]
pub fn list_markdown_files(folder: String) -> Result<Vec<String>, String> {
    let root = fs::canonicalize(&folder)
        .map_err(|error| format!("Could not open folder {folder}: {error}"))?;

    const JUNK: [&str; 6] = [".git", "node_modules", "dist", "bin", "obj", ".superpowers"];
    let mut stack = vec![root.clone()];
    let mut visited = HashSet::new();
    visited.insert(root.clone());
    let mut found = Vec::new();

    while let Some(directory) = stack.pop() {
        let entries = fs::read_dir(&directory)
            .map_err(|error| format!("Could not list folder: {error}"))?;
        for entry in entries.flatten() {
            let path = entry.path();
            let name = entry.file_name().to_string_lossy().into_owned();
            if path.is_dir() {
                if JUNK.contains(&name.as_str()) {
                    continue;
                }
                let canonical = match fs::canonicalize(&path) {
                    Ok(value) => value,
                    Err(_) => continue,
                };
                if visited.insert(canonical.clone()) {
                    stack.push(canonical);
                }
            } else if path.is_file() {
                let extension = path
                    .extension()
                    .and_then(|value| value.to_str())
                    .unwrap_or("")
                    .to_ascii_lowercase();
                if extension == "md" || extension == "markdown" {
                    let relative = path.strip_prefix(&root).unwrap_or(&path);
                    found.push(relative.to_string_lossy().replace('\\', "/"));
                }
            }
        }
    }

    found.sort();
    Ok(found)
}

#[tauri::command]
pub fn resolve_local_asset(note_path: String, reference: String) -> Result<String, String> {
    let reference_path = Path::new(&reference);
    if reference_path.is_absolute() || reference.contains(':') {
        return Err(format!("Absolute or URL asset reference is not allowed: {reference}"));
    }
    for component in reference_path.components() {
        if matches!(component, Component::ParentDir) {
            return Err(format!("Asset reference escapes the note folder: {reference}"));
        }
    }

    let note = PathBuf::from(&note_path);
    let parent = note.parent().unwrap_or_else(|| Path::new("."));
    Ok(parent.join(reference_path).to_string_lossy().into_owned())
}

/// Grant the WebView read access to a note's own folder only.
#[tauri::command]
pub fn allow_asset_folder(app: tauri::AppHandle, path: String) -> Result<(), String> {
    app.asset_protocol_scope()
        .allow_directory(PathBuf::from(path), true)
        .map_err(|error| error.to_string())
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::fs;
    use std::path::PathBuf;
    use std::process::Command;
    use std::sync::atomic::{AtomicU64, Ordering};

    static COUNTER: AtomicU64 = AtomicU64::new(0);

    fn temp_dir(name: &str) -> PathBuf {
        let id = COUNTER.fetch_add(1, Ordering::Relaxed);
        let path = std::env::temp_dir().join(format!(
            "snug-test-{}-{}-{}",
            name,
            std::process::id(),
            id
        ));
        let _ = fs::remove_dir_all(&path);
        fs::create_dir_all(&path).unwrap();
        path
    }

    #[test]
    fn read_markdown_reports_missing_file() {
        let dir = temp_dir("missing");
        let path = dir.join("nope.md");
        let err = read_markdown(path.to_string_lossy().into_owned()).unwrap_err();
        assert!(err.contains("not found"), "unexpected error: {err}");
        let _ = fs::remove_dir_all(dir);
    }

    #[test]
    fn read_markdown_rejects_invalid_utf8() {
        let dir = temp_dir("utf8");
        let path = dir.join("bad.md");
        fs::write(&path, [0xFF, 0xFE]).unwrap();
        let err = read_markdown(path.to_string_lossy().into_owned()).unwrap_err();
        assert!(err.contains("UTF-8"), "unexpected error: {err}");
        let _ = fs::remove_dir_all(dir);
    }

    #[test]
    fn read_markdown_strips_utf8_bom() {
        let dir = temp_dir("bom");
        let path = dir.join("bom.md");
        let mut bytes = vec![0xEF, 0xBB, 0xBF];
        bytes.extend_from_slice(b"# heading");
        fs::write(&path, bytes).unwrap();
        let text = read_markdown(path.to_string_lossy().into_owned()).unwrap();
        assert_eq!(text, "# heading");
        let _ = fs::remove_dir_all(dir);
    }

    #[test]
    fn write_markdown_round_trip() {
        let dir = temp_dir("roundtrip");
        let path = dir.join("note.md");
        let p = path.to_string_lossy().into_owned();
        write_markdown(p.clone(), "# hi\n".to_string()).unwrap();
        assert_eq!(read_markdown(p).unwrap(), "# hi\n");
        let _ = fs::remove_dir_all(dir);
    }

    #[test]
    fn list_markdown_files_walks_nested_and_skips_junk() {
        let dir = temp_dir("walk");
        for rel in ["a.md", "nested/b.md", ".git/x.md", "node_modules/y.md", "notes.txt"] {
            let file = dir.join(rel);
            fs::create_dir_all(file.parent().unwrap()).unwrap();
            fs::write(file, "x").unwrap();
        }
        let root = dir.to_string_lossy().into_owned();
        let mut files = list_markdown_files(root).unwrap();
        files.sort();
        assert_eq!(files, vec!["a.md", "nested/b.md"]);
        let _ = fs::remove_dir_all(dir);
    }

    #[test]
    fn list_markdown_files_handles_symlink_loop() {
        let dir = temp_dir("symlink");
        fs::write(dir.join("a.md"), "x").unwrap();
        let link = dir.join("loop");
        let status = Command::new("cmd")
            .args([
                "/c",
                "mklink",
                "/J",
                &link.to_string_lossy(),
                &dir.to_string_lossy(),
            ])
            .output()
            .unwrap();
        assert!(status.status.success(), "could not create junction for test");
        let files = list_markdown_files(dir.to_string_lossy().into_owned()).unwrap();
        assert_eq!(files, vec!["a.md"]);
        let _ = fs::remove_dir_all(dir);
    }

    #[test]
    fn resolve_local_asset_rejects_parent_escape() {
        let dir = temp_dir("escape");
        let note = dir.join("notes/a.md");
        fs::create_dir_all(note.parent().unwrap()).unwrap();
        let err = resolve_local_asset(
            note.to_string_lossy().into_owned(),
            "../secret.png".to_string(),
        )
        .unwrap_err();
        assert!(err.contains("escape") || err.contains("not allowed"), "{err}");
        let _ = fs::remove_dir_all(dir);
    }

    #[test]
    fn resolve_local_asset_resolves_sibling() {
        let dir = temp_dir("sibling");
        let note = dir.join("notes/a.md");
        fs::create_dir_all(note.parent().unwrap()).unwrap();
        let expected = dir.join("notes/img/p.png");
        let got = resolve_local_asset(
            note.to_string_lossy().into_owned(),
            "img/p.png".to_string(),
        )
        .unwrap();
        assert_eq!(PathBuf::from(got), expected);
        let _ = fs::remove_dir_all(dir);
    }
}
