# Change Contract: Discover UI release closeout

## Feature Intake

- **User outcome:** commit, push, install, and replace the local app with the just-verified UI work.
- **Observed evidence:** both implementation slices pass full checks and Electron E2E but remain
  uncommitted and are not present in the installed app.
- **Product fit/non-goal:** release the scoped local-first desktop behavior. No GitHub Release, tag,
  live retrieval/model call, signing claim, or unrelated cleanup.
- **Alternatives:** leaving source dirty or installing before commit weakens traceability; direct main
  push may violate branch protection. Chosen path is verified branch commit/push, then recoverable
  local replacement and evidence closeout.
- **Cost/boundaries:** operational Git/package/install changes only; no new product behavior beyond
  the already-reviewed diff.
- **Kill criterion:** stop installation if package/check/E2E fails, target path is ambiguous, backup
  or framework integrity fails, or database backup cannot be made.
- **Decision:** proceed.

## Capability Contract

- **Objective:** remote commit and installed app correspond to one verified source tree.
- **Invariants:** exact target app, retained previous app, SQLite backup, unsigned-beta boundary,
  protected-main rules, no force push/reset, no live external data.
- **Rollback:** restore retained previous app and database backup; revert the remote commit through
  normal Git workflow if needed.
- **Allowed scope:** exact working diff, release evidence, branch/commit/push, package/install/smoke,
  read-only remote/hash/SQLite verification.

## Frozen Acceptance Contract

- `npm run check`, Electron E2E, production audit, staged secret/debug/diff review pass.
- Commit is Conventional Commits and contains only reviewed files.
- Protected branch behavior is respected; no force push.
- `npm run install:local` creates backups and replaces the exact target.
- `npm run smoke:package` passes against the installed executable.
- Release and installed `app.asar` SHA-256 match; current and backup SQLite return `ok`.
- Final report states exact commit/ref/install/backup paths and any remaining remote gate.

## Evidence Closeout

- **Source verification:** full check 57/385, Electron E2E 2/2, production audit 0 vulnerabilities,
  staged diff/security/boundary review passed.
- **Git:** feature commit `52c7bca` pushed to `origin/codex/discover-ui-release`; live remote branch
  matches. Protected `main` remains at `e9e415a` because non-draft PR creation requires separate
  explicit authorization and was rejected by policy.
- **Subsequent closure:** the user later explicitly authorized PR creation and merge; PR #32 merged
  through protected `main`, and current local/remote `main` agree at `c4a0c66`.
- **Install:** exact target replaced twice recoverably after the first long operation's output was
  truncated; two app and two database backups retained.
- **Package identity:** release and installed `app.asar` hashes both
  `965e29105a807e1c218b8bd21dbaf91a9c567019ebe0ad9ea324cb39dd6957da`; metadata remains
  `dev.dtjgp.therss` / `0.2.0` / `TheRSS`.
- **Runtime:** installed package smoke and installed-binary Electron E2E 1/1 passed.
- **Data:** current SQLite and both new backups returned `ok` in immutable read-only checks.
- **Boundaries:** unsigned personal beta; no release/tag/live provider/source/llm-wiki write; no
  backups deleted.
- **Rollback:** restore the first retained old-app backup and either verified SQLite backup; remote
  branch can be left unmerged or removed through normal Git workflow.
