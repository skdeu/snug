<p align="center">
  <img src="src-tauri/icons/icon-256.png" width="128" alt="Snug logo">
</p>

# Snug

A cozy home for your notes. Snug is a small Windows app that opens Markdown (`.md`) files in a clean reading view, with no raw `#` or `**` in the way. When you want to change something, click **Edit**, change it, and save.

## Features

- **Reading view** for `.md` and `.markdown` files, in a dark or light theme.
- **Tabs like a browser.** Drag to reorder, tear a tab off into its own window, or drop it onto another Snug window.
- **Session restore.** Your windows, tabs and their positions come back after a restart.
- **Unsaved text survives a crash.** Text is kept as you type and comes back, marked as unsaved, after Snug closes unexpectedly.
- **Library sidebar** for a folder of notes.
- **Editor** with Markdown colours. `Ctrl+S` saves and `Esc` leaves edit mode.
- **Five colour palettes**, with Graphite and sage as the default.
- **Glass look.** The window floats over a soft backdrop.
- **Private by design.** Snug opens files on your computer. It has no accounts, no cloud sync and no telemetry. Web links open in your own browser.

## Install

Download the installer `Snug_<version>_x64-setup.exe` from the project's releases. The installer sets Snug up for your Windows user account and does not need administrator rights.

Snug needs the Microsoft Edge WebView2 runtime. Windows 11 includes it. On Windows 10, install the WebView2 Runtime if Snug does not start.

The installer lists `.md` and `.markdown` as file types that Snug can open. If Windows does not offer Snug, right-click a `.md` file, choose **Open with**, pick Snug and tick **Always**.

> Releases are not published yet. Until then, build the installer from source (below).

## Use

- Double-click a `.md` file to open it in a window.
- **Edit** switches to the Markdown editor. `Ctrl+S` saves and `Esc` leaves edit mode. If you have unsaved changes, Snug asks first.
- **Library** shows the notes folder. **Open folder…** loads another folder.
- **Open** picks a file with the normal file dialog. **+ Open note** (or `Ctrl+O` / `Ctrl+T`) opens another note as a tab.
- Drag a tab along the strip to reorder it. Drag it away from the strip to make a new window.
- `Ctrl+W` closes the current tab, and closing the last tab closes the window. `Ctrl+Tab` and `Ctrl+Shift+Tab` move between tabs. Middle-click also closes a tab.
- `Ctrl+N` opens a new, empty window.
- Links to other `.md` notes open as tabs. Web links open in your browser. Other links are not followed.
- If a file changed on disk while you had unsaved edits, Snug keeps your edits as a draft `.md` file next to the note, and a notice shows its path.
- **Colour** in the toolbar picks one of five palettes: Graphite and sage (the default), Harbor teal, Umber and brass, Slate and ice, or Ash and rose.

## Keyboard shortcuts

| Key | Action |
|---|---|
| `Ctrl+O` / `Ctrl+T` | Open a file as a tab |
| `Ctrl+N` | New window |
| `Ctrl+W` | Close the current tab |
| `Ctrl+Tab` / `Ctrl+Shift+Tab` | Next / previous tab |
| `Ctrl+F` | Find in note |
| `Ctrl+B` | Show or hide the library |
| `Ctrl+S` | Save while editing |
| `Esc` | Leave edit mode |

## Where Snug keeps your data

Snug stores its files in `%APPDATA%\Snug`:

- `settings.json`: theme, view, font size, last folder and palette;
- `session.json`: the windows and tabs to restore;
- `drafts\`: unsaved text, while it has not been saved.

Set the `SNUG_DATA_DIR` environment variable to use a different folder. This is useful for test builds, so they don't touch your real settings.

## Build from source

You need:

- Windows 10 or 11, with the WebView2 Runtime;
- Node.js 22 (LTS);
- Rust (stable, MSVC toolchain);
- Visual Studio Build Tools with the **Desktop development with C++** workload.

```powershell
npm ci
npm run tauri dev
```

To build the installer, run the build from a shell where the Visual Studio C++ tools are set up. Change the path to `vcvars64.bat` if your Visual Studio is installed somewhere else:

```powershell
cmd /c '"C:\Program Files (x86)\Microsoft Visual Studio\2022\BuildTools\VC\Auxiliary\Build\vcvars64.bat" && npm run tauri build'
```

The installer is written to `src-tauri\target\release\bundle\nsis\`.

## Tests

```powershell
npm test                                         # frontend (Vitest)
npm run build                                    # type check and build the web app
cargo test --manifest-path src-tauri/Cargo.toml  # Rust
```

CI runs the same checks on Windows for every push and pull request.

## Project layout

- `src/`: the React interface. `App.tsx` is the window, `components/` the parts, `hooks/` the document logic, `lib/` helpers, `styles/` the CSS and its colour tokens.
- `src-tauri/`: the Rust backend. It handles windows, sessions, drafts, settings, and file and folder commands.
- `tests/`: frontend tests.
- `docs/`: the design notes and implementation plans that shaped each version.
- `assets/`: the logo sources.
- `tools/`: a script that generates the app icons.

## Contributing

Bug reports, ideas and pull requests are welcome. Please read [CONTRIBUTING.md](CONTRIBUTING.md) first. Security problems should be reported privately, as described in [SECURITY.md](SECURITY.md). Everyone taking part follows the [Code of Conduct](CODE_OF_CONDUCT.md).

## Changelog

Version history is in [CHANGELOG.md](CHANGELOG.md).

## Licence

Snug is licensed under the [Apache License, Version 2.0](LICENSE). You may use, copy, change and share it, including for commercial purposes, as long as you keep the copyright notice in [NOTICE](NOTICE) and state any changes you make.

Snug is built on open-source packages, each with its own licence. They are listed in [THIRD_PARTY_LICENSES.md](THIRD_PARTY_LICENSES.md).

## Credits

Snug was created by Sanjaykumar Sagadevan Vijayakumar.
