// Copyright 2026 Sanjaykumar Sagadevan Vijayakumar
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//     http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.

use std::collections::HashSet;
use std::fs;
use std::io::Write;
use std::path::{Component, Path, PathBuf};
use std::time::{Duration, UNIX_EPOCH};

use serde::Serialize;

/// The text of a note, and when it was last changed on disk (ms since 1970).
#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct Document {
    pub text: String,
    pub modified: u64,
}

/// Error text the frontend recognises when a note changed on disk since it was loaded.
pub const CHANGED_ON_DISK: &str = "CHANGED_ON_DISK";

fn modified_millis(path: &Path) -> Option<u64> {
    let modified = fs::metadata(path).ok()?.modified().ok()?;
    modified
        .duration_since(UNIX_EPOCH)
        .ok()
        .map(|elapsed| elapsed.as_millis() as u64)
}

pub fn read_file(path: &str) -> Result<Document, String> {
    let file = Path::new(path);
    if !file.exists() {
        return Err(format!("File not found: {path}"));
    }
    let bytes = fs::read(file).map_err(|error| format!("Could not read file: {error}"))?;
    let text = String::from_utf8(bytes)
        .map_err(|error| format!("File is not valid UTF-8: {error}"))?;
    Ok(Document {
        text: text.trim_start_matches('\u{FEFF}').to_string(),
        modified: modified_millis(file).unwrap_or(0),
    })
}

/// Save a note. When `expected_modified` is given, the save is refused if the file
/// changed on disk since that time, so another editor's changes are never lost.
/// Returns the file's new modified time.
pub fn write_file(
    path: &str,
    contents: &str,
    expected_modified: Option<u64>,
) -> Result<u64, String> {
    let file = Path::new(path);
    if let Some(expected) = expected_modified {
        if modified_millis(file) != Some(expected) {
            return Err(CHANGED_ON_DISK.to_string());
        }
    }
    write_atomically(file, contents.as_bytes())
        .map_err(|error| format!("Could not save file: {error}"))?;
    Ok(modified_millis(file).unwrap_or(0))
}

/// Write to a temporary file beside the note, then move it into place, so a crash
/// mid-save leaves the old text intact. Windows can briefly refuse the move while
/// another program has the file open, so it is retried, then written directly.
pub(crate) fn write_atomically(path: &Path, bytes: &[u8]) -> std::io::Result<()> {
    let name = path
        .file_name()
        .map(|value| value.to_string_lossy().into_owned())
        .unwrap_or_else(|| "note".to_string());
    let directory = path
        .parent()
        .filter(|value| !value.as_os_str().is_empty())
        .unwrap_or_else(|| Path::new("."));
    let temp = directory.join(format!(".{name}.{}.snug-tmp", std::process::id()));

    let staged = (|| -> std::io::Result<()> {
        let mut file = fs::File::create(&temp)?;
        file.write_all(bytes)?;
        file.sync_all()
    })();
    if staged.is_err() {
        let _ = fs::remove_file(&temp);
        return fs::write(path, bytes);
    }

    for _ in 0..5 {
        if fs::rename(&temp, path).is_ok() {
            return Ok(());
        }
        std::thread::sleep(Duration::from_millis(80));
    }
    let _ = fs::remove_file(&temp);
    fs::write(path, bytes)
}

