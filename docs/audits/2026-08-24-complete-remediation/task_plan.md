# Task Plan: TheRSS Complete Audit Remediation and Local Package Update

## Goal

Resolve every still-open issue documented by the current product-design audits, verify the complete
desktop experience and security boundaries, then reversibly rebuild and update the installed local
macOS beta.

## Task Contract

- Objective: close the remaining P1/P2 audit findings without weakening TheRSS's local-first,
  evidence-first product identity.
- Evidence to read first: `PRODUCT.md`, `GOALS.md`, repository `task_plan.md`, `docs/DESIGN.md`,
  `docs/ENGINEERING_PRACTICES.md`, both 2026-08-24 audit reports, and the nearest source/tests.
- Allowed scope: renderer/main/preload/shared code, tests, docs/audit evidence, Figma audit closure,
  local package/install scripts, and the installed personal-beta app.
- Verifier: RED/GREEN focused tests, `npm run check`, security/dependency review, Electron E2E,
  rendered visual/accessibility inspection, package smoke, installed/release hash equality, and
  read-only SQLite backup integrity.
- Stop condition: every documented finding is either verified fixed or explicitly proven obsolete;
  all release gates pass; the installed app is updated with recoverable backups.
- Persistent writeback: this plan, `notes.md`, `completion-report.md`, current audit documents, and
  the existing Figma audit board.

## Scope Checklist

- [x] Settings/provider lifecycle, validation, connection feedback, and secret-safe behavior
- [x] Source observed-at timestamps, attention filtering, terminology, locale consistency, and
      actionable health navigation
- [x] High-contrast/forced-colors, VoiceOver-facing semantics, keyboard flow, and 200% zoom behavior
- [x] Resizable list/detail workspace and window-state restoration
- [x] Renderer/CSS decomposition and product terminology alignment
- [x] Remaining visual polish: micro-label legibility, card-layer reduction, and receipt layout
- [x] Full verification and reversible local package update

## Phases

- [x] Phase 1: Refresh governance, audit inventory, worktree, and package/install baseline
- [x] Phase 2: Map every finding to source, tests, risk, and acceptance criteria
- [x] Phase 3: Add failing tests for each coherent remediation slice
- [x] Phase 4: Implement and verify slices until the audit inventory is closed
- [x] Phase 5: Run security, accessibility, responsive, full Electron, and diff review
- [x] Phase 6: Capture durable visual evidence and attempt Figma closure
- [x] Phase 7: Rebuild/install the local beta, verify backups, hashes, smoke, and SQLite integrity
- [x] Phase 8: Write the completion report and hand off the installed result

## Decisions Made

- “All issues” means all findings recorded in the current 2026-08-24 audit and its Slice B report;
  unrelated speculative features remain out of scope.
- The existing restrained macOS research-desk design system is the visual target.
- Provider work must preserve OS-managed secret encryption, typed IPC validation, loopback/HTTPS
  endpoint rules, redacted errors, and opt-in live calls.
- No commit, push, release publication, production signing, or live-provider/source call is implied.
- Installation is the final phase only; no incomplete build may replace the installed app.

## Errors Encountered

- The first complete gate stopped at Prettier for the newly expanded E2E spec and remediation
  notes. No build or test conclusion was drawn from that partial run; format those exact files and
  rerun the complete gate.
- Every TDD slice first failed at its intended missing boundary: Provider connection/credential
  lifecycle, Settings component, source observation/filter/terminology, split-pane persistence,
  window-state persistence, separate promotion receipt status, and contrast/forced-color CSS.
- The first Electron E2E run hit the established restricted-macOS `SIGABRT`/`kill EPERM` launch
  boundary. The approved desktop rerun launched correctly.
- The first desktop rerun used an ambiguous `role=status` selector after adding unsaved and
  connection statuses. Scoped it to `.provider-save-status`; the application behavior was correct.
- Programmatic focus does not trigger Chromium `:focus-visible`. The forced-colors verifier now
  moves focus with `Shift+Tab`, matching a real keyboard path.
- The Figma append attempt reached the authenticated Starter/View account but the Figma MCP refused
  further calls at its plan limit. No board mutation occurred; local before/after evidence and this
  closure report remain complete.
- The sandboxed production dependency audit could not resolve the npm registry. The approved
  official advisory-endpoint retry found zero vulnerabilities.
- electron-builder found no valid Developer ID identity and produced the expected unsigned personal
  beta. This preserves the existing public-distribution boundary.
- The first sandboxed `git switch -c` could not create `.git/index.lock`; the approved retry created
  the clean publication branch from current `origin/main` without losing worktree changes.
- The first full staged `git diff --check` surfaced nine Markdown hard-break double spaces in newly
  added audit files. Removed only those trailing spaces and restaged; no prose or evidence changed.
- The combined format/stage command then hit the restricted `.git/index.lock` boundary after
  formatting completed. The approved scoped `git add -A` retry staged the same verified worktree.

## Status

**Complete** — every scoped application finding is closed and verified; the reversible local beta
is installed and its retained backups, bundle identity, app hash, packaged smoke, installed-binary
E2E, and database integrity all pass. Figma writeback alone remains externally rate-limited.

## Publication Closure

- [x] Enumerate and validate the exact obsolete application backup targets
- [x] Remove only validated old application bundles; preserve the active app and SQLite backups
- [x] Refresh `origin/main`, inspect divergence, auth, staged scope, large files, and secret patterns
- [x] Re-run the full release and security gates after final documentation edits
- [ ] Stage the explicitly authorized full worktree and create one Conventional Commit
- [ ] Push through the protected-main workflow and verify remote/local SHA convergence

### Publication Status

**In progress** — cleanup and every local release/security gate pass on the clean publication branch.
Staging the explicitly authorized full worktree next.
