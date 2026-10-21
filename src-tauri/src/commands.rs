//! Tauri commands exposed to the UI.

use std::collections::HashMap;
use std::path::PathBuf;
use std::sync::Mutex;
use std::time::Duration;

use rusqlite::Connection;
use serde::{Deserialize, Serialize};
use tauri::{AppHandle, Emitter, Manager, State};
use tauri_plugin_autostart::ManagerExt as _;
use tauri_plugin_clipboard_manager::ClipboardExt;

use crate::app_windows;
use crate::db::{self, Folder, ImportStats, Item, ItemInput};
use crate::export::{self, ExportData};
use crate::focus;
use crate::hotkey;
use crate::paste::{self, PasteKey};

pub struct AppState {
    pub db: Mutex<Connection>,
    pub settings: Mutex<Settings>,
    pub data_dir: PathBuf,
    pub hotkey_error: Mutex<Option<String>>,
}

type Res<T> = Result<T, String>;

fn err<E: std::fmt::Display>(e: E) -> String {
    e.to_string()
}

fn data_changed(app: &AppHandle) {
    let _ = app.emit("data:changed", ());
}

// ---------- settings ----------

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct Settings {
    pub hotkey: String,
    /// "system" | "light" | "dark"
    pub theme: String,
    /// "auto" (paste into the previous window) | "copy"
    pub paste_mode: String,
    /// "ctrl+v" | "shift+insert"
    pub paste_key: String,
    pub restore_clipboard: bool,
    pub autostart: bool,
}

impl Settings {
    pub fn from_map(m: &HashMap<String, String>) -> Self {
        let get = |k: &str, d: &str| m.get(k).cloned().unwrap_or_else(|| d.to_string());
        Settings {
            hotkey: get("hotkey", hotkey::DEFAULT_HOTKEY),
            theme: get("theme", "system"),
            paste_mode: get("paste_mode", "auto"),
            paste_key: get("paste_key", "ctrl+v"),
            restore_clipboard: get("restore_clipboard", "true") == "true",
            // dev builds don't register themselves to start with Windows by default
            autostart: get("autostart", if cfg!(debug_assertions) { "false" } else { "true" }) == "true",
        }
    }

