//! Brings the target window to the front and sends the paste keystroke.
//! Never sends Enter: the user always reviews a command before running it.

#[derive(Clone, Copy, Debug, PartialEq)]
pub enum PasteKey {
    CtrlV,
    ShiftInsert,
}

impl PasteKey {
    pub fn from_setting(s: &str) -> Self {
        if s == "shift+insert" { PasteKey::ShiftInsert } else { PasteKey::CtrlV }
    }
}

#[cfg(windows)]
mod imp {
    use super::PasteKey;
    use std::time::{Duration, Instant};
    use windows::Win32::Foundation::HWND;
    use windows::Win32::UI::Input::KeyboardAndMouse::{
        SendInput, INPUT, INPUT_0, INPUT_KEYBOARD, KEYBDINPUT, KEYBD_EVENT_FLAGS, KEYEVENTF_EXTENDEDKEY,
        KEYEVENTF_KEYUP, VIRTUAL_KEY, VK_CONTROL, VK_INSERT, VK_SHIFT, VK_V,
    };
    use windows::Win32::UI::WindowsAndMessaging::{
        GetForegroundWindow, IsIconic, SetForegroundWindow, ShowWindow, SW_RESTORE,
    };

    fn key(vk: VIRTUAL_KEY, up: bool) -> INPUT {
        let mut flags = KEYBD_EVENT_FLAGS(0);
        if up {
            flags |= KEYEVENTF_KEYUP;
        }
        if vk == VK_INSERT {
            flags |= KEYEVENTF_EXTENDEDKEY;
        }
        INPUT {
            r#type: INPUT_KEYBOARD,
            Anonymous: INPUT_0 {
                ki: KEYBDINPUT { wVk: vk, wScan: 0, dwFlags: flags, time: 0, dwExtraInfo: 0 },
            },
        }
    }

    /// Activate `raw` (while our process still owns the foreground, so Windows allows it).
    pub fn activate(raw: isize) {
        let hwnd = HWND(raw as *mut _);
        unsafe {
            if IsIconic(hwnd).as_bool() {
                let _ = ShowWindow(hwnd, SW_RESTORE);
            }
            let _ = SetForegroundWindow(hwnd);
        }
    }

    /// Wait (briefly) for `raw` to become the foreground window, then send the keystroke.
    pub fn send_paste(raw: isize, k: PasteKey) -> Result<(), String> {
        let hwnd = HWND(raw as *mut _);
        let deadline = Instant::now() + Duration::from_millis(400);
        while unsafe { GetForegroundWindow() } != hwnd {
            if Instant::now() > deadline {
                unsafe {
                    let _ = SetForegroundWindow(hwnd);
                }
                break;
            }
            std::thread::sleep(Duration::from_millis(15));
        }
        // Give the target a moment to finish activating before it receives keys.
        std::thread::sleep(Duration::from_millis(50));

        let (modifier, letter) = match k {
            PasteKey::CtrlV => (VK_CONTROL, VK_V),
            PasteKey::ShiftInsert => (VK_SHIFT, VK_INSERT),
        };
        let inputs = [key(modifier, false), key(letter, false), key(letter, true), key(modifier, true)];
        let sent = unsafe { SendInput(&inputs, std::mem::size_of::<INPUT>() as i32) };
        if sent as usize != inputs.len() {
            return Err("Windows blocked the paste keystroke (is the target app running as administrator?)".into());
        }
        Ok(())
    }
}

#[cfg(not(windows))]
mod imp {
    use super::PasteKey;
    pub fn activate(_raw: isize) {}
    pub fn send_paste(_raw: isize, _k: PasteKey) -> Result<(), String> {
        Err("auto-paste is only supported on Windows".into())
    }
}

pub use imp::{activate, send_paste};
