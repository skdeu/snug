//! Remembers the windows and tabs that are open, so the next launch can reopen them,
//! the way a browser restores its last session.
use std::fs;
use std::path::{Path, PathBuf};
use std::sync::Mutex;
use std::time::{Duration, Instant};

use serde::{Deserialize, Serialize};
use tauri::{AppHandle, WebviewWindow};

use crate::windows::{self, Placement, WorkArea};

/// One window's tabs, its active tab, and where it was (physical pixels).
#[derive(Clone, Debug, PartialEq, Serialize, Deserialize)]
pub struct SavedWindow {
    pub tabs: Vec<String>,
    pub active: Option<String>,
    pub bounds: Option<Bounds>,
    /// Whether the window was maximized. `None` is a v1.1 entry, which did not record it.
    #[serde(default)]
    pub maximized: Option<bool>,
}

/// Outer top-left corner and inner size of a window, in physical pixels.
#[derive(Clone, Copy, Debug, PartialEq, Serialize, Deserialize)]
pub struct Bounds {
    pub x: i32,
    pub y: i32,
    pub width: u32,
    pub height: u32,
}

#[derive(Serialize, Deserialize, Default)]
struct SessionFile {
    windows: Vec<SavedWindow>,
}

#[derive(Default)]
struct State {
    /// Windows that are open now, by label, in the order they were first saved.
    open: Vec<(String, SavedWindow)>,
    /// Windows from the last run, waiting to be reopened.
    restore: Vec<SavedWindow>,
    /// Restored windows that have been created but have not loaded their tabs yet.
    pending: Vec<(String, SavedWindow)>,
    /// When the file was last written, so dragging a window does not write on every step.
    last_write: Option<Instant>,
}

static STATE: Mutex<State> = Mutex::new(State {
    open: Vec::new(),
    restore: Vec::new(),
    pending: Vec::new(),
    last_write: None,
});

/// Moves and resizes are written at most this often.
const MOVE_WRITE_INTERVAL: Duration = Duration::from_millis(250);

fn with_state<T>(change: impl FnOnce(&mut State) -> T) -> Option<T> {
    STATE.lock().ok().map(|mut state| change(&mut state))
}

fn session_path() -> Option<PathBuf> {
    let base = crate::settings::data_root()?;
    Some(base.join("Snug").join("session.json"))
}

/// Write the open windows (those with tabs) to disk, atomically.
fn persist(state: &mut State) {
    let Some(path) = session_path() else { return };
    let file = SessionFile {
        windows: state
            .open
            .iter()
            .map(|(_, window)| window.clone())
            .filter(|window| !window.tabs.is_empty())
            .collect(),
    };
    if let Some(parent) = path.parent() {
        let _ = fs::create_dir_all(parent);
    }
    if let Ok(json) = serde_json::to_string_pretty(&file) {
        let _ = crate::commands::write_atomically(&path, json.as_bytes());
    }
    state.last_write = Some(Instant::now());
}

/// Read last run's windows. Called once, before any window exists.
pub fn load_at_startup() {
    let saved = session_path()
        .and_then(|path| fs::read_to_string(path).ok())
        .and_then(|text| serde_json::from_str::<SessionFile>(&text).ok())
        .map(|file| file.windows)
        .unwrap_or_default();
    with_state(|state| state.restore = saved);
}

/// Forget a window that was closed while others stayed open.
pub fn forget(label: &str) {
    with_state(|state| {
        state.open.retain(|(open, _)| open != label);
        persist(state);
    });
}

/// Record where a window is now. Called when it is moved, resized, or about to close.
/// `force` writes the file at once; otherwise writes are spaced out.
pub fn remember_bounds(window: &tauri::Window, force: bool) {
    let label = window.label().to_string();
    let (Ok(position), Ok(size)) = (window.outer_position(), window.inner_size()) else {
        return;
    };
    // A minimised window reports an off-screen position. That is not where the user left it.
    if position.x < -10_000 || position.y < -10_000 {
        return;
    }
    let bounds = Bounds {
        x: position.x,
        y: position.y,
        width: size.width,
        height: size.height,
    };
    let maximized = window.is_maximized().unwrap_or(false);
    with_state(|state| {
        let updated = match state.open.iter_mut().find(|(open, _)| *open == label) {
            Some((_, entry)) => {
                entry.bounds = bounds_to_keep(entry.bounds, maximized, Some(bounds));
                entry.maximized = Some(maximized);
                true
            }
            None => false,
        };
        if !updated {
            return;
        }
        let due = state
            .last_write
            .map_or(true, |last| last.elapsed() >= MOVE_WRITE_INTERVAL);
        if force || due {
            persist(state);
        }
    });
}

