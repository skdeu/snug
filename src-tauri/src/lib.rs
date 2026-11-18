mod commands;
mod settings;
mod windows;

use tauri::Manager;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .setup(|app| {
            let args: Vec<String> = std::env::args().collect();
            windows::remember_launch_note(args.clone());
            if let Some(path) = windows::parse_launch_args(args) {
                let _ = windows::open_note_window(app.handle().clone(), path);
                if let Some(main) = app.get_webview_window("main") {
                    let _ = main.close();
                }
            }
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            commands::read_markdown,
            commands::write_markdown,
            commands::list_markdown_files,
            commands::resolve_local_asset,
            settings::load_settings,
            settings::save_settings,
            windows::get_launch_note,
            windows::open_note_window_cmd,
        ])
        .run(tauri::generate_context!())
        .expect("error while running Snug");
}
