# Task Plan: Discover UI commit, push, and local installation

## Goal

Commit the verified Discover list-detail and zoom/sidebar-shape work, publish it through the
repository's protected workflow, replace the installed local beta recoverably, and prove the final
Git/package/database state.

## Task contract

- Objective: one verified repository change plus a matching installed `/Users/dtjgp/Applications/
TheRSS Dev.app`.
- Evidence to read first: current Git status/history/remote, both 2026-08-26 implementation reports,
  release scripts, branch protection, full checks, package metadata, installed app, and SQLite path.
- Allowed scope: task-local release docs, scoped branch/commits/push, required protected-branch PR
  workflow if authorized by the push request, local package build/install/replacement, retained app
  and database backups, and read-only verification.
- Verifier: clean staged review; full check; Electron E2E; production dependency audit; package/install
  smoke; installed/release `app.asar` hash equality; current/backup SQLite integrity; local/tracking/
  live remote ref agreement.
- Stop condition: commit exists remotely; repository destination is updated as far as current
  authorization and branch protection permit; installed app matches the verified release; all
  checks pass or an exact external blocker is documented.
- Persistent writeback: scoped Git history/remote ref, local app replacement/backups, and this release
  evidence directory. No GitHub Release, tag, live provider/source, or real llm-wiki write.

## Phases

- [x] Phase 1: Freeze release scope and audit current Git/install state
- [x] Phase 2: Run final verification and stage/review exact files
- [x] Phase 3: Commit and push through the repository's accepted branch path
- [x] Phase 4: Build, back up, replace, and smoke the local installed app
- [x] Phase 5: Verify remote/hash/SQLite state and close evidence

## Decisions made

- Use a `codex/` branch rather than committing directly to protected `main`.
- Keep Discover list-detail and zoom/sidebar-shape implementation in one coherent feature commit;
  keep release evidence in a second docs-only commit if it is produced after installation/remote CI.
- Do not delete backups or publish a GitHub Release.
- Do not infer installed correctness from source tests; verify the installed executable directly.

## Errors encountered

- Initial local branch creation could not write `.git/refs` inside the filesystem sandbox; the
  approved scoped rerun created `codex/discover-ui-release` without changing files.
- One read-only `git ls-remote` attempt hit restricted DNS; remote-tracking state was refreshed by
  `git fetch origin --prune` and live verification will be rerun at the approved network boundary.
- The local `gh` token is invalid, so `gh` cannot create/merge a protected-main PR. Branch push will
  use Git's configured credential path; if main integration requires a PR, use an available GitHub
  connector or report that exact authentication gate.
- The first `npm audit` attempt hit restricted registry DNS and could not write the default npm log;
  the approved network rerun completed and found zero vulnerabilities.
- The first `npm run install:local` output stopped at Electron download while its operation continued
  to completion in the background. An immediate audit occurred before its install logs surfaced;
  the subsequent explicit package/install retry produced a second recoverable backup set. Both app
  backups and both SQLite backups were retained and verified; no data was deleted.
- The GitHub connector rejected non-draft PR creation because commit/install/push authorization does
  not separately authorize opening a PR. No workaround or direct-main bypass was attempted.

## Status

**Complete** - two commits were pushed to the scoped branch, PR #32 was subsequently authorized and
merged through protected `main`, the installed app matches the verified release, and
backups/integrity/smoke/E2E pass. Current local and remote `main` agree at `c4a0c66`.
