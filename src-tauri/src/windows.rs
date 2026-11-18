use std::path::Path;
use std::sync::atomic::{AtomicU64, Ordering};
use std::sync::OnceLock;

use tauri::{AppHandle, WebviewUrl, WebviewWindowBuilder};

static LAUNCH_NOTE: OnceLock<Option<String>> = OnceLock::new();
static WINDOW_COUNTER: AtomicU64 = AtomicU64::new(0);

pub fn remember_launch_note(args: Vec<String>) {
    let _ = LAUNCH_NOTE.set(parse_launch_args(args));
}

#[tauri::command]
pub fn get_launch_note() -> Option<String> {
    LAUNCH_NOTE.get().cloned().flatten()
}

pub fn parse_launch_args(args: Vec<String>) -> Option<String> {
    args.into_iter()
        .skip(1)
        .find(|arg| {
            if arg.starts_with('-') {
                return false;
            }
            let lower = arg.to_ascii_lowercase();
            lower.ends_with(".md") || lower.ends_with(".markdown")
        })
}

fn urlencode(value: &str) -> String {
    let mut out = String::new();
    for byte in value.bytes() {
        match byte {
            b'A'..=b'Z' | b'a'..=b'z' | b'0'..=b'9' | b'-' | b'_' | b'.' | b'/' | b':' => {
                out.push(byte as char)
            }
            _ => out.push_str(&format!("%{byte:02X}")),
        }
    }
    out
}

pub fn open_note_window(app: AppHandle, path: String) -> Result<(), String> {
    let name = Path::new(&path)
        .file_name()
        .and_then(|value| value.to_str())
        .unwrap_or("Note");
    let id = WINDOW_COUNTER.fetch_add(1, Ordering::Relaxed);
    let label = format!("note-{id}");
    let url = format!("index.html?note={}", urlencode(&path));

    WebviewWindowBuilder::new(&app, &label, WebviewUrl::App(url.into()))
        .title(format!("Snug — {name}"))
        .build()
        .map_err(|error| error.to_string())?;
    Ok(())
}

#[tauri::command]
pub fn open_note_window_cmd(app: AppHandle, path: String) -> Result<(), String> {
    open_note_window(app, path)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn parse_launch_args_finds_md_path() {
        let args = vec!["snug".to_string(), "C:\\notes\\a.md".to_string()];
        assert_eq!(parse_launch_args(args), Some("C:\\notes\\a.md".to_string()));
    }

    #[test]
    fn parse_launch_args_ignores_flags() {
        let args = vec!["snug".to_string(), "--flag".to_string()];
        assert_eq!(parse_launch_args(args), None);
    }
}
