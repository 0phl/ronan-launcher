//! Showing, hiding and positioning the popup and the manager window.

use std::sync::Mutex;
use std::time::{Duration, Instant};

use tauri::{AppHandle, Emitter, Manager, PhysicalPosition, WebviewWindow};

pub const POPUP: &str = "popup";
pub const MANAGER: &str = "main";

static LAST_SHOWN: Mutex<Option<Instant>> = Mutex::new(None);

fn popup(app: &AppHandle) -> Option<WebviewWindow> {
    app.get_webview_window(POPUP)
}

/// Centers the popup horizontally on the monitor under the cursor, ~20% from the top.
fn position_popup(app: &AppHandle, win: &WebviewWindow) {
    let Ok(cursor) = app.cursor_position() else { return };
    let Ok(monitors) = win.available_monitors() else { return };
    let monitor = monitors.into_iter().find(|m| {
        let p = m.position();
        let s = m.size();
        cursor.x >= p.x as f64
            && cursor.x < (p.x + s.width as i32) as f64
            && cursor.y >= p.y as f64
            && cursor.y < (p.y + s.height as i32) as f64
    });
    let (Some(m), Ok(size)) = (monitor, win.outer_size()) else { return };
    let x = m.position().x + (m.size().width as i32 - size.width as i32) / 2;
    let y = m.position().y + (m.size().height as f64 * 0.2) as i32;
    let _ = win.set_position(PhysicalPosition::new(x, y));
}

pub fn show_popup(app: &AppHandle) {
    let Some(win) = popup(app) else { return };
    position_popup(app, &win);
    *LAST_SHOWN.lock().unwrap() = Some(Instant::now());
    let _ = win.show();
    // the first show of a process can inherit a "minimized" launch flag from its parent
    if win.is_minimized().unwrap_or(false) {
        let _ = win.unminimize();
    }
    let _ = win.set_focus();
    let _ = win.emit_to(POPUP, "popup:show", ());
}

pub fn hide_popup(app: &AppHandle) {
    if let Some(win) = popup(app) {
        let _ = win.hide();
    }
}

pub fn popup_visible(app: &AppHandle) -> bool {
    popup(app).and_then(|w| w.is_visible().ok()).unwrap_or(false)
}

pub fn toggle_popup(app: &AppHandle) {
    if popup_visible(app) {
        // let the UI play its closing animation, it calls hide_popup afterwards
        let _ = app.emit_to(POPUP, "popup:close", ());
    } else {
        show_popup(app);
    }
}

/// Ignore the blur that can happen while the popup is still being shown.
pub fn popup_just_shown() -> bool {
    LAST_SHOWN
        .lock()
        .unwrap()
        .map(|t| t.elapsed() < Duration::from_millis(250))
        .unwrap_or(false)
}

/// Shows the manager; `view` lets the UI jump somewhere ("settings", "new:ssh", "item:<id>").
pub fn show_manager(app: &AppHandle, view: Option<&str>) {
    let Some(win) = app.get_webview_window(MANAGER) else { return };
    let _ = win.show();
    // see show_popup: the first show can come up minimized
    let _ = win.unminimize();
    let _ = win.set_focus();
    if let Some(v) = view {
        let _ = win.emit_to(MANAGER, "manager:navigate", v.to_string());
    }
}
