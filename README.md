# Snug

A cozy home for your notes. Snug is a small Windows desktop app that opens `.md` files into a clean, dark-by-default reading view — no raw `#` or `**` in your face. When you need to change something, click the pencil, edit, and save.

## Install

Run `src-tauri/target/release/bundle/nsis/Snug_0.1.0_x64-setup.exe` (2.57 MB). It installs per user to `the current user app folder` by default and registers `.md` / `.markdown` files to open in Snug. Windows 11 includes WebView2; Windows 10 needs the WebView2 runtime (already present on this machine).

To set as default: right-click any `.md` file → Open with → choose Snug → set as default.

## Use

- Double-click a `.md` file — it opens in a new window, rendered, in dark mode.
- **✎ Edit** switches to the Markdown editor. `Ctrl+S` saves, `Esc` exits (prompts if unsaved).
- **▤ Library** shows the notes folder; **Open folder…** loads another folder of notes.
- **⌕ Open** picks a single file with the native file dialog.
- **+ New tab** opens a note as a tab. Change `open_mode` in settings to `tab` to make tabs the default instead of new windows.
- Drag a `.md` file onto the window to open it.

## Keyboard shortcuts

| Key | Action |
|---|---|
| `Ctrl+O` | Open a file |
| `Ctrl+F` | Find in note |
| `Ctrl+S` | Save while editing |
| `Esc` | Leave edit mode |
| `Ctrl+B` | Toggle the library sidebar |

## Settings

Stored as JSON under `%APPDATA%\Snug\settings.json` (theme, view, font size, last folder, open mode). Dark is the default.

## Build from source

Requires Node.js, Rust, and Visual Studio Build Tools with the C++ workload.

```powershell
npm install
cmd /c '"C:\Program Files (x86)\Microsoft Visual Studio\2022\BuildTools\VC\Auxiliary\Build\vcvars64.bat" && npm run tauri build'
```

Tests: `npm test` (frontend) and `cargo test --manifest-path src-tauri/Cargo.toml` (Rust).

## Design and plan

- `docs/superpowers/specs/2026-11-19-md-reader-design.md`
- `docs/superpowers/plans/2026-11-19-snug-reader.md`
