# Snug Markdown Reader Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build Snug, a Windows desktop app that opens `.md` files into a clean, dark-by-default reading view, with an optional pencil edit mode, a notes library, new-window and new-tab opening, and a real installer.

**Architecture:** Tauri 2 gives a small Rust binary plus a React/TypeScript frontend rendered in Windows' WebView2. Rust owns the filesystem, settings, window management and OS integration; TypeScript owns rendering, themes and UI state. Markdown is parsed with `markdown-it`, sanitized with DOMPurify, and styled with app CSS — no raw syntax ever appears in the reading view.

**Tech Stack:** Rust (stable) + Tauri 2, TypeScript + React 19 + Vite 6, markdown-it 14, DOMPurify 3, highlight.js 11, CodeMirror 6, Vitest 3, NSIS installer.

**Spec:** `the repository\docs\superpowers\specs\2026-11-19-md-reader-design.md`

## Global Constraints

- App name is **Snug**; all project files live under `the repository`. Logo source is `the repository\assets\snug-logo.svg`.
- Windows 10/11 only. WebView2 runtime is already present on the target machine (verified: runtime 157) — do **not** bundle or download it.
- Dark theme is the launch default; light theme and library view are selectable and persisted.
- Fully offline at runtime: no accounts, no cloud, no telemetry, no remote calls.
- Markdown renderer: `markdown-it` with `html: false`, then `DOMPurify.sanitize`, then a strict CSP in `tauri.conf.json`.
- File access is least-privilege: Tauri capabilities scope the filesystem to the opened file's folder / chosen library root. Local relative images must render; paths escaping that scope must be rejected.
- Double-clicking a `.md` while Snug runs opens a **new window** by default; **new tab** is an additional selectable mode.
- No paid models, services or subscriptions are introduced anywhere in this project.
- TypeScript strict mode is on. Every task commits when its tests pass.

## Review Focus

These are the inputs and failure modes most likely to hurt a reader that the task tests below must pin down. Each line names the owning task's test.

1. **Hostile note content** (`<script>`, `javascript:` / `data:` links, inline event handlers) must render as inert text, never execute — pinned by Task 3's `sanitizes_script_and_javascript_links`.
2. **Relative asset path escaping** (`![x](../../secret.png)`, absolute paths) must be rejected before an `asset://` URL is built — pinned by Task 3's `rejects_escaping_and_absolute_asset_paths` and Task 2's `resolve_local_asset_rejects_parent_escape`.
3. **Unsaved edits must never vanish silently** — closing a window/tab, switching notes, or exiting edit mode with dirty content must prompt — pinned by Task 7's `dirty_exit_requires_confirmation` and Task 8's `tab_close_blocks_when_dirty`.
4. **Recursive folder scanning** with nested folders, `.git`, `node_modules` and symlink loops must terminate and exclude junk — pinned by Task 2's `list_markdown_files_walks_nested_and_skips_junk` and `list_markdown_files_handles_symlink_loop`.
5. **Missing, unreadable or non-UTF-8 files** must produce a clear error, not a crash or mojibake — pinned by Task 2's `read_markdown_rejects_invalid_utf8` and `read_markdown_reports_missing_file`.

---

### Task 1: Scaffold the Tauri + React project and a blank Snug window

**Files:**
- Create: `the repository\package.json`, `tsconfig.json`, `vite.config.ts`, `index.html`, `src/main.tsx`, `src/App.tsx`, `src/styles/base.css`, `src-tauri/Cargo.toml`, `src-tauri/build.rs`, `src-tauri/tauri.conf.json`, `src-tauri/src/main.rs`, `src-tauri/src/lib.rs`, `src-tauri/capabilities/default.json`, `.gitignore`

**Interfaces:**
- Produces: a runnable dev shell — `npm run tauri dev` opens a window titled `Snug` with a dark background. No app features yet.

- [ ] **Step 1: Initialise the frontend and Rust project**

Run in `the repository`: `npm create vite@latest . -- --template react-ts`, then `npm install`, then `npm install -D @tauri-apps/cli@2` and `npm install @tauri-apps/api@2`. Add `tauri = { version = "2", features = [] }`, `serde`, `serde_json` to `src-tauri/Cargo.toml`. Run `npm run tauri init` with app name `Snug`, window title `Snug`, dev URL `http://localhost:5173`.

- [ ] **Step 2: Set the project identity and dark baseline**

