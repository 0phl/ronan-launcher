//! Global shortcut that toggles the popup. Stored as text like "Ctrl+Shift+Space".

use tauri::AppHandle;
use tauri_plugin_global_shortcut::{GlobalShortcutExt, Shortcut};

pub const DEFAULT_HOTKEY: &str = "Ctrl+Shift+Space";

pub fn parse(s: &str) -> Result<Shortcut, String> {
    s.parse::<Shortcut>().map_err(|e| format!("\"{s}\" is not a valid shortcut: {e}"))
}

/// Registers `new`, replacing whatever was registered before. If `new` can't be
/// registered (e.g. another app owns it), `fallback` is restored and an error is returned.
pub fn apply(app: &AppHandle, new: &str, fallback: Option<&str>) -> Result<(), String> {
    let gs = app.global_shortcut();
    let shortcut = parse(new)?;
    let _ = gs.unregister_all();
    match gs.register(shortcut) {
        Ok(()) => Ok(()),
        Err(e) => {
            if let Some(old) = fallback.and_then(|f| parse(f).ok()) {
                let _ = gs.register(old);
            }
            Err(format!(
                "Couldn't use {new}. It's probably already used by another app ({e})."
            ))
        }
    }
}
