use std::path::Path;
use std::sync::atomic::{AtomicU64, Ordering};
use std::sync::Mutex;

use tauri::{AppHandle, Emitter, Manager, WebviewUrl, WebviewWindow, WebviewWindowBuilder};

/// A note given on the command line, waiting for the main window to take it.
static LAUNCH_NOTE: Mutex<Option<String>> = Mutex::new(None);
static WINDOW_COUNTER: AtomicU64 = AtomicU64::new(0);

/// Event that asks a window to open a note as a new tab.
pub const OPEN_TAB_EVENT: &str = "snug://open-tab";

/// Size of a new window, in logical pixels.
const NEW_WINDOW_SIZE: (f64, f64) = (1100.0, 760.0);

/// Physical pixels kept clear inside the work area: a border on the right, and the
/// title bar plus the bottom border below the window.
const FRAME_RIGHT_PX: f64 = 40.0;
const FRAME_BELOW_PX: f64 = 120.0;

/// Where a new window goes.
#[derive(Clone, Copy, Debug, PartialEq)]
pub enum Placement {
    /// With its tab under the screen point (physical pixels), as for a torn-off tab.
    Near(i32, i32),
    /// At a saved position and inner size (physical pixels), as for a restored window.
    Saved { x: i32, y: i32, width: u32, height: u32 },
    /// Centred on its monitor.
    Center,
}

/// A monitor's usable area, in physical pixels (the taskbar is not part of it).
#[derive(Clone, Copy, Debug, PartialEq)]
pub struct WorkArea {
    pub left: f64,
    pub top: f64,
    pub width: f64,
    pub height: f64,
}

/// Fit a window of `desired` inner size (physical pixels) into `area`, with its
/// top-left at (`wanted_left`, `wanted_top`) when that fits. Returns (left, top,
/// width, height) in logical pixels, for a monitor with the given `scale`.
pub fn fit_window(
    area: WorkArea,
    scale: f64,
    wanted_left: f64,
    wanted_top: f64,
    desired: (f64, f64),
) -> (f64, f64, f64, f64) {
    let width = desired.0.min(area.width * 0.85);
    let height = desired.1.min(area.height * 0.85);
    let left = wanted_left
        .min(area.left + area.width - width - FRAME_RIGHT_PX)
        .max(area.left);
    let top = wanted_top
        .min(area.top + area.height - height - FRAME_BELOW_PX)
        .max(area.top);
    (left / scale, top / scale, width / scale, height / scale)
}

/// Fit a window at a saved position and size (physical pixels) into `area`. Only the
/// work area limits it: a window the user made large comes back that large.
pub fn fit_saved(
    area: WorkArea,
    scale: f64,
    left: f64,
    top: f64,
    width: f64,
    height: f64,
) -> (f64, f64, f64, f64) {
    let width = width.min(area.width);
    let height = height.min(area.height);
    let left = left
        .min(area.left + area.width - width - FRAME_RIGHT_PX)
        .max(area.left);
    let top = top
        .min(area.top + area.height - height - FRAME_BELOW_PX)
        .max(area.top);
    (left / scale, top / scale, width / scale, height / scale)
}

/// The usable area and scale of the monitor under (`x`, `y`), or of the primary monitor
/// when that point is no longer on screen (a monitor was unplugged).
pub(crate) fn work_area_for(app: &AppHandle, x: i32, y: i32) -> Option<(WorkArea, f64)> {
    let monitor = app
        .monitor_from_point(f64::from(x), f64::from(y))
        .ok()
        .flatten()
        .or_else(|| app.primary_monitor().ok().flatten())?;
    let area = *monitor.work_area();
    let work = WorkArea {
        left: f64::from(area.position.x),
        top: f64::from(area.position.y),
        width: f64::from(area.size.width),
        height: f64::from(area.size.height),
    };
    Some((work, monitor.scale_factor()))
}

/// Where a restored window goes: its saved position and size, kept inside the screen.
fn place_saved(app: &AppHandle, x: i32, y: i32, width: u32, height: u32) -> (f64, f64, f64, f64) {
    match work_area_for(app, x, y) {
        Some((work, scale)) => fit_saved(
            work,
            scale,
            f64::from(x),
            f64::from(y),
            f64::from(width),
            f64::from(height),
        ),
        None => (f64::from(x), f64::from(y), f64::from(width), f64::from(height)),
    }
}

