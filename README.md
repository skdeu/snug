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
- **+ Open note** (or Ctrl+O / Ctrl+T) opens another note as a tab, like a browser.
- Drag a tab along the strip to reorder it. Drag it off the window to make a new window, or onto another Snug window to move it there.
- Ctrl+W closes the current tab (closing the last tab closes the window). Ctrl+Tab and Ctrl+Shift+Tab move between tabs. Middle-click also closes a tab.
- Opening a `.md` file while Snug is already running adds it as a tab in the open window.
- Links to other `.md` notes open as tabs. Web links open in your browser. Other links are not followed.
- Ctrl+N opens a new, empty window.
- Snug remembers the windows and tabs you have open. Start it again and they come back, in the same places. A window you close while others are still open is forgotten. The last window is remembered when you close it, and notes that were deleted are skipped.
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

Stored as JSON under `%APPDATA%\Snug\settings.json` (theme, view, font size, last folder). Dark is the default.

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