/// How far (physical pixels) an edge may sit from the work area's edge and still count
/// as maximized. A maximized window overhangs by a few pixels for its resize border.
const MAXIMIZED_TOLERANCE: f64 = 24.0;

/// True when each edge of `bounds` is within 24 physical pixels of `area`'s matching edge.
pub fn looks_maximized(bounds: Bounds, area: WorkArea) -> bool {
    let left = bounds.x as f64;
    let top = bounds.y as f64;
    let right = left + bounds.width as f64;
    let bottom = top + bounds.height as f64;
    (left - area.left).abs() <= MAXIMIZED_TOLERANCE
        && (top - area.top).abs() <= MAXIMIZED_TOLERANCE
        && (right - (area.left + area.width)).abs() <= MAXIMIZED_TOLERANCE
        && (bottom - (area.top + area.height)).abs() <= MAXIMIZED_TOLERANCE
}

/// Upgrade a v1.1 entry (`maximized` is `None`): a window whose geometry fills the work
/// area becomes maximized with no normal bounds; anything else becomes not maximized.
/// Entries that already have a value are left alone.
pub fn settle_maximized(window: &mut SavedWindow, area: Option<WorkArea>) {
    if window.maximized.is_some() {
        return;
    }
    let fills = matches!((window.bounds, area), (Some(bounds), Some(area)) if looks_maximized(bounds, area));
    if fills {
        window.maximized = Some(true);
        window.bounds = None;
    } else {
        window.maximized = Some(false);
    }
}

/// While maximized the window reports its screen-filling size, which is not the size to
/// come back to, so keep the previous normal bounds. Otherwise use the current ones.
pub fn bounds_to_keep(
    previous: Option<Bounds>,
    maximized: bool,
    current: Option<Bounds>,
) -> Option<Bounds> {
    if maximized {
        previous
    } else {
        current
    }
}

/// Only an explicit `Some(true)` restores maximized. `None` is an unsettled v1.1 entry.
pub fn is_maximized_entry(window: &SavedWindow) -> bool {
    window.maximized == Some(true)
}

/// Keep only what can be reopened: tabs whose files still exist, and an active tab
/// that is one of them.
fn usable(mut window: SavedWindow) -> Option<SavedWindow> {
    window.tabs.retain(|path| Path::new(path).is_file());
    if window.tabs.is_empty() {
        return None;
    }
    if !matches!(&window.active, Some(active) if window.tabs.contains(active)) {
        window.active = window.tabs.first().cloned();
    }
    Some(window)
}

/// Settle the waiting windows once, before any window is shown: drop what cannot be
/// reopened, upgrade v1.1 entries using the work area at each saved position, and write
/// the result back so `main_plan` and `restore_session` agree on the first window.
pub fn settle_startup(app: &AppHandle) {
    let waiting = with_state(|state| std::mem::take(&mut state.restore)).unwrap_or_default();
    let settled: Vec<SavedWindow> = waiting
        .into_iter()
        .filter_map(usable)
        .map(|mut window| {
            let area = window
                .bounds
                .and_then(|bounds| windows::work_area_for(app, bounds.x, bounds.y))
                .map(|(area, _)| area);
            settle_maximized(&mut window, area);
            window
        })
        .collect();
    with_state(|state| state.restore = settled);
}

/// How the main window should be placed at startup.
#[derive(Clone, Copy, Debug, PartialEq)]
pub struct MainPlan {
    pub bounds: Option<Bounds>,
    pub maximized: bool,
}

/// The pure part of `main_plan`. No window waiting is a first run: maximized.
pub fn plan_for_first(first: Option<&SavedWindow>) -> MainPlan {
    match first {
        Some(window) => MainPlan {
            bounds: window.bounds,
            maximized: window.maximized == Some(true),
        },
        None => MainPlan { bounds: None, maximized: true },
    }
}

/// Placement of the main window, from the first waiting window (after `settle_startup`).
pub fn main_plan() -> MainPlan {
    with_state(|state| plan_for_first(state.restore.first())).unwrap_or(MainPlan {
        bounds: None,
        maximized: true,
    })
}

