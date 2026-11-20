# Contributing to Snug

Thanks for taking the time to help. Snug is a small app, so focused changes are the easiest to review.

## Before you start

- For a bug, open an issue first if there isn't one already, so we can agree on the cause.
- For a larger feature or a change in behaviour, open an issue to discuss it before writing code.
- Do not include private notes, personal file paths or account details in issues, pull requests or test data. Use made-up notes.

## Set up

You need Windows 10 or 11, Node.js 22 (LTS), Rust (stable, MSVC toolchain), Visual Studio Build Tools with the C++ workload, and the WebView2 Runtime.

```powershell
npm ci
npm run tauri dev
```

## Checks

Run these before opening a pull request. CI runs the same checks on Windows.

```powershell
npm run build
npm test
cargo test --manifest-path src-tauri/Cargo.toml
```

## Making a change

- Add or update tests for any behaviour you change. Tests live in `tests/` (Vitest) and in the Rust modules (`cargo test`).
- Keep the Rust and TypeScript split as it is: window and session logic in `src-tauri/src`, UI in `src`.
- Colours and surfaces come from the tokens in `src/styles/tokens.css`. Don't add literal colours to component styles.
- Keep dependencies to a minimum. Explain in the pull request why a new one is needed.
- For a user-visible change, add a line to `CHANGELOG.md` under an "Unreleased" heading.
- For a visual change, include a screenshot in the pull request.

## Commit messages and pull requests

- Use short, imperative commit messages with a type prefix, such as `feat:`, `fix:`, `docs:`, `test:` or `chore:`.
- One topic per pull request. Describe what changed and why, and how you checked it.
- A pull request can be merged once CI passes and a maintainer has reviewed it.

## Licence of contributions

By submitting a contribution, you agree that it is licensed under the same licence as the project (see [LICENSE](LICENSE)).

## Conduct

Everyone taking part is expected to follow the [Code of Conduct](CODE_OF_CONDUCT.md).