In `src-tauri/tauri.conf.json` set `productName: "Snug"`, `identifier: "com.snug.reader"`, and a strict CSP (`script-src 'self'`, `style-src 'self' 'unsafe-inline'`, `img-src 'self' asset: http: https: data:`, `object-src 'none'`, `base-uri 'self'`). In `src/styles/base.css` set `body { background:#151922; color:#e6e9f0; }` and import it from `src/main.tsx`.

- [ ] **Step 3: Initialise git and ignore build output**

Run `git init` in `the repository`. Add `.gitignore` covering `node_modules/`, `dist/`, `src-tauri/target/`, `.superpowers/`. Commit: `chore: scaffold Snug Tauri app`.

- [ ] **Step 4: Verify the window opens**

Run `npm run tauri dev`. Expected: a window titled `Snug` appears with a dark background and no errors in the terminal.

---

### Task 2: Rust backend — file I/O, folder scan, asset path guard

**Files:**
- Create: `src-tauri/src/commands.rs` (with inline `#[cfg(test)] mod tests`)
- Modify: `src-tauri/src/lib.rs` (register commands via `generate_handler!`)

**Interfaces:**
- Produces these `#[tauri::command]` functions (all errors are human-readable `String`s):
  - `read_markdown(path: String) -> Result<String, String>`
  - `write_markdown(path: String, contents: String) -> Result<(), String>`
  - `list_markdown_files(folder: String) -> Result<Vec<String>, String>` — paths relative to `folder`, sorted, `.md`/`.markdown` only, recursive, excludes `.git`, `node_modules`, `dist`, `bin`, `obj`, `.superpowers`, and does not follow symlink directories.
  - `resolve_local_asset(note_path: String, reference: String) -> Result<String, String>` — absolute path of a reference relative to the note's folder; rejects absolute references and any path that escapes the note's folder.

- [ ] **Step 1: Write the failing Rust tests**

In `src-tauri/src/commands.rs`, write inline tests with these exact assertions:
- `read_markdown_reports_missing_file`: `read_markdown(nonexistent)` → `Err` containing `not found`.
- `read_markdown_rejects_invalid_utf8`: file containing `[0xFF, 0xFE]` → `Err` containing `UTF-8`.
- `write_markdown_round_trip`: write `"# hi\n"` then read → equal.
- `list_markdown_files_walks_nested_and_skips_junk`: temp folder with `a.md`, `nested/b.md`, `.git/x.md`, `node_modules/y.md`, `notes.txt` → `vec!["a.md", "nested/b.md"]`.
- `list_markdown_files_handles_symlink_loop`: a symlink pointing back to the root → returns normally, does not recurse forever.
- `resolve_local_asset_rejects_parent_escape`: note `notes/a.md`, ref `../secret.png` → `Err`.
- `resolve_local_asset_resolves_sibling`: note `notes/a.md`, ref `img/p.png` → `Ok(<root>/notes/img/p.png)`.

Use `std::env::temp_dir()` with unique names and delete each fixture at the end.

- [ ] **Step 2: Run the tests and verify they fail**

Run `cargo test --manifest-path src-tauri/Cargo.toml -p snug`. Expected: compile fails or tests fail because the command functions do not exist yet.

- [ ] **Step 3: Implement the four commands**

Implement each signature above. Use `std::fs` with explicit UTF-8 handling (`String::from_utf8` with a clear error). Use a manual stack-based directory walk with a visited-path set for the symlink guard. Commit message: `feat: rust file and folder commands`.

- [ ] **Step 4: Run the tests and verify they pass**

Run the same `cargo test` command. Expected: all 7 tests PASS.

---

### Task 3: Markdown rendering pipeline (safe, clean, local images)

**Files:**
- Create: `src/lib/markdown.ts`, `src/lib/assets.ts`, `tests/markdown.test.ts`
- Modify: `package.json` (add `markdown-it`, `dompurify`, `highlight.js`, `markdown-it-anchor`, `markdown-it-footnote`, `markdown-it-task-lists`, and their `@types`)

**Interfaces:**
- Consumes: nothing from Task 2 in tests (the asset resolver is injected).
- Produces:
  - `renderMarkdown(source: string, options: { baseDir: string; resolveAsset: (reference: string) => string }): string` — sanitized HTML string.
  - `assetUrl(baseDir: string, reference: string): string` — in `src/lib/assets.ts`; rejects absolute paths and any `..` segment, otherwise returns a Tauri `convertFileSrc` URL.

- [ ] **Step 1: Write the failing Vitest tests**