/// Where and how large a window should be, from the monitor under (`x`, `y`), or the
/// primary monitor when that point is no longer on screen (a monitor was unplugged).
fn place(app: &AppHandle, x: i32, y: i32, saved_size: Option<(f64, f64)>) -> (f64, f64, f64, f64) {
    let monitor = app
        .monitor_from_point(f64::from(x), f64::from(y))
        .ok()
        .flatten()
        .or_else(|| app.primary_monitor().ok().flatten());
    match monitor {
        Some(monitor) => {
            let scale = monitor.scale_factor();
            let area = *monitor.work_area();
            let work = WorkArea {
                left: f64::from(area.position.x),
                top: f64::from(area.position.y),
                width: f64::from(area.size.width),
                height: f64::from(area.size.height),
            };
            match saved_size {
                Some(size) => fit_window(work, scale, f64::from(x), f64::from(y), size),
                // A torn-off tab: keep it under the pointer, a little below the title bar.
                None => fit_window(
                    work,
                    scale,
                    f64::from(x) - 80.0 * scale,
                    f64::from(y) - 18.0 * scale,
                    (NEW_WINDOW_SIZE.0 * scale, NEW_WINDOW_SIZE.1 * scale),
                ),
            }
        }
        None => match saved_size {
            Some((width, height)) => (f64::from(x), f64::from(y), width, height),
            None => (
                f64::from(x) - 80.0,
                f64::from(y) - 18.0,
                NEW_WINDOW_SIZE.0,
                NEW_WINDOW_SIZE.1,
            ),
        },
    }
}

/// A window of the default size, centred on the primary monitor's work area and fitted to it.
fn center_on_primary(app: &AppHandle) -> (f64, f64, f64, f64) {
    match app.primary_monitor().ok().flatten() {
        Some(monitor) => {
            let scale = monitor.scale_factor();
            let area = *monitor.work_area();
            let work = WorkArea {
                left: f64::from(area.position.x),
                top: f64::from(area.position.y),
                width: f64::from(area.size.width),
                height: f64::from(area.size.height),
            };
            let desired = (NEW_WINDOW_SIZE.0 * scale, NEW_WINDOW_SIZE.1 * scale);
            let (_, _, width, height) = fit_window(work, scale, 0.0, 0.0, desired);
            let left = work.left / scale + (work.width / scale - width) / 2.0;
            let top = work.top / scale + (work.height / scale - height) / 2.0;
            (left, top, width, height)
        }
        None => (100.0, 60.0, NEW_WINDOW_SIZE.0, NEW_WINDOW_SIZE.1),
    }
}

/// Place the main window from its plan: saved size and position (kept on screen), then
/// maximize when it was maximized. Every error is ignored.
pub fn place_main(app: &AppHandle, window: &WebviewWindow, plan: crate::session::MainPlan) {
    if let Some(bounds) = plan.bounds {
        if let Some((work, scale)) = work_area_for(app, bounds.x, bounds.y) {
            let (left, top, width, height) = fit_saved(
                work,
                scale,
                f64::from(bounds.x),
                f64::from(bounds.y),
                f64::from(bounds.width),
                f64::from(bounds.height),
            );
            let _ = window.set_size(tauri::LogicalSize::new(width, height));
            let _ = window.set_position(tauri::LogicalPosition::new(left, top));
        }
    }
    if plan.maximized {
        let _ = window.maximize();
    }
}

/// A fresh window label, unique for this run.
pub fn next_label() -> String {
    format!("note-{}", WINDOW_COUNTER.fetch_add(1, Ordering::Relaxed))
}

/// Title for a window that shows `path`.
pub fn title_for(path: &str) -> String {
    let name = Path::new(path)
        .file_name()
        .and_then(|value| value.to_str())
        .unwrap_or("Note");
    format!("Snug — {name}")
}

