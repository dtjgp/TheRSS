# TheRSS Repository Cleanup Audit

- Date: 2026-08-16
- Scope: repository-local obsolete/generated content and version-control preservation
- Recovery directory: `/Users/dtjgp/.Trash/TheRSS-cleanup-20260816-phase12/`

## Outcome

The repository was reduced from approximately 1.1 GB to 978 MB without deleting Git history, current source work, design provenance, active dependencies, user data, or the current v5-icon application package. About 152 MB was moved to the system Trash and remains recoverable until the Trash is emptied.

## Removed from the working tree

- Old `TheRSS-0.1.0-arm64.dmg` and its blockmap, checksum, and update metadata.
- Electron Builder conversion/debug residue: `release/.icon-icns` and `release/builder-debug.yml`.
- Reproducible build/test output: `out`, `coverage`, `playwright-report`, and `test-results`.
- Root/release `.DS_Store` files.
- Empty `.github/ISSUE_TEMPLATE` and withdrawn `src/core/sync` directories.

Quality verification regenerated build/test output once; those regenerated directories were also moved to the recovery directory after the gates passed.

## Deliberately preserved

- `.git` and all Git objects, refs, reflogs, and commit history.
- Every tracked file and all current uncommitted application work.
- Icon v1-v5 source images and design records as provenance/version history.
- `build/icon.png`, which intentionally duplicates the approved v5 source as the stable Electron Builder input.
- `release/mac-arm64/TheRSS.app`, the current installation candidate containing `CFBundleIconFile = icon.icns`.
- `node_modules`, because the installed dependency tree is complete, active, and has no dry-run prune candidates.
- The superseded synchronization ADR, migration, and regression test. The ADR is historical evidence; the migration/test actively remove withdrawn credential and bookkeeping state.

## Dead-content audit

- All 48 TypeScript/TSX files are reachable from an Electron, renderer, preload, MCP, declaration, or test entry.
- No orphan TypeScript/TSX implementation file was found.
- TypeScript passed with `--noUnusedLocals --noUnusedParameters`.
- `npm ls --depth=0` reported no missing or extraneous top-level package.
- `npm prune --dry-run` proposed no package removal.
- Content hashing found no accidental duplicate outside the intentional v5/build icon pair.

## Verification

- `npm run check`: passed.
- Unit/integration tests: 18 files, 89 tests passed.
- Coverage: 93.26% statements, 83.57% branches, 94.07% functions, 95.04% lines.
- Electron critical-path E2E: passed with desktop execution permission.
- `npm audit --audit-level=high`: 0 vulnerabilities.
- `git fsck --full`: exit 0; no corrupt, missing, or broken objects.
- `git diff --check`: passed.

## Version-control state

- Branch: `main`.
- `HEAD`: `0126fcd29b63ef21e9ca601ed3d8e0a47804f434`.
- Local `origin/main` tracking ref: same commit.
- Existing commits: 7.
- Tags: none.
- No commit, push, reset, checkout, stash, garbage collection, pruning, or history rewrite was performed during cleanup.

The current feature, rollback, and brand changes remain uncommitted. They were preserved exactly rather than folded into an unrelated cleanup commit; they need scoped commits before they become durable Git versions.

## Remaining large content

- `node_modules`: approximately 628 MB; active and reproducible via `npm ci`.
- `release/mac-arm64/TheRSS.app`: approximately 331 MB; retain until the v5-icon build is installed and visually verified, then it may be removed because `npm run package:mac` regenerates it.
- `.git`: approximately 9.1 MB; retain. Dangling objects were deliberately not pruned because they may provide recovery evidence.
