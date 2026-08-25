# Task Plan: ClashMac-reference implementation and mainline release

## Goal

Implement the currently actionable UI/UX recommendations, verify and install the local macOS app,
integrate every non-main branch without losing work, remove obsolete branches, update README, and
push a verified `main` to GitHub.

## Task contract

- Objective: close the current Apple-native slice, add a compact contextual top-bar status layer,
  improve honest Analytics density, verify Sources already meets the recommended status hierarchy,
  update README, install the local beta, integrate branches, clean obsolete branches, and push main.
- Evidence to read first: `PRODUCT.md`, `GOALS.md`, current dirty diff, nearest renderer/main tests,
  source/analytics contracts, branch ancestry, remote refs, and the prior comparison audit.
- Allowed scope: renderer/main UI and tests, task-local audit evidence, README, scoped Git history,
  local beta install, branch integration/deletion, and `origin/main` push authorized by the user.
- Verifier: focused RED/GREEN, `npm run check`, Electron E2E, fresh screenshots, package/install smoke,
  dependency/security/diff review, branch ancestry audit, remote `main` verification.
- Stop condition: all gates pass; the installed app matches the verified package; every non-main
  branch is merged or proven redundant; obsolete local/remote branches are removed; `origin/main`
  resolves to the final commit.
- Persistent writeback: this audit directory, README, source/tests, Git commits, installed local app,
  and authorized GitHub refs.

## Phases

- [x] Phase 1: Define scope, product gates, and verification contract
- [x] Phase 2: Audit dirty work, branches, source UI, tests, and release state
- [x] Phase 3: Verify and reconcile the existing Apple-native accent/menu slice provenance
- [x] Phase 4: Build and review a deterministic contextual-status prototype
- [x] Phase 5: TDD implement contextual top bar and Analytics refinement
- [x] Phase 6: Update README and run independent diff/security review
- [x] Phase 7: Run full check, Electron E2E, screenshot matrix, package/install smoke
- [x] Phase 8: Integrate every branch, rerun affected gates, delete obsolete branches
- [x] Phase 9: Push final main through the protected PR path, verify remote state, and close evidence

## Key decisions

- Do not add empty future Settings categories or a menu-bar status item: the required third setting
  family and honest background-refresh lifecycle do not exist.
- Preserve the editorial Discover/Saved reading model; compact status density belongs in the shell,
  Analytics, and Sources only.
- Reuse existing SQLite/API state. No schema, IPC, source-adapter, credential, or network contract
  expansion is authorized for the contextual status layer.
- Treat branch deletion as a final exact-target operation after ancestry/content verification.

## Errors encountered

- The disposable prototype server returned a harmless 404 for `/favicon.ico`; the prototype itself
  loaded with HTTP 200 and all requested states/screenshots were valid.
- The first broad App test run found two semantic collisions because the persistent view context used
  `role=status` alongside transient save/triage statuses. Acceptance was corrected before editing
  tests: the view context becomes a labelled polite `group`, preserving announcements without
  competing with terminal feedback.
- The follow-up run exposed the pre-existing Settings contract that `Unsaved changes` itself is a
  status. The group was therefore made non-live while the unsaved primary label retains the single
  transient `role=status`; this avoids duplicate announcements and preserves the established test.
- The first Electron E2E run passed sidebar resizing but failed one new Sources assertion: the
  deterministic fixture correctly had `22 not checked`, not an attention state. Acceptance was
  corrected before editing the assertion; missing health remains distinct from failure.
- The first `npm audit` attempt could not resolve the registry inside the restricted network sandbox;
  the approved network rerun completed and found zero vulnerabilities.
- The first merge attempt could not write `.git/ORIG_HEAD` inside the filesystem sandbox. The
  approved rerun reached one README conflict caused by old versus new verification counts; the
  current 57-file/382-test evidence was retained, the conflict was resolved, and the merge tree was
  proven identical to the pre-merge feature commit.
- Direct `main` push passed the ECC pre-push gates but GitHub correctly rejected it because protected
  main requires a PR, two checks, and no merge commits. The verified tree was replayed without merge
  commits on `codex/contextual-status-release`, PR #30 passed both CI jobs, and GitHub squash-merged it.
- The local `gh` token was stale and repository auto-merge is disabled, so the authenticated GitHub
  connector created and merged PR #30 after CI. GitHub deleted the remote temporary branch; the exact
  local temporary branch was deleted only after all local/remote/squash trees matched.

## Status

**Complete** - PR #30 is merged, the verified app is installed, only main remains, and local main,
`origin/main`, and the live remote ref matched `e227b14134282d5a683489a89ea9a90eb0499aa7` at product
closeout.
