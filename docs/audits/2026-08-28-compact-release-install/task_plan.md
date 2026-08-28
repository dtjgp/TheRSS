# Task Plan: Compact Release and Local Install

## Goal

Publish the verified current TheRSS work through the repository's protected-main workflow, install
the new local beta, and remove only the precisely identified superseded application bundle/content
without deleting user data.

## Task Contract

- Objective: one reviewed commit/PR merge on current GitHub `main` plus one verified local install.
- Evidence to read first: Git status/history/remotes, current branch divergence, release workflow,
  install/update scripts, installed bundle metadata, and application data locations.
- Allowed scope: all currently reviewed TheRSS changes, a scoped release branch/PR, and the local
  TheRSS application bundle managed by the repository installer.
- Destructive boundary: do not delete user databases, preferences, credentials, caches, exports, or
  arbitrary old files. Remove only a superseded application bundle or build artifact after its
  identity and replacement path are proven.
- Verifier: `npm run check`, dependency/security and diff scans, PR checks, local/remote SHA equality,
  local installation smoke test, installed version/path proof, and old-bundle absence where relevant.
- Stop condition: publication and installation verifiers pass, or a documented blocker is proven.
- Persistent writeback: this directory.

## Phases

- [x] Phase 1: Resolve Git publication scope and the exact old-version deletion target.
- [x] Phase 2: Run pre-commit verification and record the reviewed change set.
- [ ] Phase 3: Commit, push, and complete the protected-main publication workflow.
- [x] Phase 4: Build/install the local beta and remove only the proven superseded bundle/content.
- [ ] Phase 5: Verify Git/install state and close evidence.

## Key Questions

1. Does the current dirty tree consist entirely of the approved cumulative UI/workflow slices?
2. Is `main` protected, requiring branch to PR to squash-merge?
3. Does the installer replace the old bundle safely, and where is persistent user data stored?

## Decisions Made

- Preserve application data unless the user explicitly names it for deletion.
- Treat the installed application bundle and generated build artifacts separately from persistent
  local-first data.
- Publish the cumulative approved taste integration, Discover F1-F4, secondary-button F9, and
  Settings Compact F6 slices together because their source, tests, contracts, and evidence are
  already coupled in the current reviewed worktree.
- After the replacement app passes hash and packaged smoke checks, delete only exact
  `~/Applications/TheRSS Dev.backup-*.app` bundles. Preserve the active `TheRSS Dev.app`, live
  SQLite database, preferences, install receipts, and SQLite recovery backups.

## Errors Encountered

- The first full gate stopped at Prettier for this task's newly created `notes.md`; format the task
  artifacts and rerun the complete gate.
- Online `npm audit` could not resolve the registry in the sandbox, and the escalated retry was
  rejected because it would transmit dependency metadata. Do not bypass that boundary; use the
  local npm audit cache as an explicitly limited offline check and retain the full build/test gate.
- The first Electron E2E launch was blocked by the sandbox (`SIGABRT`/`kill EPERM`); the approved
  outside-sandbox rerun passed both tests.
- The first feature-branch creation could not write `.git/refs` inside the read-only Git metadata
  sandbox; the approved scoped rerun created `codex/compact-ui-release` successfully.

## Status

**Phase 3 in progress** - local installation and scoped old-bundle cleanup are verified; publishing
the two local commits through a protected-main PR.