/// Create a window at `url` with the given placement.
pub fn build_window(
    app: &AppHandle,
    label: &str,
    url: &str,
    title: String,
    placement: Placement,
    maximized: bool,
) -> Result<(), String> {
    let builder = WebviewWindowBuilder::new(app, label, WebviewUrl::App(url.into())).title(title);
    let builder = match placement {
        Placement::Center => {
            let (left, top, width, height) = center_on_primary(app);
            builder.inner_size(width, height).position(left, top)
        }
        Placement::Near(x, y) => {
            let (left, top, width, height) = place(app, x, y, None);
            builder.inner_size(width, height).position(left, top)
        }
        Placement::Saved { x, y, width, height } => {
            let (left, top, w, h) = place_saved(app, x, y, width, height);
            builder.inner_size(w, h).position(left, top)
        }
    };
    let builder = if maximized { builder.maximized(true) } else { builder };
    builder.build().map(|_| ()).map_err(|error| error.to_string())
}

pub fn remember_launch_note(args: Vec<String>) {
    if let Ok(mut slot) = LAUNCH_NOTE.lock() {
        *slot = parse_launch_args(args);
    }
}

/// The note this app was launched with. Only the first caller gets it, so one
/// note never opens in several windows.
#[tauri::command]
pub fn take_launch_note() -> Option<String> {
    LAUNCH_NOTE.lock().ok().and_then(|mut slot| slot.take())
}

