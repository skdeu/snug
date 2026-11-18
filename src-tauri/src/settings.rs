use std::fs;
use std::path::PathBuf;

use serde::{Deserialize, Serialize};

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
pub enum OpenMode {
    Window,
    Tab,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct AppSettings {
    pub theme: Theme,
    pub view: View,
    pub font_size: u32,
    pub last_folder: Option<String>,
    pub open_mode: OpenMode,
}

impl Default for AppSettings {
    fn default() -> Self {
        Self {
            theme: Theme::Dark,
            view: View::Focus,
            font_size: 18,
            last_folder: None,
            open_mode: OpenMode::Window,
        }
    }
}

pub fn settings_path() -> Result<PathBuf, String> {
    let base = dirs::config_dir()
        .or_else(dirs::data_dir)
        .ok_or_else(|| "Could not find a settings directory".to_string())?;
    Ok(base.join("Snug").join("settings.json"))
}

#[tauri::command]
pub fn load_settings() -> AppSettings {
    let path = match settings_path() {
        Ok(value) => value,
        Err(_) => return AppSettings::default(),
    };
    let text = match fs::read_to_string(&path) {
        Ok(value) => value,
        Err(_) => return AppSettings::default(),
    };
    match serde_json::from_str::<AppSettings>(&text) {
        Ok(settings) => settings,
        Err(_) => AppSettings::default(),
    }
}

#[tauri::command]
pub fn save_settings(settings: AppSettings) -> Result<(), String> {
    let path = settings_path()?;
    let parent = path.parent().ok_or_else(|| "Invalid settings path".to_string())?;
    fs::create_dir_all(parent).map_err(|error| format!("Could not create settings folder: {error}"))?;
    let json = serde_json::to_string_pretty(&settings)
        .map_err(|error| format!("Could not serialise settings: {error}"))?;
    fs::write(&path, json).map_err(|error| format!("Could not save settings: {error}"))
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
            open_mode: OpenMode::Tab,
        };
        let json = serde_json::to_string(&settings).unwrap();
        let back: AppSettings = serde_json::from_str(&json).unwrap();
        assert_eq!(settings, back);
    }

    #[test]
    fn settings_defaults_are_dark_and_window() {
        let settings = AppSettings::default();
        assert_eq!(settings.theme, Theme::Dark);
        assert_eq!(settings.view, View::Focus);
        assert_eq!(settings.font_size, 18);
        assert_eq!(settings.open_mode, OpenMode::Window);
        assert_eq!(settings.last_folder, None);
    }
}