/// The window's current tabs and active tab, from the frontend, after every change.
#[tauri::command]
pub fn save_session(
    window: WebviewWindow,
    tabs: Vec<String>,
    active: Option<String>,
) -> Result<(), String> {
    let label = window.label().to_string();
    let bounds = match (window.outer_position(), window.inner_size()) {
        (Ok(position), Ok(size)) => Some(Bounds {
            x: position.x,
            y: position.y,
            width: size.width,
            height: size.height,
        }),
        _ => None,
    };
    let maximized = window.is_maximized().unwrap_or(false);
    with_state(|state| {
        let previous = state
            .open
            .iter()
            .find(|(open, _)| *open == label)
            .and_then(|(_, entry)| entry.bounds);
        let saved = SavedWindow {
            tabs,
            active,
            bounds: bounds_to_keep(previous, maximized, bounds),
            maximized: Some(maximized),
        };
        match state.open.iter_mut().find(|(open, _)| *open == label) {
            Some((_, entry)) => *entry = saved,
            None => state.open.push((label, saved)),
        }
        persist(state);
    })
    .ok_or_else(|| "The session is busy, try again".to_string())
}

/// Called once by the main window at launch. Returns the main window's saved tabs and
/// creates a window for each of the others. On a reload of the main window (nothing
/// waiting to be restored) it returns the tabs the window already had.
#[tauri::command]
pub async fn restore_session(app: AppHandle) -> Result<Option<SavedWindow>, String> {
    let saved = with_state(|state| std::mem::take(&mut state.restore)).unwrap_or_default();
    if saved.is_empty() {
        let current = with_state(|state| {
            state
                .open
                .iter()
                .find(|(label, _)| label == "main")
                .map(|(_, window)| window.clone())
        })
        .flatten();
        return Ok(current.and_then(usable));
    }

    let mut windows: Vec<SavedWindow> = saved.into_iter().filter_map(usable).collect();
    if windows.is_empty() {
        return Ok(None);
    }
    let first = windows.remove(0);
    let others: Vec<(String, SavedWindow)> = windows
        .into_iter()
        .map(|window| (windows::next_label(), window))
        .collect();

    with_state(|state| {
        state.open.retain(|(label, _)| label != "main");
        state.open.push(("main".to_string(), first.clone()));
        for (label, window) in &others {
            state.open.push((label.clone(), window.clone()));
            state.pending.push((label.clone(), window.clone()));
        }
        persist(state);
    });

    for (label, window) in &others {
        let shown = window
            .active
            .clone()
            .or_else(|| window.tabs.first().cloned())
            .unwrap_or_default();
        let placement = match window.bounds {
            Some(bounds) => Placement::Saved {
                x: bounds.x,
                y: bounds.y,
                width: bounds.width,
                height: bounds.height,
            },
            None => Placement::Center,
        };
        if let Err(error) = windows::build_window(
            &app,
            label,
            "index.html",
            windows::title_for(&shown),
            placement,
            is_maximized_entry(window),
        ) {
            eprintln!("Could not reopen a window: {error}");
            forget(label);
        }
    }
    Ok(Some(first))
}

/// A window asks for its saved tabs once it has loaded. A restored window gets them
/// from the restore. A reloaded window gets the tabs it had. A new window gets nothing.
#[tauri::command]
pub fn take_pending_session(window: WebviewWindow) -> Option<SavedWindow> {
    let label = window.label().to_string();
    with_state(|state| {
        if let Some(index) = state.pending.iter().position(|(pending, _)| *pending == label) {
            return Some(state.pending.remove(index).1);
        }
        state
            .open
            .iter()
            .find(|(open, _)| *open == label)
            .map(|(_, saved)| saved.clone())
            .and_then(usable)
    })
    .flatten()
}

#[cfg(test)]
mod tests {
    use super::*;

    fn window(tabs: &[&str], active: Option<&str>) -> SavedWindow {
        SavedWindow {
            tabs: tabs.iter().map(|tab| tab.to_string()).collect(),
            active: active.map(|tab| tab.to_string()),
            bounds: None,
            maximized: None,
        }
    }

    #[test]
    fn main_plan_keeps_saved_bounds_and_state() {
        let mut first = window(&["C:\\n\\a.md"], None);
        first.bounds = Some(Bounds { x: 300, y: 200, width: 900, height: 700 });
        first.maximized = Some(false);
        let plan = plan_for_first(Some(&first));
        assert_eq!(plan.bounds, first.bounds);
        assert!(!plan.maximized);
    }

    #[test]
    fn main_plan_with_nothing_waiting_is_maximized() {
        let plan = plan_for_first(None);
        assert_eq!(plan, MainPlan { bounds: None, maximized: true });
    }

    #[test]
    fn only_an_explicitly_maximized_entry_restores_maximized() {
        let mut window = window(&["C:\\n\\a.md"], None);
        assert!(!is_maximized_entry(&window));
        window.maximized = Some(true);
        assert!(is_maximized_entry(&window));
    }

