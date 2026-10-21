mod commands;
mod db;
mod dpapi;
mod export;
mod focus;
mod hotkey;
mod paste;
#[path = "windows.rs"]
mod app_windows;

use std::sync::Mutex;

use tauri::menu::{Menu, MenuItem, PredefinedMenuItem};
use tauri::tray::{MouseButton, MouseButtonState, TrayIconBuilder, TrayIconEvent};
use tauri::{Manager, WindowEvent};
use tauri_plugin_global_shortcut::ShortcutState;

use commands::{AppState, Settings};

fn build_tray(app: &tauri::App) -> tauri::Result<()> {
    let menu = Menu::with_items(
        app,
        &[
            &MenuItem::with_id(app, "launcher", "Open Launcher", true, None::<&str>)?,
            &MenuItem::with_id(app, "manager", "Open Library", true, None::<&str>)?,
            &MenuItem::with_id(app, "settings", "Settings…", true, None::<&str>)?,
            &PredefinedMenuItem::separator(app)?,
            &MenuItem::with_id(app, "quit", "Quit Ronan Launcher", true, None::<&str>)?,
        ],
    )?;
    TrayIconBuilder::with_id("main")
        .icon(app.default_window_icon().cloned().expect("missing app icon"))
        .tooltip("Ronan Launcher")
        .menu(&menu)
        .show_menu_on_left_click(false)
        .on_menu_event(|app, event| match event.id().as_ref() {
            "launcher" => app_windows::show_popup(app),
            "manager" => app_windows::show_manager(app, None),
            "settings" => app_windows::show_manager(app, Some("settings")),
            "quit" => app.exit(0),
            _ => {}
        })
        .on_tray_icon_event(|tray, event| {
            if let TrayIconEvent::Click { button: MouseButton::Left, button_state: MouseButtonState::Up, .. } = event {
                app_windows::show_manager(tray.app_handle(), None);
            }
        })
        .build(app)?;
    Ok(())
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        // must be first: a second launch just brings the library window forward
        .plugin(tauri_plugin_single_instance::init(|app, _args, _cwd| {
            app_windows::show_manager(app, None);
        }))
        .plugin(
            tauri_plugin_global_shortcut::Builder::new()
                .with_handler(|app, _shortcut, event| {
                    if event.state() == ShortcutState::Pressed {
                        focus::remember_current();
                        app_windows::toggle_popup(app);
                    }
                })
                .build(),
        )
        .plugin(tauri_plugin_autostart::init(
            tauri_plugin_autostart::MacosLauncher::LaunchAgent,
            Some(vec!["--hidden"]),
        ))
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_clipboard_manager::init())
        .setup(|app| {
            let handle = app.handle().clone();
            let data_dir = commands::data_dir(&handle);
            std::fs::create_dir_all(&data_dir)?;
            let conn = db::open(&data_dir.join("data.db"))?;
            let settings = Settings::from_map(&db::get_settings(&conn)?);

            let hotkey_error = hotkey::apply(&handle, &settings.hotkey, None).err();
            if let Err(e) = commands::apply_autostart(&handle, settings.autostart) {
                eprintln!("autostart: {e}");
            }
            app.manage(AppState {
                db: Mutex::new(conn),
                settings: Mutex::new(settings),
                data_dir,
                hotkey_error: Mutex::new(hotkey_error.clone()),
            });

            focus::install();
            build_tray(app)?;

            let started_hidden = std::env::args().any(|a| a == "--hidden");
            if !started_hidden || hotkey_error.is_some() {
                app_windows::show_manager(&handle, hotkey_error.as_ref().map(|_| "settings"));
            }
            Ok(())
        })
        .on_window_event(|window, event| match (window.label(), event) {
            // closing the library just hides it; the app lives in the tray
            (app_windows::MANAGER, WindowEvent::CloseRequested { api, .. }) => {
                api.prevent_close();
                let _ = window.hide();
            }
            (app_windows::POPUP, WindowEvent::Focused(false)) => {
                if !app_windows::popup_just_shown() {
                    let _ = window.hide();
                }
            }
            _ => {}
        })
        .invoke_handler(tauri::generate_handler![
            commands::get_settings,
            commands::save_settings,
            commands::list_items,
            commands::list_folders,
            commands::save_item,
            commands::delete_item,
            commands::move_item,
            commands::get_secret,
            commands::save_folder,
            commands::delete_folder,
            commands::paste_text,
            commands::copy_secret,
            commands::hide_popup,
            commands::show_manager,
            commands::export_data,
            commands::import_data,
        ])
        .run(tauri::generate_context!())
        .expect("error while running Ronan Launcher");
}
