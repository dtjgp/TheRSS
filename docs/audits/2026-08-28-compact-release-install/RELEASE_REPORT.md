# Compact Release and Local Install Report

## Status

Local installation and old-app cleanup are complete. Protected-main publication is in progress.

## Verified Result

- Feature commit: `09afa7a` on `codex/compact-ui-release`.
- Full gate: 61 files / 411 tests; coverage thresholds, builds, lint, types, formatting, and
  architecture passed.
- Electron E2E: 2/2 passed.
- Installed path: `/Users/dtjgp/Applications/TheRSS Dev.app`.
- Installed/release `app.asar` SHA-256:
  `8d09ada5fbb8439ad67621ade14793ee8361e3198a565261acd64a5ba809d61a`.
- Packaged-app smoke and live/new-backup SQLite integrity: passed.
- Old application bundles: two exact timestamped backups deleted permanently after the replacement
  passed all local checks.
- User data: preserved, including the live database, preferences, receipts, and SQLite backups.

## Evidence Boundary

The production dependency audit used the available local npm cache and reported zero
vulnerabilities. No current online npm audit is claimed because transmitting dependency metadata to
the public registry was not authorized.
