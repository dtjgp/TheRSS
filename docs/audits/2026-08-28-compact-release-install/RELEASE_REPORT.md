# Compact Release and Local Install Report

## Status

Local installation and old-app cleanup are complete. The verified feature branch is pushed, and
explicit authorization to create and merge the protected-main PR has been received. The final PR
number and merged `main` SHA must be verified from live GitHub/Git state rather than predicted here.

## Verified Result

- Feature commit: `09afa7a` on `codex/compact-ui-release`.
- Installation-evidence commit: `6daa297` on `codex/compact-ui-release`.
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

GitHub PR #35's first `quality` job subsequently ran the current online audit successfully. Its
first `desktop` job found a real compact-window 200% overflow; the branch now contains a
deterministic 900px regression and a locally verified minimal wrapping fix. Merge remains gated on
the corrected revision's fresh CI result.