    #[test]
    fn v11_maximized_geometry_upgrades_to_maximized() {
        let json = r#"{"windows":[{"tabs":["C:\\notes\\README.md"],"active":"C:\\notes\\README.md","bounds":{"x":-13,"y":-13,"width":2880,"height":1659}}]}"#;
        let mut file: SessionFile = serde_json::from_str(json).unwrap();
        let area = WorkArea { left: 0.0, top: 0.0, width: 2880.0, height: 1659.0 };
        settle_maximized(&mut file.windows[0], Some(area));
        assert_eq!(file.windows[0].maximized, Some(true));
        assert_eq!(file.windows[0].bounds, None);
    }

    #[test]
    fn a_small_window_is_not_treated_as_maximized() {
        let area = WorkArea { left: 0.0, top: 0.0, width: 2880.0, height: 1659.0 };
        assert!(!looks_maximized(Bounds { x: 100, y: 100, width: 1280, height: 820 }, area));
    }

    #[test]
    fn a_v11_entry_that_is_not_maximized_keeps_its_bounds() {
        let area = WorkArea { left: 0.0, top: 0.0, width: 2880.0, height: 1659.0 };
        let small = Bounds { x: 100, y: 100, width: 1280, height: 820 };
        let mut entry = window(&["a.md"], None);
        entry.bounds = Some(small);
        settle_maximized(&mut entry, Some(area));
        assert_eq!(entry.maximized, Some(false));
        assert_eq!(entry.bounds, Some(small));
    }

    #[test]
    fn settle_maximized_without_a_work_area_is_not_maximized() {
        let big = Bounds { x: -13, y: -13, width: 2880, height: 1659 };
        let mut entry = window(&["a.md"], None);
        entry.bounds = Some(big);
        settle_maximized(&mut entry, None);
        assert_eq!(entry.maximized, Some(false));
    }

    #[test]
    fn settle_maximized_leaves_a_v12_entry_alone() {
        let area = WorkArea { left: 0.0, top: 0.0, width: 2880.0, height: 1659.0 };
        let big = Bounds { x: -13, y: -13, width: 2880, height: 1659 };
        let mut entry = window(&["a.md"], None);
        entry.bounds = Some(big);
        entry.maximized = Some(false);
        settle_maximized(&mut entry, Some(area));
        assert_eq!(entry.maximized, Some(false));
        assert_eq!(entry.bounds, Some(big));
    }

    #[test]
    fn a_maximized_window_beside_a_taskbar_still_counts() {
        let area = WorkArea { left: 0.0, top: 0.0, width: 2880.0, height: 1633.0 };
        assert!(looks_maximized(Bounds { x: -13, y: -13, width: 2880, height: 1659 }, area));
    }

    #[test]
    fn bounds_to_keep_holds_the_normal_size_while_maximized() {
        let normal = Bounds { x: 10, y: 20, width: 800, height: 600 };
        let big = Bounds { x: -13, y: -13, width: 2880, height: 1659 };
        assert_eq!(bounds_to_keep(Some(normal), true, Some(big)), Some(normal));
        assert_eq!(bounds_to_keep(Some(normal), false, Some(big)), Some(big));
    }

    #[test]
    fn saved_session_round_trips_through_json() {
        let file = SessionFile {
            windows: vec![SavedWindow {
                tabs: vec!["C:\\n\\a.md".to_string()],
                active: Some("C:\\n\\a.md".to_string()),
                bounds: Some(Bounds { x: 10, y: 20, width: 800, height: 600 }),
                maximized: None,
            }],
        };
        let json = serde_json::to_string(&file).unwrap();
        let back: SessionFile = serde_json::from_str(&json).unwrap();
        assert_eq!(back.windows, file.windows);
    }

    #[test]
    fn an_old_or_empty_session_file_reads_as_nothing() {
        let back: SessionFile = serde_json::from_str("{}").unwrap_or_default();
        assert!(back.windows.is_empty());
    }

    #[test]
    fn usable_drops_missing_files_and_repairs_the_active_tab() {
        let dir = std::env::temp_dir().join(format!("snug-session-{}", std::process::id()));
        std::fs::create_dir_all(&dir).unwrap();
        let kept = dir.join("kept.md");
        std::fs::write(&kept, "# kept").unwrap();
        let kept = kept.to_string_lossy().into_owned();
        let gone = dir.join("gone.md").to_string_lossy().into_owned();

        let result = usable(window(&[&gone, &kept], Some(&gone))).unwrap();
        assert_eq!(result.tabs, vec![kept.clone()]);
        assert_eq!(result.active, Some(kept.clone()));

        assert!(usable(window(&[&gone], None)).is_none());
        let _ = std::fs::remove_dir_all(dir);
    }
}