    fn save(&self, conn: &Connection) -> rusqlite::Result<()> {
        db::set_setting(conn, "hotkey", &self.hotkey)?;
        db::set_setting(conn, "theme", &self.theme)?;
        db::set_setting(conn, "paste_mode", &self.paste_mode)?;
        db::set_setting(conn, "paste_key", &self.paste_key)?;
        db::set_setting(conn, "restore_clipboard", &self.restore_clipboard.to_string())?;
        db::set_setting(conn, "autostart", &self.autostart.to_string())
    }
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct SettingsView {
    settings: Settings,
    hotkey_error: Option<String>,
    data_dir: String,
}

#[tauri::command]
pub fn get_settings(state: State<AppState>) -> SettingsView {
    SettingsView {
        settings: state.settings.lock().unwrap().clone(),
        hotkey_error: state.hotkey_error.lock().unwrap().clone(),
        data_dir: state.data_dir.display().to_string(),
    }
}

pub fn apply_autostart(app: &AppHandle, on: bool) -> Res<()> {
    let al = app.autolaunch();
    let enabled = al.is_enabled().unwrap_or(false);
    if on && !enabled {
        al.enable().map_err(err)?;
    } else if !on && enabled {
        al.disable().map_err(err)?;
    }
    Ok(())
}

#[tauri::command]
pub fn save_settings(app: AppHandle, state: State<AppState>, settings: Settings) -> Res<Settings> {
    let old = state.settings.lock().unwrap().clone();
    if settings.hotkey != old.hotkey || state.hotkey_error.lock().unwrap().is_some() {
        hotkey::apply(&app, &settings.hotkey, Some(&old.hotkey))?;
        *state.hotkey_error.lock().unwrap() = None;
    }
    if settings.autostart != old.autostart {
        apply_autostart(&app, settings.autostart)?;
    }
    settings.save(&state.db.lock().unwrap()).map_err(err)?;
    *state.settings.lock().unwrap() = settings.clone();
    let _ = app.emit("settings:changed", settings.clone());
    Ok(settings)
}

// ---------- items & folders ----------

#[tauri::command]
pub fn list_items(state: State<AppState>) -> Res<Vec<Item>> {
    db::list_items(&state.db.lock().unwrap()).map_err(err)
}

#[tauri::command]
pub fn list_folders(state: State<AppState>) -> Res<Vec<Folder>> {
    db::list_folders(&state.db.lock().unwrap()).map_err(err)
}

#[tauri::command]
pub fn save_item(app: AppHandle, state: State<AppState>, item: ItemInput) -> Res<Item> {
    let saved = db::save_item(&state.db.lock().unwrap(), item)?;
    data_changed(&app);
    Ok(saved)
}

#[tauri::command]
pub fn delete_item(app: AppHandle, state: State<AppState>, id: String) -> Res<()> {
    db::delete_item(&state.db.lock().unwrap(), &id).map_err(err)?;
    data_changed(&app);
    Ok(())
}

#[tauri::command]
pub fn move_item(app: AppHandle, state: State<AppState>, id: String, folder_id: Option<String>) -> Res<()> {
    db::move_item(&state.db.lock().unwrap(), &id, folder_id).map_err(err)?;
    data_changed(&app);
    Ok(())
}

#[tauri::command]
pub fn get_secret(state: State<AppState>, id: String) -> Res<Option<String>> {
    db::get_secret(&state.db.lock().unwrap(), &id)
}

#[tauri::command]
pub fn save_folder(
    app: AppHandle,
    state: State<AppState>,
    id: Option<String>,
    name: String,
    parent_id: Option<String>,
) -> Res<Folder> {
    let f = db::save_folder(&state.db.lock().unwrap(), id, name.trim(), parent_id).map_err(err)?;
    data_changed(&app);
    Ok(f)
}

#[tauri::command]
pub fn delete_folder(app: AppHandle, state: State<AppState>, id: String) -> Res<()> {
    db::delete_folder(&state.db.lock().unwrap(), &id).map_err(err)?;
    data_changed(&app);
    Ok(())
}

// ---------- paste / clipboard ----------

/// Result of a paste request, so the UI can show the right toast.
#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub enum PasteOutcome {
    Pasted,
    Copied,
    /// Auto-paste was requested but there's no window to paste into.
    CopiedNoTarget,
}

#[tauri::command]
pub async fn paste_text(
    app: AppHandle,
    state: State<'_, AppState>,
    text: String,
    item_id: Option<String>,
    copy_only: bool,
) -> Res<PasteOutcome> {
    if let Some(id) = &item_id {
        db::mark_used(&state.db.lock().unwrap(), id).map_err(err)?;
        data_changed(&app);
    }
    let settings = state.settings.lock().unwrap().clone();
    let auto = !copy_only && settings.paste_mode == "auto";
    let previous = if auto && settings.restore_clipboard {
        app.clipboard().read_text().ok()
    } else {
        None
    };
    app.clipboard().write_text(text.clone()).map_err(err)?;

    let target = if auto { focus::last_external() } else { None };
    let Some(raw) = target else {
        app_windows::hide_popup(&app);
        return Ok(if auto { PasteOutcome::CopiedNoTarget } else { PasteOutcome::Copied });
    };

    // Activate the target while we still own the foreground, then hide the popup.
    paste::activate(raw);
    app_windows::hide_popup(&app);
    let key = PasteKey::from_setting(&settings.paste_key);
    tauri::async_runtime::spawn_blocking(move || paste::send_paste(raw, key))
        .await
        .map_err(err)??;

    if let Some(prev) = previous {
        let app = app.clone();
        tauri::async_runtime::spawn(async move {
            tokio_sleep(Duration::from_millis(500)).await;
            // only restore if nothing else touched the clipboard meanwhile
            if app.clipboard().read_text().ok().as_deref() == Some(text.as_str()) {
                let _ = app.clipboard().write_text(prev);
            }
        });
    }
    Ok(PasteOutcome::Pasted)
}

