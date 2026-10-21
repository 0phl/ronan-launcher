//! Remembers the last foreground window that belongs to another app (terminal,
//! editor, ...). Pasting always targets that window, whether it's triggered from
//! the popup or from a ">_" button in the manager.

use std::sync::atomic::{AtomicIsize, Ordering};

static LAST_EXTERNAL: AtomicIsize = AtomicIsize::new(0);

#[cfg(windows)]
mod imp {
    use super::LAST_EXTERNAL;
    use std::sync::atomic::Ordering;
    use windows::Win32::Foundation::HWND;
    use windows::Win32::UI::Accessibility::{SetWinEventHook, HWINEVENTHOOK};
    use windows::Win32::UI::WindowsAndMessaging::{
        GetClassNameW, GetForegroundWindow, GetWindowThreadProcessId, IsWindow, IsWindowVisible,
        EVENT_SYSTEM_FOREGROUND, WINEVENT_OUTOFCONTEXT, WINEVENT_SKIPOWNPROCESS,
    };

    /// Shell surfaces that should never become a paste target.
    const IGNORED_CLASSES: &[&str] = &[
        "Shell_TrayWnd",
        "Shell_SecondaryTrayWnd",
        "Progman",
        "WorkerW",
        "NotifyIconOverflowWindow",
        "TopLevelWindowForOverflowXamlIsland",
        "Windows.UI.Core.CoreWindow",
        "XamlExplorerHostIslandWindow",
        "ForegroundStaging",
        "MultitaskingViewFrame",
        "TaskListThumbnailWnd",
    ];

    fn class_name(hwnd: HWND) -> String {
        let mut buf = [0u16; 256];
        let n = unsafe { GetClassNameW(hwnd, &mut buf) };
        String::from_utf16_lossy(&buf[..n.max(0) as usize])
    }

    fn consider(hwnd: HWND) {
        if hwnd.0.is_null() {
            return;
        }
        let mut pid = 0u32;
        unsafe { GetWindowThreadProcessId(hwnd, Some(&mut pid)) };
        if pid == std::process::id() || !unsafe { IsWindowVisible(hwnd) }.as_bool() {
            return;
        }
        if IGNORED_CLASSES.contains(&class_name(hwnd).as_str()) {
            return;
        }
        LAST_EXTERNAL.store(hwnd.0 as isize, Ordering::SeqCst);
    }

    unsafe extern "system" fn on_foreground(
        _hook: HWINEVENTHOOK,
        _event: u32,
        hwnd: HWND,
        _id_object: i32,
        _id_child: i32,
        _thread: u32,
        _time: u32,
    ) {
        consider(hwnd);
    }

    /// Must run on a thread with a message loop (the Tauri main thread).
    pub fn install() {
        consider(unsafe { GetForegroundWindow() });
        unsafe {
            SetWinEventHook(
                EVENT_SYSTEM_FOREGROUND,
                EVENT_SYSTEM_FOREGROUND,
                None,
                Some(on_foreground),
                0,
                0,
                WINEVENT_OUTOFCONTEXT | WINEVENT_SKIPOWNPROCESS,
            );
        }
    }

    pub fn remember_current() {
        consider(unsafe { GetForegroundWindow() });
    }

    pub fn is_alive(raw: isize) -> bool {
        unsafe { IsWindow(Some(HWND(raw as *mut _))) }.as_bool()
    }
}

#[cfg(not(windows))]
mod imp {
    pub fn install() {}
    pub fn remember_current() {}
    pub fn is_alive(_raw: isize) -> bool {
        false
    }
}

pub use imp::{install, remember_current};

/// Raw HWND of the last external window, if it still exists.
pub fn last_external() -> Option<isize> {
    let raw = LAST_EXTERNAL.load(Ordering::SeqCst);
    (raw != 0 && imp::is_alive(raw)).then_some(raw)
}
