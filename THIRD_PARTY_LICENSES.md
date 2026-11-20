# Third-party licences

Snug is built on the open-source packages below. This list covers the packages Snug uses directly. Each package keeps its own licence, and the lock files (`package-lock.json` and `src-tauri/Cargo.lock`) list every package that is pulled in, including indirect ones.

The list is generated from the lock files and the installed packages. Regenerate it when dependencies change.

## JavaScript (npm) — runtime dependencies

| Package | Version | Licence |
|---|---|---|
| @codemirror/commands | 6.11.1 | MIT |
| @codemirror/lang-markdown | 6.5.2 | MIT |
| @codemirror/language | 6.13.1 | MIT |
| @codemirror/state | 6.7.6 | MIT |
| @codemirror/view | 6.43.15 | MIT |
| @lezer/highlight | 1.2.5 | MIT |
| @tauri-apps/api | 2.12.5 | Apache-2.0 OR MIT |
| @tauri-apps/plugin-dialog | 2.8.4 | MIT OR Apache-2.0 |
| dompurify | 3.4.18 | (MPL-2.0 OR Apache-2.0) |
| highlight.js | 11.12.0 | BSD-3-Clause |
| markdown-it | 15.0.3 | MIT |
| markdown-it-anchor | 10.1.0 | Unlicense |
| markdown-it-footnote | 4.0.0 | MIT |
| markdown-it-task-lists | 2.1.1 | ISC |
| react | 19.3.1 | MIT |
| react-dom | 19.3.1 | MIT |

## Rust (Cargo) — direct dependencies

| Crate | Version | Licence |
|---|---|---|
| dirs | 6.0.0 | MIT OR Apache-2.0 |
| serde | 1.0.229 | MIT OR Apache-2.0 |
| serde_json | 1.0.154 | MIT OR Apache-2.0 |
| tauri | 2.12.7 | Apache-2.0 OR MIT |
| tauri-build | 2.7.6 | Apache-2.0 OR MIT |
| tauri-plugin-dialog | 2.8.4 | Apache-2.0 OR MIT |
| tauri-plugin-single-instance | 2.5.5 | Apache-2.0 OR MIT |
