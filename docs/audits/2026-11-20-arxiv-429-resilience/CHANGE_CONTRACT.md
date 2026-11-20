# Change Contract: arXiv 429 & Timeout Resilience (Issue #89)

## Feature Intake

- User outcome: arXiv Discover queries, Sources 30-day samples, and automated Source Health checks no longer suffer avoidable `429` rate-limit cascades or unhandled single transient timeouts/503s.
- Observed problem/evidence: GitHub Issue #89 (`Source health regression (2026-11-06)`, latest failure 2026-11-20) repeatedly fails on `arxiv:interest` and `arxiv:recent` with `status 429` and `TimeoutError` after 36–66 s. Inspection of `src/core/sources/arxiv/requestPacer.ts`, `src/core/sources/arxiv/arxivClient.ts`, and `scripts/smoke-sources.ts` shows:
  1. `RequestPacer` measures its 3,000 ms interval from request start (`lastStarted`) rather than completion, allowing a subsequent request to fire immediately after a slow response.
  2. `RequestPacer` has no shared process-wide cooldown (`cooldownUntil`), so a `429` + `Retry-After` from one caller does not pause another concurrent arXiv caller.
  3. `fetchArxivUrl` caps `Retry-After` / backoff at 10 s and does not retry transient `503` or single `TimeoutError` failures (while respecting caller `AbortSignal`).
  4. `scripts/smoke-sources.ts` fires `arxiv:interest` and `arxiv:recent` concurrently via `Promise.all`, interleaving retries during a `429` burst.
- Product fit and relevant non-goal: Core source reliability within the existing 22-source boundary (`PRODUCT.md`, `docs/DESIGN.md`). Does not add background refresh, cross-session HTTP caching, new sources, or arbitrary user feeds.
- Alternatives considered, including no change: Leaving Issue #89 noisy hides real arXiv outages and degrades user Discover/Sources reliability. Disabling the probe weakens deployment-verification evidence.
- Cost: Small TypeScript change in `src/core/sources/arxiv/` and `scripts/smoke-sources.ts`; zero new dependencies, zero SQLite/IPC changes.
- Boundary changes: Network retry/pacing behavior for the fixed official `export.arxiv.org` adapter only. No schema, IPC, UI, secret, or packaging changes.
- Kill criterion: If added pacing/backoff violates caller cancellation (`AbortSignal`) or exceeds bounded retry limits, stop and simplify.
- Decision: proceed.

## Capability Contract

- Objective: Harden `RequestPacer`, `arxivClient.ts`, and `scripts/smoke-sources.ts` against arXiv `429` bursts, transient `503`, and single request timeouts while preserving immediate cancellation via `AbortSignal`.
- Goals:
  - Enforce minimum 3,000 ms spacing measured after each real arXiv request completes (while still serializing to one in-flight real connection at a time).
  - Support a shared pacer cooldown (`applyCooldown(ms)` / `cooldownUntil`) so a `429` or `Retry-After` from one arXiv call defers subsequent queued arXiv calls cleanly.
  - Respect bounded `Retry-After` (up to 30,000 ms) and exponential backoff on `429`, `503`, and per-attempt timeout (`TimeoutError`), while never retrying caller-initiated aborts (`options.signal?.aborted`).
  - Keep `timeoutMs` injectable in `FetchArxivOptions` (defaulting to 30,000 ms) for deterministic unit testing without real timers.
  - Serialize arXiv probes (`arxiv:interest` then `arxiv:recent`) in `scripts/smoke-sources.ts` while keeping `github:radar` independent and preserving the exact `id\tstatus\tdetail` output format and item validation assertions.
- Non-goals: No SQLite schema change, no UI change, no persistent disk cache, no live network calls inside automated Vitest tests.
- Interfaces and public API invariants: Existing exports (`parseArxivFeed`, `fetchArxivItems`, `fetchArxivRecentItems`, `RequestPacer`, `sourceDelay`) remain backward compatible.
- Data ownership and evidence semantics: Failed arXiv probes still throw explicit bounded errors; no partial/failed response is silently converted into empty success.
- Failure states: Exhausted retries throw descriptive bounded errors (`status 429`, `status 503`, or timeout); caller abort rejects promptly with abort reason without waiting for backoff or cooldown.
- Migration and rollback: No data migration. Rollback by reverting the branch commit.
- Observability/diagnostics: Existing error messages and `smoke:sources` per-probe status lines remain intact.
- Allowed scope: `src/core/sources/arxiv/requestPacer.ts`, `src/core/sources/arxiv/requestPacer.test.ts`, `src/core/sources/arxiv/arxivClient.ts`, `src/core/sources/arxiv/arxivClient.test.ts`, `scripts/smoke-sources.ts`.
- Persistent writeback: This contract (`docs/audits/2026-11-20-arxiv-429-resilience/CHANGE_CONTRACT.md`).