In `tests/markdown.test.ts`, with `resolveAsset` stubbed as `(r) => 'asset://test/' + r`:
- `renders_common_markdown`: `# Hi`, `**bold**`, and a GFM table produce an `<h1>`, `<strong>`, and `<table>` in the returned HTML.
- `renders_task_list_and_footnote`: `- [ ] todo` and a `[^1]` reference produce `<input type="checkbox"` and a footnote section.
- `sanitizes_script_and_javascript_links`: `<script>alert(1)</script>` and `[x](javascript:alert(1))` produce neither `<script` nor `javascript:` in the output.
- `rejects_escaping_and_absolute_asset_paths`: `![x](../../secret.png)` and `![y](/etc/passwd)` cause the injected resolver to be called with a rejected value — assert `assetUrl('C:/notes', '../../secret.png')` throws and `assetUrl('C:/notes', 'C:/secret.png')` throws.
- `highlights_fenced_code`: a ```ts fence produces a `hljs` class on the `<code>` element.

- [ ] **Step 2: Run the tests and verify they fail**

Run `npx vitest run tests/markdown.test.ts`. Expected: FAIL — modules do not exist.

- [ ] **Step 3: Implement the pipeline**

`markdown.ts`: create a `markdown-it` instance with `{ html: false, linkify: true, typographer: true }`, register the plugins, override the image renderer to call `options.resolveAsset`, run `highlight.js` on fenced code, then `DOMPurify.sanitize(html, { USE_PROFILES: { html: true } })` with `javascript:`/`data:` URIs forbidden. `assets.ts`: pure path check before calling `convertFileSrc`. Commit: `feat: safe markdown rendering`.

- [ ] **Step 4: Run the tests and verify they pass**

Run the same Vitest command. Expected: all 5 tests PASS.

---

### Task 4: Theme system and the reading view

**Files:**
- Create: `src/styles/tokens.css`, `src/styles/themes.css`, `src/styles/reader.css`, `src/components/Reader.tsx`, `tests/Reader.test.tsx`
- Modify: `src/App.tsx`

**Interfaces:**
- Consumes: `renderMarkdown` from Task 3.
- Produces: `export type Theme = 'dark' | 'light'`; `<Reader source: string; baseDir: string; theme: Theme; fontSize: number />` which renders the sanitized HTML inside `<article class="snug-reader">`.

- [ ] **Step 1: Write the failing component test**

In `tests/Reader.test.tsx` (React Testing Library + jsdom): `applies_dark_theme_by_default` — render `<Reader source="# Hello" baseDir="" theme="dark" fontSize={18} />`; assert `document.querySelector('.snug-reader')` exists, contains an `<h1>` with `Hello`, and the root has the `theme-dark` class.

- [ ] **Step 2: Run the test and verify it fails**

Run `npx vitest run tests/Reader.test.tsx`. Expected: FAIL — module missing.

- [ ] **Step 3: Implement theme tokens and Reader**

`tokens.css`: `--reader-max-width: 720px`, `--reader-line-height: 1.7`, `--reader-font-size` driven by the `fontSize` prop. `themes.css`: `.theme-dark` with soft dark background `#151922` and light text; `.theme-light` with warm off-white. `reader.css`: heading scale, blockquote rail, code block surface, table borders, generous spacing. Commit: `feat: dark/light reader view`.

- [ ] **Step 4: Run the test and verify it passes**

Run the same test command. Expected: PASS.

---

### Task 5: Settings persistence

**Files:**
- Create: `src-tauri/src/settings.rs` (with inline tests), `src/lib/settings.ts`, `tests/settings.test.ts`
- Modify: `src-tauri/src/lib.rs`, `src-tauri/Cargo.toml` (add `dirs` crate)

**Interfaces:**
- Consumes: nothing.
- Produces:
  - Rust: `load_settings() -> AppSettings`, `save_settings(settings: AppSettings) -> Result<(), String>`; `AppSettings { theme: Theme, view: View, font_size: u32, last_folder: Option<String>, open_mode: OpenMode }` serialised as JSON under `%APPDATA%\Snug\settings.json`.
  - TypeScript: `export type Theme = 'dark' | 'light'`, `export type View = 'focus' | 'library'`, `export type OpenMode = 'window' | 'tab'`; `getSettings(): Promise<AppSettings>`, `updateSettings(partial: Partial<AppSettings>): Promise<AppSettings>` with defaults merged.

- [ ] **Step 1: Write failing tests**

