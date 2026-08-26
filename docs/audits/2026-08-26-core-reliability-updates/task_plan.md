# Task Plan: Core reliability updates

## Goal

Finish the highest-priority reliability work behind the current Discover-centered product: reconcile
release evidence, make local replacement installs idempotent and auditable, make Discover runs
cancelable and recoverable per source, and make persisted analysis evidence reopenable and visibly
stale when its source changes. Add local unified search only after those invariants are green.

## Task contract

- Objective: ship the core reliability slices without adding new sources, cloud state, background
  refresh, opaque recommendation logic, or unsigned self-update claims.
- Evidence to read first: `AGENTS.md`, `PRODUCT.md`, `GOALS.md`, `docs/ROADMAP.md`,
  `docs/DEVELOPMENT_WORKFLOW.md`, the current release evidence, install scripts, typed API/IPC,
  Discover orchestration/storage, analysis storage, renderer surfaces, and nearest tests.
- Allowed scope: task-local evidence, current product/status documentation, local-beta install tooling
  and tests, Discover run orchestration/IPC/renderer/tests, analysis history/stale-state
  storage/API/renderer/tests, and a bounded local search surface if the earlier slices close cleanly.
- Verifier: RED/GREEN focused tests per slice, architecture check, full `npm run check`, Electron E2E,
  production dependency audit, package smoke, and an isolated non-destructive installer rehearsal.
- Stop condition: the first four core slices pass their focused and full verifiers; local search is
  included only if it does not weaken the release/data-safety boundary. Remaining external gates are
  documented explicitly.
- Persistent writeback: code/tests/docs and this audit directory. No install over the live app, Git
  commit, push, PR, merge, GitHub Release, live provider/source call, or real llm-wiki write unless
  separately authorized.

## Phases

- [x] Phase 1: Read governance, freeze scope, and create the acceptance contract
- [x] Phase 2: Reconcile current product/release evidence
- [x] Phase 3: Add installer idempotency, completion receipt, and database-path assertions
- [x] Phase 4: Add cancelable Discover runs with per-source progress and failed-source retry
- [x] Phase 5: Add reopenable analysis history and source-hash stale detection
- [x] Phase 6: Add bounded local unified search if the core gates remain green
- [x] Phase 7: Run independent diff review and the full verification/release gates
- [x] Phase 8: Close evidence and report residual gates

## Key questions

1. How can a local install be rehearsed entirely against temporary paths while proving the same
   transaction and receipt logic used by the real installer?
2. Where should Discover cancellation live so renderer state never gains process/network authority?
3. Can per-source retry reuse the persisted validated plan without invoking the planner again?
4. Which exact fields define analysis staleness, and how can history remain immutable?
5. Can local search reuse bounded SQLite fields/FTS without introducing a new evidence class?

## Decisions made

- Preserve the typed preload boundary; renderer requests cancellation/retry but never owns adapters,
  processes, filesystem paths, or database handles.
- Treat cancellation, failure, partial success, empty success, and completion as distinct states.
- Retry only explicitly failed/canceled sources from the persisted validated plan; never rerun a
  successful source or silently invoke the planner again.
- Treat installer/database disappearance as an incident signal, not as proven installer causation.
- Keep previous analysis artifacts immutable; a rerun creates a new artifact.
- Start local search with deterministic local text matching/FTS over bounded stored fields, not
  embeddings or remote/model calls.

## Errors encountered

- The first documentation patch failed closed because the historical release contract used different
  line wrapping than the expected context. No partial edits were applied; the retry was split into
  exact file-scoped patches.
- The installer GREEN implementation initially failed typecheck because its `.mjs` module lacked a
  declaration file, and lint found an unbound `process` global plus a dropped caught-error cause.
  Added an exact module contract, imported `argv`, and retained the original lock error as `cause`.
- The first Discover GREEN pass exposed strict indexed-access errors, one obsolete ranked-result
  deduplicator, and a Settings-only API fixture missing the new typed methods. Added explicit
  invariant assertions, removed the dead helper, and completed the fixture contract.
- The first local-search storage assertion assumed a title match would return only the Saved row.
  Unified search correctly returned both that Saved item and its historical Analysis; the test was
  corrected to require the Saved result without suppressing valid cross-kind matches.
- The first Electron E2E rerun failed both tests before rendering because preload did not expose
  `window.therss`; renderer errors reported `getLatestDiscover`/`getDashboard` on `undefined`.
  Treat as one preload-startup regression and restore that boundary before interpreting UI tests.
- After preload recovery, sidebar E2E passed and desktop E2E reached local search. Playwright's page
  keyboard did not dispatch the Electron application-menu accelerator, so the E2E now invokes the
  real `Find Local Research` menu item; the accelerator mapping remains covered by its menu test.
- The real menu item initially dropped its command when Electron reported no focused window during
  automation. Menu dispatch now prefers the focused window and safely falls back to the first live
  app window, covering macOS focus-transition edges without broadcasting to every window.
- The first `npm run package:mac` completed compilation/native dependency preparation but the
  restricted network could not resolve `github.com` for Electron builder resources. Rerun the same
  package command at the approved network boundary; do not classify the DNS failure as a build bug.
- Independent diff review found cancellation was initially a service-level race rather than a full
  resource abort, allowed multiple run IDs per renderer, and could leave an installer lock if its
  metadata write failed. Propagated one signal through planner/CLI/model/source HTTP, limited each
  window to one run, and made lock acquisition clean up a failed metadata write.
- The first final `npm run check` stopped at `format:check` because the new requirements-traceability
  table rows had not been passed through Prettier. Format the document and rerun the full gate from
  the beginning; no code/test failure was reported in that attempt.

## Status

**Complete** — all scoped core reliability and local-search behavior, migrations, tests, E2E,
dependency audit, package build/smoke, documentation, independent diff review, subsequent authorized
branch publication, PR #33 creation, and recoverable installed-app replacement are closed. Merge and
GitHub Release publication remain outside this request.