## Uncertainty Reducer

- Change class: Architecture/adapter bug fix.
- Chosen artifact: Failing RED unit tests reproducing (a) post-completion pacing gap, (b) shared 429 cooldown across concurrent callers, (c) `503` / per-attempt timeout retry vs immediate caller-abort short-circuit, and (d) `Retry-After` up to 30 s.
- Question it must answer: Do pacing, shared cooldown, and bounded transient retries work deterministically and respect `AbortSignal`?
- What it does not prove: Live arXiv server rate-limit behavior on GitHub-hosted runner IPs (opt-in live verification only).

## Frozen Acceptance Contract

- RED verifier and expected failure: New tests in `requestPacer.test.ts` and `arxivClient.test.ts` fail before implementation.
- Focused unit/integration cases:
  - `RequestPacer` waits full `intervalMs` after a slow request finishes, not just from start time.
  - `RequestPacer` shared cooldown delays subsequent queued requests and aborts immediately when `signal` fires.
  - `fetchArxivItems` retries `429` (honoring bounded `Retry-After` <= 30 s), `503`, and per-attempt timeout up to `maxAttempts`.
  - `fetchArxivItems` does NOT retry `400`/`404`/`500` non-transient errors or caller-aborted signals.
  - `smoke-sources.ts` runs `arxiv:interest` and `arxiv:recent` sequentially while preserving `github:radar` concurrency and exact output format/assertions.
- Migration/rollback cases: N/A (no schema change).
- E2E/manual path: N/A (no UI change).
- Security/dependency impact: Zero new dependencies; fixed `export.arxiv.org` host and bounded 10 MB XML/response limits unchanged.
- Package/install/live opt-in impact: No packaging change; live `npm run smoke:sources` is opt-in and reported separately if not run.
- Full verifier: `npm run check` (including `check:architecture`, format, lint, typecheck, >=80% coverage, appkit tests, build).
- Stop condition: All focused RED/GREEN tests and `npm run check` pass, followed by independent review from `qa-security-reviewer`.

## Independent Review

- Round 1 (`qa-security-reviewer`, `Claude Opus 5.5 High`): `CHANGES_REQUESTED` — flagged `R1 MEDIUM` (undeclared `redirect: 'error'` in `arxivClient.ts`) and `R2 LOW` (missing test for invalid `Retry-After` fallback).
- Round 2 (`qa-security-reviewer`, `Claude Opus 5.5 High`, see `QA_REVIEW_R2.md`): `APPROVED` — both R1 and R2 verified fixed; 35/35 arXiv tests pass (`arxivClient.ts` 93.51/89.32/94.11/96.77%, `requestPacer.ts` 97.91/83.33/100/100%).

## Evidence Closeout (2026-11-20)

- Changed files: `src/core/sources/arxiv/requestPacer.ts`, `src/core/sources/arxiv/requestPacer.test.ts`, `src/core/sources/arxiv/arxivClient.ts`, `src/core/sources/arxiv/arxivClient.test.ts`, `scripts/smoke-sources.ts`.
- Focused RED/GREEN: RED failed 11/29 before implementation; final GREEN passed 35/35 arXiv tests.
- `npm run check`: exit 0 (`check:architecture`, Prettier, ESLint, TypeScript, 974 main tests + 228 AppKit tests, >=80% coverage, Electron/Native/MCP build).
- Opt-in live `npm run smoke:sources`: exit 0 — `arxiv:interest fetched 3 normalized (446 ms)`, `arxiv:recent fetched 200 normalized (7070 ms)`, `github:radar fetched 25 normalized (994 ms)`.
- Rollback path: revert commit; no SQLite migration or external state mutation.
