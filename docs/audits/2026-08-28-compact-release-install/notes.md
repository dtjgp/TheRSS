# Notes: Compact Release and Local Install

## Git Evidence

- Initial state: `main` at `743a6c8`, matching the last fetched `origin/main` with divergence 0/0.
- Remote: `https://github.com/dtjgp/TheRSS.git`.
- Current tree is the cumulative approved UI/workflow work: repository-local taste adapter and
  audits, Discover run pipeline F1-F4, secondary action contract F9, and Compact Settings F6.
- Prototype screenshots under `output/playwright/settings-density-prototype/` total about 420 KB
  and are the evidence referenced by the F6 contract.

## Installation Evidence

- Active bundle: `/Users/dtjgp/Applications/TheRSS Dev.app`, identifier `dev.dtjgp.therss`, version
  `0.2.0`, `app.asar` SHA-256
  `80d54e0b63fb900fa2b536c3fb9b72681fbe248edd6fde9b047feeb24d246005`.
- Existing superseded bundle: `/Users/dtjgp/Applications/TheRSS
Dev.backup-2026-08-26T14-03-25-611Z.app`, same identifier/version, `app.asar` SHA-256
  `965e29105a807e1c218b8bd21dbaf91a9c567019ebe0ad9ea324cb39dd6957da`.
- The current release artifact matches the active app before rebuilding, proving the installer has
  not yet received this worktree's new package.
- `install-local-beta.mjs` verifies the source bundle, validates and backs up SQLite, copies with
  `ditto`, validates Electron framework links and hashes, atomically renames the previous active app
  into a timestamped backup, and writes an install receipt.

## Deletion Boundary

- After a successful replacement and installed-app smoke, delete only the exact timestamped
  `TheRSS Dev.backup-*.app` bundles in `/Users/dtjgp/Applications`.
- Preserve `/Users/dtjgp/Applications/TheRSS Dev.app` and the complete
  `/Users/dtjgp/Library/Application Support/therss` tree, including live SQLite, preferences,
  receipts, and database backups.
- Do not use Trash relocation for app bundles: a prior cleanup triggered a macOS app-cleaner that
  also moved Application Support. Exact validated bundle deletion avoids that known side effect.

## Pre-commit Verification

- `npm run check`: pass; architecture, format, ESLint, TypeScript, 61 test files / 411 tests, both
  production builds, and all coverage thresholds passed.
- Coverage: 90.29% statements, 80.15% branches, 93.64% functions, and 93.20% lines.
- Electron E2E: 2/2 passed outside the GUI-restricted sandbox.
- Offline production dependency audit: 0 vulnerabilities from the available local npm audit cache.
  Online audit is not claimed because its dependency-metadata transmission was not authorized.
- Secret-pattern, debug-statement, whitespace, diff, and <=800-line architecture scans: pass.

## Completed Local Installation

- `npm run install:local`: pass; unsigned arm64 personal beta installed at
  `/Users/dtjgp/Applications/TheRSS Dev.app`.
- Installed bundle identifier/version: `dev.dtjgp.therss` / `0.2.0`.
- Release and installed `app.asar` SHA-256 match:
  `8d09ada5fbb8439ad67621ade14793ee8361e3198a565261acd64a5ba809d61a`.
- Installed executable packaged smoke: pass with an isolated temporary user-data directory.
- Install receipt:
  `/Users/dtjgp/Library/Application Support/therss/install-receipts/install-2026-08-28T15-04-00-402Z.json`.
- Live database and the new timestamped backup both returned `ok` from read-only immutable
  `PRAGMA integrity_check`.
- Permanently deleted exactly two verified superseded app bundles:
  `TheRSS Dev.backup-2026-08-26T14-03-25-611Z.app` and
  `TheRSS Dev.backup-2026-08-28T15-04-00-402Z.app`.
- Post-cleanup enumeration contains only active `/Users/dtjgp/Applications/TheRSS Dev.app`.
- Live data, preferences, receipts, and three SQLite recovery backups remain present.