/// Markdown files under `folder`, relative to it, sorted. Folders that cannot be
/// read are skipped; only an unreadable top folder is an error.
pub fn list_files(folder: &str) -> Result<Vec<String>, String> {
    let root = fs::canonicalize(folder)
        .map_err(|error| format!("Could not open folder {folder}: {error}"))?;

    const JUNK: [&str; 6] = [".git", "node_modules", "dist", "bin", "obj", ".superpowers"];
    let mut stack = vec![root.clone()];
    let mut visited = HashSet::new();
    visited.insert(root.clone());
    let mut found = Vec::new();

    while let Some(directory) = stack.pop() {
        let entries = match fs::read_dir(&directory) {
            Ok(entries) => entries,
            Err(error) if directory == root => {
                return Err(format!("Could not list folder: {error}"));
            }
            Err(_) => continue,
        };
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

// Commands run off the UI thread (async), so slow disks or large folders never freeze the window.

#[tauri::command]
pub async fn read_markdown(path: String) -> Result<Document, String> {
    read_file(&path)
}

#[tauri::command]
pub async fn write_markdown(
    path: String,
    contents: String,
    expected_modified: Option<u64>,
) -> Result<u64, String> {
    write_file(&path, &contents, expected_modified)
}

#[tauri::command]
pub async fn list_markdown_files(folder: String) -> Result<Vec<String>, String> {
    list_files(&folder)
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
    use tauri::Manager;
    app.asset_protocol_scope()
        .allow_directory(PathBuf::from(path), true)
        .map_err(|error| error.to_string())
}

/// Open a web or mail link in the default program. Other schemes are refused, so a
/// link in a note can never run a local file.
#[tauri::command]
pub fn open_external(url: String) -> Result<(), String> {
    let link = url.trim();
    let lower = link.to_ascii_lowercase();
    let allowed = ["https://", "http://", "mailto:"]
        .iter()
        .any(|scheme| lower.starts_with(scheme));
    if !allowed {
        return Err(format!("Only web and mail links open outside Snug: {link}"));
    }
    #[cfg(windows)]
    {
        std::process::Command::new("explorer")
            .arg(link)
            .spawn()
            .map_err(|error| format!("Could not open the link: {error}"))?;
        Ok(())
    }
    #[cfg(not(windows))]
    {
        Err("Opening links is only supported on Windows".to_string())
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    static COUNTER: std::sync::atomic::AtomicU64 = std::sync::atomic::AtomicU64::new(0);

    fn temp_dir(name: &str) -> PathBuf {
        let id = COUNTER.fetch_add(1, std::sync::atomic::Ordering::Relaxed);
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
    fn read_reports_missing_file() {
        let dir = temp_dir("missing");
        let err = read_file(&dir.join("nope.md").to_string_lossy()).err().unwrap();
        assert!(err.contains("not found"), "unexpected error: {err}");
        let _ = fs::remove_dir_all(dir);
    }

    #[test]
    fn read_rejects_invalid_utf8() {
        let dir = temp_dir("utf8");
        let path = dir.join("bad.md");
        fs::write(&path, [0xFF, 0xFE]).unwrap();
        let err = read_file(&path.to_string_lossy()).err().unwrap();
        assert!(err.contains("UTF-8"), "unexpected error: {err}");
        let _ = fs::remove_dir_all(dir);
    }

    #[test]
    fn read_strips_utf8_bom() {
        let dir = temp_dir("bom");
        let path = dir.join("bom.md");
        let mut bytes = vec![0xEF, 0xBB, 0xBF];
        bytes.extend_from_slice(b"# heading");
        fs::write(&path, bytes).unwrap();
        let document = read_file(&path.to_string_lossy()).unwrap();
        assert_eq!(document.text, "# heading");
        let _ = fs::remove_dir_all(dir);
    }

    #[test]
    fn write_then_read_round_trips() {
        let dir = temp_dir("roundtrip");
        let path = dir.join("note.md").to_string_lossy().into_owned();
        write_file(&path, "# hi\n", None).unwrap();
        assert_eq!(read_file(&path).unwrap().text, "# hi\n");
        let _ = fs::remove_dir_all(dir);
    }

    #[test]
    fn save_leaves_no_temporary_file_behind() {
        let dir = temp_dir("tmpfile");
        let path = dir.join("note.md").to_string_lossy().into_owned();
        write_file(&path, "text", None).unwrap();
        let names: Vec<String> = fs::read_dir(&dir)
            .unwrap()
            .flatten()
            .map(|entry| entry.file_name().to_string_lossy().into_owned())
            .collect();
        assert_eq!(names, vec!["note.md"]);
        let _ = fs::remove_dir_all(dir);
    }

    #[test]
    fn save_refuses_when_file_changed_on_disk() {
        let dir = temp_dir("conflict");
        let path = dir.join("note.md");
        fs::write(&path, "original").unwrap();
        let loaded = read_file(&path.to_string_lossy()).unwrap().modified;

        // Another program changes the file after it was loaded.
        std::thread::sleep(Duration::from_millis(20));
        fs::write(&path, "changed elsewhere").unwrap();

        let err = write_file(&path.to_string_lossy(), "mine", Some(loaded)).unwrap_err();
        assert_eq!(err, CHANGED_ON_DISK);
        assert_eq!(fs::read_to_string(&path).unwrap(), "changed elsewhere");
        let _ = fs::remove_dir_all(dir);
    }

    #[test]
    fn save_twice_with_returned_stamp_does_not_conflict() {
        let dir = temp_dir("resave");
        let path = dir.join("note.md").to_string_lossy().into_owned();
        fs::write(&path, "one").unwrap();
        let stamp = read_file(&path).unwrap().modified;
        let stamp = write_file(&path, "two", Some(stamp)).unwrap();
        write_file(&path, "three", Some(stamp)).unwrap();
        assert_eq!(read_file(&path).unwrap().text, "three");
        let _ = fs::remove_dir_all(dir);
    }

    #[test]
    fn list_walks_nested_and_skips_junk() {
        let dir = temp_dir("walk");
        for rel in ["a.md", "nested/b.md", ".git/x.md", "node_modules/y.md", "notes.txt"] {
            let file = dir.join(rel);
            fs::create_dir_all(file.parent().unwrap()).unwrap();
            fs::write(file, "x").unwrap();
        }
        let mut files = list_files(&dir.to_string_lossy()).unwrap();
        files.sort();
        assert_eq!(files, vec!["a.md", "nested/b.md"]);
        let _ = fs::remove_dir_all(dir);
    }

    #[test]
    fn list_reports_missing_folder() {
        let dir = temp_dir("nofolder");
        let err = list_files(&dir.join("missing").to_string_lossy()).unwrap_err();
        assert!(err.contains("Could not open folder"), "{err}");
        let _ = fs::remove_dir_all(dir);
    }

    #[test]
    fn list_handles_symlink_loop() {
        let dir = temp_dir("symlink");
        fs::write(dir.join("a.md"), "x").unwrap();
        let link = dir.join("loop");
        let status = std::process::Command::new("cmd")
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
        let files = list_files(&dir.to_string_lossy()).unwrap();
        assert_eq!(files, vec!["a.md"]);
        let _ = fs::remove_dir_all(dir);
    }

    #[test]
    fn open_external_refuses_local_paths_and_files() {
        assert!(open_external("C:\\Windows\\System32\\calc.exe".to_string()).is_err());
        assert!(open_external("file:///C:/secret.txt".to_string()).is_err());
        assert!(open_external("javascript:alert(1)".to_string()).is_err());
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
