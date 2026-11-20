# Changelog

All notable changes to Snug, newest first. Dates are the day the work was committed or built.

Version numbers: the `v1` and `v1.1` git tags kept `package.json` at `0.1.0`, and the installers built for them were `0.1.0`. From v1.2 on, `package.json`, `tauri.conf.json` and `Cargo.toml` carry the version number.

## [1.3.2] — built 2026-11-21 (not committed, not tagged)

### Changed
- The window is a floating glass frame inside the backdrop, as on the canvas. The backdrop shows around it.
- The palette dropdown is replaced by five colour swatches at the left of the toolbar. The dropdown rendered white on the dark window.
- Library, the theme switch and Open share one bordered group, as on the canvas.
- The chrome has no fill of its own now. It sits on the window's glass.
- The toolbar wraps on a narrow window instead of clipping.
- Version 1.3.2 in all version files. README updated.

### Known gaps
- The Edit button stays on each note's own bar, not the top bar, because each tab keeps its own edit mode.
- The app still starts in the focus view. The canvas showed the library open.

## [1.3.1] — built 2026-11-20 (not committed, not tagged)

### Added
- Colour picker in the toolbar, with five palettes: Graphite and sage (default), Harbor teal, Umber and brass, Slate and ice, and Ash and rose. Each works in dark and light. The choice is saved in `settings.json` as `palette`.
- `palette` setting in `settings.json`. A file from before this version loads with Graphite, and its other settings are kept.

### Changed
- Version 1.3.1 in all version files. README updated.
- The palette data lives in `src/lib/palettes.ts`. The app sets the tokens on its window, so the choice applies everywhere.

### Known gaps
- Same as 1.3.0.

## [1.3.0] — built and installed 2026-11-20 (not committed, not tagged)

### Added
- In-app glass look. The window paints a soft backdrop, and the tab strip, toolbar, sidebar, find bar and notices sit on blurred glass. A solid fallback is used where `backdrop-filter` is not supported.
- Graphite and sage palette, in dark and light. It is the only palette in the app.
- Token layer in `src/styles/tokens.css`: colours, glass, focus and radii. The old literal `rgba(127, 127, 160, …)` values are gone.
- Icons (`src/components/Icon.tsx`) replace the text glyphs. The toolbar is a grouped bar (`src/components/Toolbar.tsx`).
- Notices (`src/components/Notice.tsx`): error and information cards, each with a × button. Clicking the card also dismisses it. "Changed on disk" is an information notice.
- `dismissNotice` in `useDocument`, so a notice can be hidden without touching the note or its draft.
- Reader: styled tables with a header row, footnotes, task-list checkboxes in the accent colour, links, inline and block code, and selection colour.
- Editor: CodeMirror theme and Markdown syntax colours from the tokens.
- Tests: tokens and contrast, glass, chrome (icon, tabs, toolbar), notice, editor, reader theme, version. Vitest goes from 66 to 95 tests.

### Changed
- Tabs have `role="tab"` and `aria-selected`. The Library button has `aria-pressed`.
- Active-tab text uses the main text colour. Muted text fails the 4.5:1 contrast rule on that surface.
- Dependencies: `@codemirror/language` and `@lezer/highlight` are direct dependencies now. Both were already installed as dependencies of other packages.
- Version 1.3.0 in `package.json`, `package-lock.json`, `src-tauri/Cargo.toml`, `src-tauri/Cargo.lock` and `src-tauri/tauri.conf.json`.
- README: install line and Use section updated for the glass look.

### Known gaps
- The meta line under the note title (edited date, reading time) is not built. It is not part of the Markdown.
- The Save button in edit mode is still text only.
- The glass has not been checked on the installed app yet. The look was checked in a browser preview only.
- Not tested on Windows 10.
- The README says the installer registers `.md` files to open in Snug. After the install I found no Snug registration under the user's file types, so this may be wrong.

## [1.2.0] — built and installed 2026-11-20 (not committed, not tagged)

### Added
- The main window keeps its saved place and size. It used to always open maximized.
- The maximized state is remembered per window. Restoring the window returns it to its last normal size.
- Unsaved text is kept as a draft while you type, in the `drafts/` folder of the data directory. After a crash, the text comes back in its tab, marked unsaved.
- If a file changed on disk while a draft existed, the draft is kept as a numbered `<name>.recovered-<key>.md` file beside the note, and a notice shows its full path.

### Changed
- Version 1.2.0 in all version files. README updated.
- Sessions saved by v1.1 still load. The new `maximized` field is optional.
- Closing a window or tab with unsaved edits still asks first, as before.

### Fixed (from review)
- Discarding a restored draft now removes it, so it no longer comes back after a relaunch.
- A failed discard keeps the window or tab open, with a notice.
- A keep-aside never overwrites an earlier recovered file.

### Known gaps
- Two windows showing the same note share one draft file. The last write wins.
- Closing one window while others are open forgets that window. Only the last window closed is remembered. This follows the README rule.

## [1.1] — git tag `v1.1`, commit `2a54259`, 2026-11-20 (package version still 0.1.0)

### Added
- A tab released away from its tab strip tears off into a new window. This also works when it is released inside the same window, as in Chrome.

## [1.0] — git tag `v1`, commit `27e53e1`, 2026-11-20 (package version still 0.1.0)

### Added
- Chrome-style tabs, with drag to reorder.
- Tear-off windows.
- Session restore: the windows and tabs you had open reopen on the next start.

## [0.1.0] — first build, 2026-11-19

### Added
- Tauri app scaffold, with Markdown rendering, a dark and light reader view, a notes library sidebar, pencil edit mode, persisted settings, native file and folder dialogs, and a new-window launch.
- Snug logo and Windows icons, and the Windows file-association setting in the Tauri config.
- Fixes: BOM stripping, a single launch tab, tab overflow, heading spacing, and review fixes for save guards, safe rendering, window size and a visible Save button.
- README.

Commits: `02c1e0d` to `afef41f`, plus `cf2aa80` (README) and `25d1574` (ignore installed output).