async fn tokio_sleep(d: Duration) {
    let _ = tauri::async_runtime::spawn_blocking(move || std::thread::sleep(d)).await;
}

/// Copies an item's password; it's wiped from the clipboard after 30 s if still there.
#[tauri::command]
pub async fn copy_secret(app: AppHandle, state: State<'_, AppState>, id: String) -> Res<bool> {
    let secret = db::get_secret(&state.db.lock().unwrap(), &id)?;
    let Some(secret) = secret else { return Ok(false) };
    app.clipboard().write_text(secret.clone()).map_err(err)?;
    let app2 = app.clone();
    tauri::async_runtime::spawn(async move {
        tokio_sleep(Duration::from_secs(30)).await;
        if app2.clipboard().read_text().ok().as_deref() == Some(secret.as_str()) {
            let _ = app2.clipboard().write_text(String::new());
        }
    });
    Ok(true)
}

// ---------- windows ----------

#[tauri::command]
pub fn hide_popup(app: AppHandle) {
    app_windows::hide_popup(&app);
}

#[tauri::command]
pub fn show_manager(app: AppHandle, view: Option<String>) {
    app_windows::hide_popup(&app);
    app_windows::show_manager(&app, view.as_deref());
}

// ---------- export / import ----------

const PORTABLE_SETTINGS: &[&str] = &["theme", "paste_mode", "paste_key", "restore_clipboard"];

#[tauri::command]
pub fn export_data(state: State<AppState>, path: String, password: String) -> Res<usize> {
    if password.len() < 4 {
        return Err("Use a password with at least 4 characters.".into());
    }
    let conn = state.db.lock().unwrap();
    let items = db::export_items(&conn)?;
    let count = items.len();
    let settings = db::get_settings(&conn)
        .map_err(err)?
        .into_iter()
        .filter(|(k, _)| PORTABLE_SETTINGS.contains(&k.as_str()))
        .collect();
    let data = ExportData {
        app: "ronan-launcher".into(),
        exported_at: db::now(),
        folders: db::list_folders(&conn).map_err(err)?,
        items,
        settings,
    };
    let bytes = export::encode(&data, &password)?;
    std::fs::write(&path, bytes).map_err(|e| format!("Couldn't write {path}: {e}"))?;
    Ok(count)
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ImportResult {
    #[serde(flatten)]
    stats: ImportStats,
    backup: Option<String>,
}

#[tauri::command]
pub fn import_data(
    app: AppHandle,
    state: State<AppState>,
    path: String,
    password: String,
    replace: bool,
) -> Res<ImportResult> {
    let bytes = std::fs::read(&path).map_err(|e| format!("Couldn't read {path}: {e}"))?;
    let data = export::decode(&bytes, &password)?;

    let mut conn = state.db.lock().unwrap();
    let backup = if replace {
        let dir = state.data_dir.join("backups");
        std::fs::create_dir_all(&dir).map_err(err)?;
        let file = dir.join(format!("backup-{}.db", chrono::Local::now().format("%Y%m%d-%H%M%S")));
        conn.execute("VACUUM INTO ?1", [file.display().to_string()]).map_err(err)?;
        Some(file.display().to_string())
    } else {
        None
    };

    let stats = db::import(&mut conn, &data.folders, &data.items, replace)?;
    if replace {
        for (k, v) in data.settings.iter().filter(|(k, _)| PORTABLE_SETTINGS.contains(&k.as_str())) {
            db::set_setting(&conn, k, v).map_err(err)?;
        }
        let settings = Settings::from_map(&db::get_settings(&conn).map_err(err)?);
        *state.settings.lock().unwrap() = settings.clone();
        let _ = app.emit("settings:changed", settings);
    }
    drop(conn);
    data_changed(&app);
    Ok(ImportResult { stats, backup })
}

pub fn data_dir(app: &AppHandle) -> PathBuf {
    app.path().app_data_dir().expect("no app data dir")
}
