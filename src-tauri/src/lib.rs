mod commands;
mod settings;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .invoke_handler(tauri::generate_handler![
            commands::read_markdown,
            commands::write_markdown,
            commands::list_markdown_files,
            commands::resolve_local_asset,
            settings::load_settings,
            settings::save_settings,
        ])
        .run(tauri::generate_context!())
        .expect("error while running Snug");
}
