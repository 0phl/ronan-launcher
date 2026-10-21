# Ronan Launcher

A Windows tray app that keeps your SSH connections, snippets and runbook notes one shortcut away.
Press **Ctrl+Shift+Space** anywhere, type a few letters (`ronan`), press **Enter**, and the command
is pasted into the window you were just in: Windows Terminal, PuTTY, Notepad, anything.

## Features

- **SSH servers**: host, user, port, identity file and an optional password. The `ssh …` command is generated for you, or you can write your own.
- **Snippets**: single commands or multi-line Linux scripts, with syntax highlighting and notes.
- **Runbook notes**: headings and text, plus command blocks with **Copy** and **>_ Paste** buttons. In the launcher, press → or Tab on a note to pick one of its commands.
- **Folders, tags and favorites**: frequently and recently used items rank higher in search.
- **Never presses Enter**: pasted commands always wait for you to review them.
- **Local only**: data lives in `%APPDATA%\com.ronan.launcher\data.db`. Passwords are encrypted with your Windows account (DPAPI).
- **Export / Import**: a password-protected `.ronan` file (Argon2id + AES-256-GCM) moves your library to another PC. Import can merge (newer edits win) or replace (a backup is made first).
- Light and dark themes, Mica/Acrylic translucency, a customizable shortcut, and start with Windows.

## Launcher keys

| Key | Action |
| --- | --- |
| `Enter` | Paste into the previous window |
| `Shift+Enter` | Copy only |
| `→` / `Tab` | Open a note's commands (`←` to go back) |
| `Ctrl+P` | Copy the server's password (cleared from the clipboard after 30 s) |
| `Ctrl+E` | Edit in the library |
| `Ctrl+N` | New item |
| `Esc` | Close |

## Development

Requirements: Node 20+, Rust (stable, MSVC), Visual Studio Build Tools with the C++ workload, WebView2.

```sh
npm install
npm run tauri dev      # run the app with hot reload
npm test               # frontend unit tests (vitest)
cd src-tauri && cargo test   # backend tests: storage, merge, DPAPI, export crypto
npm run tauri build    # installer in src-tauri/target/release/bundle/nsis/
```

Layout: `src/popup` (launcher), `src/manager` (library window), `src/lib` (search, markdown, API),
`src-tauri/src` (`db.rs` storage, `export.rs` encryption, `focus.rs` + `paste.rs` auto-paste,
`hotkey.rs`, `windows.rs`, `commands.rs`).