Rust inline: `settings_json_round_trip` — serialise an `AppSettings`, deserialise it, assert equality; `settings_defaults_are_dark_and_window` — `AppSettings::default()` gives `theme=dark`, `open_mode=window`, `view=focus`, `font_size=18`. Vitest: `update_settings_merges_defaults` — `updateSettings({ theme: 'light' })` returns defaults with `theme` changed only.

- [ ] **Step 2: Run tests and verify they fail**

Run `cargo test --manifest-path src-tauri/Cargo.toml` and `npx vitest run tests/settings.test.ts`. Expected: FAIL.

- [ ] **Step 3: Implement settings**

Define the `AppSettings` struct with serde defaults, JSON file read/write with a clear error if corrupt, and the frontend wrapper that merges with defaults. Commit: `feat: persisted settings`.

- [ ] **Step 4: Run tests and verify they pass**

Run both commands. Expected: all PASS.

---

### Task 6: Library sidebar (folder of notes)

**Files:**
- Create: `src/components/LibrarySidebar.tsx`, `tests/LibrarySidebar.test.tsx`
- Modify: `src/App.tsx`

**Interfaces:**
- Consumes: `list_markdown_files` (Task 2) via the invoke wrapper, `AppSettings.last_folder` (Task 5).
- Produces: `<LibrarySidebar files: string[]; selected: string | null; onSelect: (relativePath: string) => void; onOpenFolder: () => void />`.

- [ ] **Step 1: Write the failing test**

`filters_files_case_insensitively`: render with `['Weekly.md','ideas.md','READING.md']`, type `read` in the search box, assert only `READING.md` is visible. `shows_nested_path`: assert `nested/note.md` renders as text.

- [ ] **Step 2: Run and verify failure**

`npx vitest run tests/LibrarySidebar.test.tsx` → FAIL.

- [ ] **Step 3: Implement the sidebar**

Render a search input, a file list with click-to-select, and an "Open folder…" button that calls the Rust folder picker command and `list_markdown_files`. Persist the chosen folder through `updateSettings`. Commit: `feat: notes library sidebar`.

- [ ] **Step 4: Run and verify pass**

Same command → PASS.

---

### Task 7: Pencil edit mode with dirty guard

**Files:**
- Create: `src/components/Editor.tsx`, `src/hooks/useDocument.ts`, `tests/useDocument.test.ts`
- Modify: `src/App.tsx`, `src/components/Reader.tsx` (add the pencil button)

**Interfaces:**
- Consumes: `read_markdown`, `write_markdown` (Task 2), `renderMarkdown` (Task 3).
- Produces: `useDocument(initialPath: string) -> { source: string; setSource: (s: string) => void; dirty: boolean; save: () => Promise<void>; loading: boolean }`; `<Editor value: string; onChange: (s: string) => void; onSave: () => void; onExit: () => void />`.

- [ ] **Step 1: Write failing tests**

- `save_clears_dirty`: start with source `a`, call `setSource('b')` → `dirty === true`; `await save()` → `dirty === false` and the mocked `write_markdown` received the new text.
- `dirty_exit_requires_confirmation`: with `dirty === true`, calling `onExit` after a mocked `window.confirm` returns `false` must keep edit mode active.

- [ ] **Step 2: Run and verify failure**

`npx vitest run tests/useDocument.test.ts` → FAIL.

- [ ] **Step 3: Implement edit mode**

Build the CodeMirror 6 editor with Markdown language support; wire the pencil button to switch `Reader` → `Editor`, `Ctrl+S` to `save()`, `Esc` to a guarded exit, and a visible "Unsaved" badge when dirty. Commit: `feat: pencil edit mode`.

- [ ] **Step 4: Run and verify pass**

Same command → PASS.

---

### Task 8: Window and tab session model

**Files:**
- Create: `src-tauri/src/windows.rs` (inline tests), `src/lib/session.ts`, `tests/session.test.ts`
- Modify: `src-tauri/src/main.rs` / `lib.rs`, `src/App.tsx`

**Interfaces:**
- Consumes: `OpenMode` from Task 5.
- Produces:
  - Rust: `parse_launch_args(args: Vec<String>) -> Option<String>` — returns the `.md` path passed by Explorer; `open_note_window(path: String) -> Result<(), String>` using Tauri `WebviewWindow`.
  - TypeScript: a tab reducer `sessionReducer(state: SessionState, action: SessionAction) -> SessionState` with `SessionState { tabs: Tab[]; activeId: string }`, `Tab { id: string; path: string; dirty: boolean }` and actions `open`, `select`, `close`, `markDirty`, `markSaved`.

