# Notes: Discover UI commit, push, and local installation

## Baseline

- Local branch: `main` at `e9e415a`, initially matching `origin/main` before refresh.
- Release branch: `codex/discover-ui-release`, created from the matching main baseline.
- Working tree contains only the two reviewed 2026-08-26 UI slices and their evidence.
- Target installed app: `/Users/dtjgp/Applications/TheRSS Dev.app`.
- Pre-install app metadata: `dev.dtjgp.therss` version `0.2.0`; pre-install `app.asar` SHA-256
  `fc1affef5c7c6afe7f9929b920b1341ed9a908c897d0a8dbf4a9deedb12386cc`.
- Release remains an unsigned personal beta; no Developer ID/notarization claim.

## Verification log

- `npm run check`: 57 files / 385 tests; coverage 90.42% statements, 80.80% branches, 93.49%
  functions, 93.29% lines; all builds passed.
- Electron E2E: 2/2 passed outside the restricted sandbox.
- `npm audit --audit-level=high`: zero vulnerabilities at the approved network boundary.
- Staged feature diff: 37 files, 1908 insertions / 288 deletions, including current-run screenshot
  evidence; no shared/core/main/preload/package diff.
- `git diff --cached --check` and scoped secret/debug scan passed.
- Product commit: `52c7bca750f354c30acb8e550f5c12db87548520`
  (`feat(ui): add Discover result workspace`).
- Remote branch: `origin/codex/discover-ui-release`; pre-push hook reran lint, typecheck, 57/385
  tests, and build successfully.
- Live remote refs before evidence commit:
  - `codex/discover-ui-release` -> `52c7bca750f354c30acb8e550f5c12db87548520`;
  - protected `main` -> `e9e415a0b9e485a9815f992f6cd3920509081b3c`.
- Installed app: `/Users/dtjgp/Applications/TheRSS Dev.app`, identifier `dev.dtjgp.therss`, version
  `0.2.0`, executable `TheRSS`.
- Release/installed `app.asar` SHA-256:
  `965e29105a807e1c218b8bd21dbaf91a9c567019ebe0ad9ea324cb39dd6957da`.
- Retained app backups:
  - `/Users/dtjgp/Applications/TheRSS Dev.backup-2026-08-26T14-03-06-687Z.app` — prior hash
    `fc1affef5c7c6afe7f9929b920b1341ed9a908c897d0a8dbf4a9deedb12386cc`;
  - `/Users/dtjgp/Applications/TheRSS Dev.backup-2026-08-26T14-03-25-611Z.app` — current-build hash
    `965e29105a807e1c218b8bd21dbaf91a9c567019ebe0ad9ea324cb39dd6957da`.
- SQLite backups:
  - `/Users/dtjgp/Library/Application Support/therss/backups/therss-2026-08-26T14-03-06-687Z.sqlite`;
  - `/Users/dtjgp/Library/Application Support/therss/backups/therss-2026-08-26T14-03-25-611Z.sqlite`.
- Current SQLite and both backups returned `PRAGMA integrity_check = ok` in immutable read-only mode.
- Installed package smoke passed, then the full installed-binary desktop E2E passed 1/1.
- Package remains unsigned because no valid Developer ID Application identity exists; this is the
  documented personal-beta boundary.
- GitHub PR creation was not performed: the connector required explicit PR authorization distinct
  from commit/install/push.