/// Windows that belong to Snug and can receive tabs.
pub fn is_snug_window(label: &str) -> bool {
    label == "main" || label.starts_with("note-")
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

/// Open a new window showing `path`, with its tab near the screen point (`x`, `y`).
pub fn open_window_at(app: &AppHandle, path: &str, x: i32, y: i32) -> Result<(), String> {
    let url = format!("index.html?note={}", urlencode(path));
    build_window(app, &next_label(), &url, title_for(path), Placement::Near(x, y), false)
}

/// Ctrl+N: an empty window, centred on screen.
#[tauri::command]
pub fn new_window(app: AppHandle) -> Result<(), String> {
    build_window(&app, &next_label(), "index.html", "Snug".to_string(), Placement::Center, false)
}

/// Called when a tab is released away from its tab strip. If another Snug window is
/// under the pointer, the tab moves there. Otherwise it becomes a new window at the
/// pointer, as in a browser, even when the pointer is still inside its own window.
/// Returns "merged" or "created".
// Async on purpose: a synchronous command runs on the UI thread, and creating a webview
// window from there can deadlock on Windows, leaving the new window blank.
#[tauri::command]
pub async fn drop_tab(app: AppHandle, origin: String, path: String) -> Result<String, String> {
    let cursor = app.cursor_position().map_err(|error| error.to_string())?;
    let x = cursor.x.round() as i32;
    let y = cursor.y.round() as i32;

    if let Some(top) = native::top_level_at(x, y) {
        for (label, window) in app.webview_windows() {
            if label == origin || !is_snug_window(&label) {
                continue;
            }
            if window_handle(&window) == Some(top) {
                app.emit_to(label.as_str(), OPEN_TAB_EVENT, path.as_str())
                    .map_err(|error| error.to_string())?;
                let _ = window.unminimize();
                let _ = window.set_focus();
                return Ok("merged".to_string());
            }
        }
    }

    open_window_at(&app, &path, x, y)?;
    Ok("created".to_string())
}

/// A second launch of Snug: hand its file to the window the user is working in,
/// instead of starting another window.
pub fn forward_launch(app: &AppHandle, args: Vec<String>) {
    let windows = app.webview_windows();
    let target = windows
        .iter()
        .find(|(label, window)| is_snug_window(label) && window.is_focused().unwrap_or(false))
        .or_else(|| windows.iter().find(|(label, _)| label.as_str() == "main"))
        .or_else(|| windows.iter().find(|(label, _)| is_snug_window(label)))
        .map(|(label, window)| (label.clone(), window.clone()));

    let Some(path) = parse_launch_args(args) else {
        if let Some((_, window)) = target {
            let _ = window.unminimize();
            let _ = window.set_focus();
        }
        return;
    };

    match target {
        Some((label, window)) => {
            let _ = app.emit_to(label.as_str(), OPEN_TAB_EVENT, path.as_str());
            let _ = window.unminimize();
            let _ = window.set_focus();
        }
        None => {
            let (x, y) = app
                .cursor_position()
                .map(|p| (p.x.round() as i32, p.y.round() as i32))
                .unwrap_or((100, 100));
            let _ = open_window_at(app, &path, x, y);
        }
    }
}

/// A Snug window was destroyed. When other windows remain, the closed window is
/// forgotten (it was closed on purpose). The last window is kept, so the next launch
/// reopens it.
pub fn window_destroyed(app: &AppHandle, label: &str) {
    if !is_snug_window(label) {
        return;
    }
    let others = app
        .webview_windows()
        .keys()
        .filter(|other| other.as_str() != label && is_snug_window(other))
        .count();
    if others > 0 {
        crate::session::forget(label);
    }
}

fn window_handle(window: &WebviewWindow) -> Option<usize> {
    #[cfg(windows)]
    {
        window.hwnd().ok().map(|handle| handle.0 as usize)
    }
    #[cfg(not(windows))]
    {
        let _ = window;
        None
    }
}

#[cfg(windows)]
mod native {
    use std::ffi::c_void;

    #[repr(C)]
    struct Point {
        x: i32,
        y: i32,
    }

    #[link(name = "user32")]
    extern "system" {
        fn WindowFromPoint(point: Point) -> *mut c_void;
        fn GetAncestor(hwnd: *mut c_void, flags: u32) -> *mut c_void;
    }

    const GA_ROOT: u32 = 2;

    /// The top-level window that is actually on top at a screen point, so a
    /// window hidden behind another app is never chosen.
    pub fn top_level_at(x: i32, y: i32) -> Option<usize> {
        // SAFETY: plain user32 calls with a by-value point; no pointers are kept.
        unsafe {
            let hit = WindowFromPoint(Point { x, y });
            if hit.is_null() {
                return None;
            }
            let root = GetAncestor(hit, GA_ROOT);
            Some(if root.is_null() { hit as usize } else { root as usize })
        }
    }
}

#[cfg(not(windows))]
mod native {
    pub fn top_level_at(_x: i32, _y: i32) -> Option<usize> {
        None
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn screen() -> WorkArea {
        WorkArea { left: 0.0, top: 0.0, width: 2880.0, height: 1704.0 }
    }

    #[test]
    fn fit_saved_brings_an_off_screen_window_back() {
        let area = WorkArea { left: 0.0, top: 0.0, width: 1920.0, height: 1040.0 };
        let (left, top, _, _) = fit_saved(area, 1.0, 5000.0, 4000.0, 900.0, 700.0);
        assert!(left + 900.0 <= 1920.0 && top + 700.0 <= 1040.0);
    }

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

    #[test]
    fn only_snug_windows_receive_tabs() {
        assert!(is_snug_window("main"));
        assert!(is_snug_window("note-3"));
        assert!(!is_snug_window("settings"));
    }

    #[test]
    fn launch_note_is_taken_once() {
        remember_launch_note(vec!["snug".to_string(), "C:\\n\\a.md".to_string()]);
        assert_eq!(take_launch_note(), Some("C:\\n\\a.md".to_string()));
        assert_eq!(take_launch_note(), None);
    }

    #[test]
    fn a_window_that_fits_keeps_its_place() {
        let (left, top, width, height) = fit_window(screen(), 2.0, 400.0, 300.0, (2000.0, 1200.0));
        assert_eq!((left, top, width, height), (200.0, 150.0, 1000.0, 600.0));
    }

    #[test]
    fn a_window_near_the_bottom_right_moves_inside_the_screen() {
        let (left, top, width, height) = fit_window(screen(), 2.0, 2540.0, 1664.0, (2200.0, 1520.0));
        // The right edge and the bottom, with the frame allowance, stay on screen.
        assert!(left * 2.0 + width * 2.0 + FRAME_RIGHT_PX <= 2880.0 + 0.5);
        assert!(top * 2.0 + height * 2.0 + FRAME_BELOW_PX <= 1704.0 + 0.5);
        assert!(left >= 0.0 && top >= 0.0);
    }

    #[test]
    fn a_restored_window_keeps_its_saved_size_when_it_fits_the_screen() {
        let (left, top, width, height) = fit_saved(screen(), 1.0, 300.0, 50.0, 2400.0, 1500.0);
        assert_eq!((left, top, width, height), (300.0, 50.0, 2400.0, 1500.0));
    }

    #[test]
    fn a_window_larger_than_the_screen_is_shrunk() {
        let (_, _, width, height) = fit_window(screen(), 1.0, 0.0, 0.0, (5000.0, 5000.0));
        assert!((width - 2880.0 * 0.85).abs() < 0.01);
        assert!((height - 1704.0 * 0.85).abs() < 0.01);
    }
}