- [ ] **Step 1: Write failing tests**

Rust: `parse_launch_args_finds_md_path` — `["snug", "C:\\notes\\a.md"]` → `Some("C:\\notes\\a.md")`; `parse_launch_args_ignores_flags` — `["snug", "--flag"]` → `None`. Vitest: `open_in_window_mode_creates_new_window_action`, `tab_close_blocks_when_dirty` — closing a tab whose `dirty` is `true` returns state unchanged.

- [ ] **Step 2: Run and verify failure**

Run both test commands → FAIL.

- [ ] **Step 3: Implement session handling**

On startup read CLI args and open the note in a new window. When a second file is opened, respect `open_mode`: `window` → `open_note_window`; `tab` → dispatch `open` to the reducer. Closing a window or tab with a dirty document calls the Task 7 guard. Add an "Open in new tab" menu action. Commit: `feat: new-window default and optional tabs`.

- [ ] **Step 4: Run and verify pass**

Run both commands → PASS.

---

### Task 9: Windows integration and app icon

**Files:**
- Modify: `src-tauri/tauri.conf.json`, `src-tauri/capabilities/default.json`, `src/App.tsx`, `package.json`
- Create: `tools/make-icons.mjs`

**Interfaces:**
- Consumes: `snug-logo.svg` (already in `assets/`).
- Produces: `.md`/`.markdown` file association and `Open with Snug` shell entry; drag-and-drop file opening; keyboard shortcuts `Ctrl+O`, `Ctrl+F`, `Ctrl+S`, `Esc`, `Ctrl+B`; generated `src-tauri/icons/*`.

- [ ] **Step 1: Generate icons from the SVG**

Add `sharp` as a dev dependency. Write `tools/make-icons.mjs` that reads `assets/snug-logo.svg`, renders 512/256/128/64/32/16 PNGs and a Windows `.ico`, then run `npx tauri icon` on the 512 PNG to fill `src-tauri/icons/`. Commit icons plus the script: `feat: Snug logo and Windows icons`.

- [ ] **Step 2: Register file association and OS integration**

In `tauri.conf.json` add `fileAssociations` for extensions `md`, `markdown`, description `Markdown document`, and NSIS registry entries for the "Open with Snug" context menu. In `capabilities/default.json` declare the `asset` protocol scope and filesystem scope limited to the opened folder / library root. Wire Tauri's file-drop event to open the dropped `.md` according to `open_mode`. Commit: `feat: Windows file association and drag-drop`.

- [ ] **Step 3: Wire keyboard shortcuts**

`Ctrl+O` file picker, `Ctrl+F` find-in-page, `Ctrl+S` save (edit mode), `Esc` leave edit mode, `Ctrl+B` toggle sidebar. Verify manually in `npm run tauri dev`.

---

### Task 10: Build, package and end-to-end verification

**Files:**
- Modify: `README.md` (create it: install, set as default, shortcuts, settings)
- No new source files.

**Interfaces:**
- Consumes: all previous tasks.

- [ ] **Step 1: Build the release installer**

Run `npm run tauri build`. Expected: NSIS installer and a portable `.exe` under `src-tauri/target/release/bundle/`, no Rust or TypeScript errors.

- [ ] **Step 2: Install and exercise the acceptance path**

Install the NSIS build, set Snug as the default for `.md`, then confirm on this machine:
1. Double-click a sample note → opens in dark focus mode, fully rendered, under a second.
2. Switch to light and to library; restart → dark returns as default unless changed.
3. Pencil → edit a line → `Ctrl+S` → reopen → the change is in the file.
4. Double-click a second note → new window; enable tab mode → a second note opens as a tab.
5. Open a folder → nested notes appear; search filters them.
6. A note with `<script>` and a hostile link renders inert.

- [ ] **Step 3: Commit the release notes**

Commit README and version bump: `chore: Snug v1 release`.

---

## Self-review notes

- Spec coverage: all 14 design decisions are assigned — stack (T1), rendering (T3), edit mode (T7), three views and dark default (T4, T5, T6), typography (T4), opening files (T8, T9), folder browsing (T2, T6), persistence (T5), shortcuts (T9), folder scan (T2), local images (T2, T3, T9), WebView2 (T1, T10), session model (T8), branding (T1, T9).
- Each Review Focus line has a test in its owning task.
- Deferred to a later plan: find-in-page highlighting beyond the shortcut, word count, auto-reload, copy-as-Markdown, PDF export, Mermaid, KaTeX, writable task checkboxes.
