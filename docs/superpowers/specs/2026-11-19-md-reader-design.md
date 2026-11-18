# Design: Windows native Markdown reader for SK

Date: 2026-11-19
Status: approved by SK on 2026-11-19, with amendments

**App name:** Snug — "a cozy home for your notes."
**Project location:** `the projects folder` is the collection root for SK's projects (folder name used exactly as he wrote it); this project lives in `the repository`. All source, assets and build output live there.

## Intent and the why

SK loves reading. Opening a `.md` file in Notepad or Visual Studio shows the raw markup — `#`, `**`, `-` — and he finds that confusing and exhausting; he stops wanting to read. The same text inside Claude's or GPT's native app renders as clean, well-spaced prose, and that is the experience he wants for his own files. The point of this app is **presentation**: it must feel like reading a clean article, with no raw syntax in the way. It is a Windows desktop app that becomes the default way to open `.md` files.

## Goals

- Double-click a `.md` file in Explorer and it opens in this app, rendered beautifully.
- Read-first: the rendered view is what appears on launch, every time.
- A pencil icon switches into edit mode; edits are saved back to the same file.
- Dark theme is the default. A light theme is available. A library view with a folder sidebar is available.
- Handle both "I opened one specific file" (the common case) and "I have a folder of notes to browse" (the secondary case).
- Stay small, fast, private and offline: no account, no cloud, no telemetry, no AI features.

## Non-goals (v1)

- Not a full Markdown IDE. No live side-by-side WYSIWYG editing, no plugins, no extensions marketplace.
- No collaboration, sync, sharing, publishing or accounts.
- No mobile, macOS or Linux builds in v1.
- No AI features inside the app.
- No need to create brand-new files from scratch — opening existing `.md` files is the job.

## Anti-goals (what would make this a failure even if it "worked")

- Showing raw Markdown syntax on launch, or making SK click into a preview to get the clean view.
- A heavy installer or slow start (the whole point is frictionless reading).
- Requiring the internet at runtime, or sending any note content anywhere.
- An edit mode that risks silently corrupting or overwriting a file.

## Constraints

- Windows 10/11. WebView2 is built into Windows 11; Windows 10 may need the runtime (the installer can bootstrap it).
- Build needs Rust (stable) and Node.js; SK builds and installs locally.
- Treat file content as untrusted input — a note must never be able to execute code in the app.
- Keep the installer small and the app offline.

## Decisions (made in this conversation)

These are settled; the builder does not need to revisit them.

1. **Stack:** Tauri 2 with a Rust backend, TypeScript + React + Vite frontend. Tauri uses Windows' own WebView2 renderer instead of bundling Chromium. Rust handles the filesystem and OS integration; TypeScript handles the UI. (Chosen by the agent with SK's approval of the choice.)
2. **Rendering:** `markdown-it` parses Markdown → `DOMPurify` sanitizes → app CSS styles the result. Raw HTML in notes is disabled (`html: false`) and a strict Content Security Policy is set. Code blocks use `highlight.js`, loaded only when needed.
3. **Editing:** a pencil button toggles from rendered view to a `CodeMirror 6` editor showing the raw Markdown. `Ctrl/Cmd+S` writes the file back via a Rust command. An unsaved-changes indicator and a confirm-on-close guard are required.
4. **Themes / views:** three selectable presentations — **Dark focus (default)**, **Light focus**, **Library** (folder sidebar + reader). Dark is the launch default and SK's favourite. All three ship in v1.
5. **Typography:** reading comfort is the product. Body around 17–19 px with ~1.7 line height, a measured column around 680–760 px, generous headings, comfortable dark palette (soft dark background, not pure black). SK can bump font size in settings.
6. **Opening files:** `.md` and `.markdown` file association, Explorer "Open with", drag-and-drop onto the window, and `Ctrl+O` file picker. The app accepts a file path as a launch argument from Explorer.
7. **Folder browsing:** a "Open folder" action populates the Library sidebar with the `.md` files in that folder; a small search box filters the list. The last folder is remembered.
8. **Persistence:** a local settings file stores theme/view, font size, and last folder. No cloud.
9. **Keyboard shortcuts:** `Ctrl+O` open file, `Ctrl+F` find in page, `Ctrl+S` save while editing, `Esc` exit edit mode, `Ctrl+B` toggle sidebar.
10. **Folder scan (agent's call):** the Library sidebar walks the chosen folder **recursively**, skipping common junk directories (`.git`, `node_modules`, `dist`, `bin`, `obj`, `.superpowers`). Search filters that list. A depth cap is fine if needed for performance.
11. **Local images (agent's call):** notes that reference relative images (e.g. `![img](./image.png)`) must display them. The Rust side resolves paths relative to the note's own folder and grants **scoped read access only** to that folder (or the opened library root). Remote URLs are not required in v1.
12. **WebView2 (agent's call, verified 2026-11-19):** SK's machine is Windows 10 Home with WebView2 runtime 157 already installed, so the installer does **not** bundle or download the runtime. If it is ever missing on another machine, the app shows a clear message pointing to Microsoft's WebView2 installer. The app itself stays fully offline.
13. **Document/session model (SK's call):** when a second `.md` file is opened while Snug is running, it opens in a **new window** by default. **New tab** is also supported as an additional selectable mode (a setting plus an "open in new tab" action), so the user can choose. Both modes need their own unsaved-changes guard and correct edit/save routing. Replacing the current document is not the default.
14. **Branding:** the app is called **Snug**, with a custom logo generated for it and stored under `the repository\assets\`. The name and logo are part of the product, not placeholders.

## What the builder decides

The following are left to the implementer's judgement unless SK says otherwise:

- Exact component/component-file structure and CSS design tokens.
- Which `markdown-it` plugins to enable beyond GFM tables, task lists and frontmatter display.
- Test framework and what is covered (parsing/sanitizing, file save round-trip, settings persistence).
- Exact CSP string and Tauri capability permissions (least privilege: only the filesystem scope actually needed).
- Installer/signing details and whether to also emit a portable `.exe`.
- Error message wording, empty-state copy, and how auto-reload-on-external-change behaves while editing.

## Nice-to-haves (only after the above works)

- Find in page with match highlighting.
- Word count in a status bar.
- Auto-reload when the file changes on disk (and a guard so it never clobbers unsaved edits).
- Copy as Markdown / copy as rich text.
- Print / export to PDF via the system dialog.
- Mermaid diagrams and KaTeX math.
- Task-list checkboxes that write back to the source.

## Acceptance sketch

- Install the app, set it as the default for `.md`, double-click a note → it opens in dark focus mode, fully rendered, in under a second.
- Switch to light and to library view; switching back to dark persists after restart.
- Click pencil, change a line, save, reopen → change is present in the file.
- Open a folder, pick a different note from the sidebar, search the list.
- A note containing `<script>` and a hostile link renders as inert text, not executable content.
