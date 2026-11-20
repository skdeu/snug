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

use std::fs;
use std::path::PathBuf;
use std::sync::Mutex;

use serde::{Deserialize, Serialize};
use tauri::{AppHandle, Emitter};

/// Event sent to every window after the settings change.
pub const SETTINGS_EVENT: &str = "snug://settings-changed";

/// Serialises read-merge-write, so two windows changing settings at once cannot lose a change.
static WRITE_LOCK: Mutex<()> = Mutex::new(());

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum Theme {
    Dark,
    Light,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum View {
    Focus,
    Library,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum Palette {
    Graphite,
    Harbor,
    Umber,
    Slate,
    Ash,
}

/// Missing keys take their defaults, so a file from before a setting existed keeps the rest.
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(default)]
pub struct AppSettings {
    pub theme: Theme,
    pub view: View,
    pub font_size: u32,
    pub last_folder: Option<String>,
    pub palette: Palette,
}

impl Default for AppSettings {
    fn default() -> Self {
        Self {
            theme: Theme::Dark,
            view: View::Focus,
            font_size: 18,
            last_folder: None,
            palette: Palette::Graphite,
        }
    }
}

/// The folder that holds Snug's settings and session. `SNUG_DATA_DIR` moves it, so a test
/// build can run without touching the settings of the installed app.
pub fn data_root() -> Option<PathBuf> {
    if let Some(dir) = std::env::var_os("SNUG_DATA_DIR") {
        return Some(PathBuf::from(dir));
    }
    dirs::config_dir().or_else(dirs::data_dir)
}

pub fn settings_path() -> Result<PathBuf, String> {
    let base = data_root().ok_or_else(|| "Could not find a settings directory".to_string())?;
    Ok(base.join("Snug").join("settings.json"))
}

/// The saved settings. A missing or unreadable file gives the defaults. Unknown keys
/// (such as the old `open_mode`) are ignored.
fn read_settings() -> AppSettings {
    let path = match settings_path() {
        Ok(value) => value,
        Err(_) => return AppSettings::default(),
    };
    match fs::read_to_string(&path) {
        Ok(text) => serde_json::from_str::<AppSettings>(&text).unwrap_or_default(),
        Err(_) => AppSettings::default(),
    }
}

/// Apply a partial update (only the keys given) to the current settings.
pub fn merge_settings(
    current: &AppSettings,
    partial: serde_json::Value,
) -> Result<AppSettings, String> {
    let serde_json::Value::Object(changes) = partial else {
        return Err("A settings update must be an object".to_string());
    };
    let mut merged = serde_json::to_value(current).map_err(|error| error.to_string())?;
    if let serde_json::Value::Object(map) = &mut merged {
        for (key, value) in changes {
            map.insert(key, value);
        }
    }
    serde_json::from_value(merged).map_err(|error| format!("Invalid setting: {error}"))
}

fn write_settings(settings: &AppSettings) -> Result<(), String> {
    let path = settings_path()?;
    let parent = path.parent().ok_or_else(|| "Invalid settings path".to_string())?;
    fs::create_dir_all(parent)
        .map_err(|error| format!("Could not create settings folder: {error}"))?;
    let json = serde_json::to_string_pretty(settings)
        .map_err(|error| format!("Could not serialise settings: {error}"))?;
    crate::commands::write_atomically(&path, json.as_bytes())
        .map_err(|error| format!("Could not save settings: {error}"))
}

#[tauri::command]
pub fn load_settings() -> AppSettings {
    read_settings()
}

/// Change some settings and tell every window about the result.
#[tauri::command]
pub fn update_settings(
    app: AppHandle,
    partial: serde_json::Value,
) -> Result<AppSettings, String> {
    let _guard = WRITE_LOCK
        .lock()
        .map_err(|_| "Settings are busy, try again".to_string())?;
    let next = merge_settings(&read_settings(), partial)?;
    write_settings(&next)?;
    let _ = app.emit(SETTINGS_EVENT, &next);
    Ok(next)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn settings_json_round_trip() {
        let settings = AppSettings {
            theme: Theme::Light,
            view: View::Library,
            font_size: 20,
            last_folder: Some("C:/notes".to_string()),
            palette: Palette::Umber,
        };
        let json = serde_json::to_string(&settings).unwrap();
        let back: AppSettings = serde_json::from_str(&json).unwrap();
        assert_eq!(settings, back);
    }

    #[test]
    fn settings_defaults_are_dark_and_focus() {
        let settings = AppSettings::default();
        assert_eq!(settings.theme, Theme::Dark);
        assert_eq!(settings.view, View::Focus);
        assert_eq!(settings.font_size, 18);
        assert_eq!(settings.last_folder, None);
    }

    #[test]
    fn old_files_with_open_mode_still_load() {
        let json = r#"{"theme":"light","view":"focus","font_size":18,"last_folder":null,"open_mode":"window"}"#;
        let settings: AppSettings = serde_json::from_str(json).unwrap();
        assert_eq!(settings.theme, Theme::Light);
    }

    #[test]
    fn merge_changes_only_the_given_keys() {
        let current = AppSettings::default();
        let next = merge_settings(&current, serde_json::json!({ "theme": "light" })).unwrap();
        assert_eq!(next.theme, Theme::Light);
        assert_eq!(next.font_size, 18);
        assert_eq!(next.view, View::Focus);
    }

    #[test]
    fn merge_rejects_invalid_values() {
        let current = AppSettings::default();
        assert!(merge_settings(&current, serde_json::json!({ "theme": "neon" })).is_err());
        assert!(merge_settings(&current, serde_json::json!(["not", "an", "object"])).is_err());
    }

    #[test]
    fn defaults_use_the_graphite_palette() {
        assert_eq!(AppSettings::default().palette, Palette::Graphite);
    }

    #[test]
    fn a_file_without_a_palette_keeps_its_other_settings() {
        let json = r#"{"theme":"light","view":"library","font_size":20,"last_folder":"C:/notes"}"#;
        let settings: AppSettings = serde_json::from_str(json).unwrap();
        assert_eq!(settings.theme, Theme::Light);
        assert_eq!(settings.view, View::Library);
        assert_eq!(settings.font_size, 20);
        assert_eq!(settings.palette, Palette::Graphite);
    }

    #[test]
    fn merge_sets_the_palette_and_rejects_unknown_ones() {
        let current = AppSettings::default();
        let next = merge_settings(&current, serde_json::json!({ "palette": "ash" })).unwrap();
        assert_eq!(next.palette, Palette::Ash);
        assert!(merge_settings(&current, serde_json::json!({ "palette": "neon" })).is_err());
    }
}
