# Compact Release and Local Install Report

## Status

Complete. PR #35 passed all corrected required checks and was squash-merged to protected `main` at
`69a0082c1c1f5452ee9fd341af0bf85a090dbc6e`. The final merged app is installed, verified, and the
superseded app bundle has been removed.

## Verified Result

- Feature commit: `09afa7a` on `codex/compact-ui-release`.
- Installation-evidence commit: `6daa297` on `codex/compact-ui-release`.
- Full gate: 61 files / 412 tests; coverage thresholds, builds, lint, types, formatting, and
  architecture passed.
- Electron E2E: 2/2 passed.
- Installed path: `/Users/dtjgp/Applications/TheRSS Dev.app`.
- Installed/release `app.asar` SHA-256:
  `4bd232c7baf0b367d39fb8732c90474d98d78b5a38db471821f126dd79374dbd`.
- Packaged-app smoke and live/new-backup SQLite integrity: passed.
- Old application bundles: two exact timestamped backups deleted permanently after the replacement
  passed all local checks.
- User data: preserved, including the live database, preferences, receipts, and SQLite backups.

## Evidence Boundary

The local production dependency audit used the available npm cache and reported zero
vulnerabilities. The corrected GitHub `quality` job additionally ran the current online production
audit successfully.

GitHub PR #35's first `quality` job subsequently ran the current online audit successfully. Its
first `desktop` job found a real compact-window 200% overflow; the branch added a deterministic
900px regression and a minimal wrapping fix. The corrected revision passed local and CI desktop
gates before merge.
