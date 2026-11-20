//! Unsaved text of open notes, kept on disk so a crash or close loses nothing.
//! Drafts live in `<data root>/Snug/drafts/<key>.json`.

use serde::{Deserialize, Serialize};
use std::path::{Path, PathBuf};

use crate::commands::write_atomically;

#[derive(Serialize, Deserialize, Debug, Clone, PartialEq)]
pub struct Draft {
    pub path: String,
    pub text: String,
    pub base_modified: u64,
}

/// FNV-1a 64-bit of the lowercased path, as 16 hex digits. Written by hand so the key
/// does not change between Rust versions.
pub fn draft_key(path: &str) -> String {
    let mut hash: u64 = 0xcbf29ce484222325;
    for byte in path.to_lowercase().bytes() {
        hash ^= u64::from(byte);
        hash = hash.wrapping_mul(0x100000001b3);
    }
    format!("{hash:016x}")
}

fn draft_file(dir: &Path, path: &str) -> PathBuf {
    dir.join(format!("{}.json", draft_key(path)))
}

fn drafts_dir() -> Result<PathBuf, String> {
    let base = crate::settings::data_root()
        .ok_or_else(|| "Could not find a data directory".to_string())?;
    Ok(base.join("Snug").join("drafts"))
}

pub(crate) fn write_draft_in(
    dir: &Path,
    path: &str,
    text: &str,
    base_modified: u64,
) -> Result<(), String> {
    std::fs::create_dir_all(dir).map_err(|e| format!("Could not create drafts folder: {e}"))?;
    let draft = Draft {
        path: path.to_string(),
        text: text.to_string(),
        base_modified,
    };
    let json = serde_json::to_vec(&draft).map_err(|e| format!("Could not encode draft: {e}"))?;
    write_atomically(&draft_file(dir, path), &json)
        .map_err(|e| format!("Could not write draft: {e}"))
}

pub(crate) fn read_draft_in(dir: &Path, path: &str) -> Result<Option<Draft>, String> {
    let file = draft_file(dir, path);
    match std::fs::read_to_string(&file) {
        Ok(text) => serde_json::from_str::<Draft>(&text)
            .map(Some)
            .map_err(|e| format!("Could not read draft: {e}")),
        Err(e) if e.kind() == std::io::ErrorKind::NotFound => Ok(None),
        Err(e) => Err(format!("Could not read draft: {e}")),
    }
}

pub(crate) fn delete_draft_in(dir: &Path, path: &str) -> Result<(), String> {
    match std::fs::remove_file(draft_file(dir, path)) {
        Ok(()) => Ok(()),
        Err(e) if e.kind() == std::io::ErrorKind::NotFound => Ok(()),
        Err(e) => Err(format!("Could not delete draft: {e}")),
    }
}

/// Write the draft text beside the drafts as a readable `.md`, then drop the draft.
/// Returns the full path of the `.md`. If writing fails the draft is left in place.
pub(crate) fn keep_draft_aside_in(dir: &Path, path: &str) -> Result<String, String> {
    let draft = read_draft_in(dir, path)?.ok_or_else(|| "There is no draft to keep".to_string())?;
    let stem = Path::new(path)
        .file_stem()
        .map(|value| value.to_string_lossy().into_owned())
        .filter(|value| !value.is_empty())
        .unwrap_or_else(|| "note".to_string());
    let key = draft_key(path);
    // Never overwrite an earlier recovered file: take the next free name.
    let mut target = dir.join(format!("{stem}.recovered-{key}.md"));
    let mut n: u32 = 2;
    while target.exists() {
        target = dir.join(format!("{stem}.recovered-{key}-{n}.md"));
        n += 1;
    }
    write_atomically(&target, draft.text.as_bytes())
        .map_err(|e| format!("Could not keep the draft aside: {e}"))?;
    delete_draft_in(dir, path)?;
    Ok(target.to_string_lossy().into_owned())
}

#[tauri::command]
pub fn write_draft(path: String, text: String, base_modified: u64) -> Result<(), String> {
    write_draft_in(&drafts_dir()?, &path, &text, base_modified)
}

#[tauri::command]
pub fn read_draft(path: String) -> Result<Option<Draft>, String> {
    read_draft_in(&drafts_dir()?, &path)
}

#[tauri::command]
pub fn delete_draft(path: String) -> Result<(), String> {
    delete_draft_in(&drafts_dir()?, &path)
}

#[tauri::command]
pub fn keep_draft_aside(path: String) -> Result<String, String> {
    keep_draft_aside_in(&drafts_dir()?, &path)
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::path::PathBuf;

    static COUNTER: std::sync::atomic::AtomicU64 = std::sync::atomic::AtomicU64::new(0);

    fn temp_dir(name: &str) -> PathBuf {
        let id = COUNTER.fetch_add(1, std::sync::atomic::Ordering::Relaxed);
        let path = std::env::temp_dir().join(format!(
            "snug-test-{}-{}-{}",
            name,
            std::process::id(),
            id
        ));
        let _ = std::fs::remove_dir_all(&path);
        std::fs::create_dir_all(&path).unwrap();
        path
    }

    #[test]
    fn draft_key_is_fnv1a_and_ignores_case() {
        assert_eq!(draft_key(""), "cbf29ce484222325");
        assert_eq!(draft_key(r"C:\Notes\A.md"), draft_key(r"c:\notes\a.md"));
    }

    #[test]
    fn a_draft_round_trips_and_deletes() {
        let dir = temp_dir("roundtrip");
        write_draft_in(&dir, r"C:\n\a.md", "edited", 42).unwrap();
        let back = read_draft_in(&dir, r"C:\n\a.md").unwrap().unwrap();
        assert_eq!(back.text, "edited");
        assert_eq!(back.base_modified, 42);
        delete_draft_in(&dir, r"C:\n\a.md").unwrap();
        assert!(read_draft_in(&dir, r"C:\n\a.md").unwrap().is_none());
        let _ = std::fs::remove_dir_all(&dir);
    }

    #[test]
    fn keeping_aside_twice_never_overwrites_the_first_file() {
        let dir = temp_dir("aside-twice");
        write_draft_in(&dir, r"C:\n\a.md", "first text", 1).unwrap();
        let first = keep_draft_aside_in(&dir, r"C:\n\a.md").unwrap();
        write_draft_in(&dir, r"C:\n\a.md", "second text", 2).unwrap();
        let second = keep_draft_aside_in(&dir, r"C:\n\a.md").unwrap();
        assert_ne!(first, second);
        assert_eq!(std::fs::read_to_string(&first).unwrap(), "first text");
        assert_eq!(std::fs::read_to_string(&second).unwrap(), "second text");
        assert!(second.ends_with("-2.md"));
        let count = std::fs::read_dir(&dir)
            .unwrap()
            .filter(|e| {
                e.as_ref()
                    .unwrap()
                    .file_name()
                    .to_string_lossy()
                    .ends_with(".md")
            })
            .count();
        assert_eq!(count, 2);
        let _ = std::fs::remove_dir_all(&dir);
    }

    #[test]
    fn keep_aside_writes_a_readable_md_and_removes_the_draft() {
        let dir = temp_dir("aside");
        write_draft_in(&dir, r"C:\n\a.md", "kept text", 1).unwrap();
        let path = keep_draft_aside_in(&dir, r"C:\n\a.md").unwrap();
        assert_eq!(std::fs::read_to_string(&path).unwrap(), "kept text");
        assert!(read_draft_in(&dir, r"C:\n\a.md").unwrap().is_none());
        let _ = std::fs::remove_dir_all(&dir);
    }
}
