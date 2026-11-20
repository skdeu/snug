mod commands;
mod drafts;
mod session;
mod settings;
mod windows;

use tauri::Manager;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    // Remember the file this app was launched with, and last run's windows, before any window exists.
    windows::remember_launch_note(std::env::args().collect());
    session::load_at_startup();

    tauri::Builder::default()
        // Registered first: a second launch hands its file to this instance and exits.
        .plugin(tauri_plugin_single_instance::init(|app, args, _cwd| {
            windows::forward_launch(app, args)
        }))
        .plugin(tauri_plugin_dialog::init())
        .on_window_event(|window, event| match event {
            // Where a window is matters for the next launch, so every move and resize is kept.
            tauri::WindowEvent::Moved(_) | tauri::WindowEvent::Resized(_) => {
                session::remember_bounds(window, false);
            }
            // Written at once, so the position just before a close is kept.
            tauri::WindowEvent::CloseRequested { .. } => session::remember_bounds(window, true),
            tauri::WindowEvent::Destroyed => {
                windows::window_destroyed(window.app_handle(), window.label());
            }
            _ => {}
        })
        .invoke_handler(tauri::generate_handler![
            commands::read_markdown,
            commands::write_markdown,
            commands::list_markdown_files,
            commands::resolve_local_asset,
            commands::allow_asset_folder,
            commands::open_external,
            settings::load_settings,
            settings::update_settings,
            windows::take_launch_note,
            windows::drop_tab,
            windows::new_window,
            session::save_session,
            session::restore_session,
            session::take_pending_session,
            drafts::write_draft,
            drafts::read_draft,
            drafts::delete_draft,
            drafts::keep_draft_aside,
        ])
        .setup(|app| {
            session::settle_startup(app.handle());
            if let Some(main) = app.get_webview_window("main") {
                windows::place_main(app.handle(), &main, session::main_plan());
                // Always shown, even if placement failed: the window starts hidden.
                let _ = main.show();
            }
            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running Snug");
}
