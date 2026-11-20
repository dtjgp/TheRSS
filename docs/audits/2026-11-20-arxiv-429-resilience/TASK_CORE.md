# Task Dispatch Spec: arXiv 429 & Timeout Resilience (Issue #89)

- **Task Title**: Harden arXiv pacer, retries, and smoke probe against 429/timeout bursts (Issue #89)
- **Assigned Role**: `core-retrieval-storage`
- **Change Contract**: `/Users/dtjgp/Projects/TheRSS/docs/audits/2026-11-20-arxiv-429-resilience/CHANGE_CONTRACT.md`
- **Base Branch / Commit**: `dtjgp/core-retrieval-storage` (`692f9e4`)

## Objective

Fix the pacing and retry weaknesses behind GitHub Issue #89 (`arxiv:interest` and `arxiv:recent` failing with `429` and `TimeoutError`) while preserving immediate `AbortSignal` cancellation, deterministic unit tests, and all repository quality gates.

## Frozen Interfaces & Inputs

- Keep existing exported function and class signatures backward compatible: `parseArxivFeed`, `fetchArxivItems`, `fetchArxivRecentItems`, `RequestPacer`, `sourceDelay`.
- Keep fixed-host `export.arxiv.org` and 10 MB bounded XML safety limits untouched.
- Never make live HTTP calls inside Vitest unit tests.

## Allowed Edit Scope

- `src/core/sources/arxiv/requestPacer.ts`
- `src/core/sources/arxiv/requestPacer.test.ts`
- `src/core/sources/arxiv/arxivClient.ts`
- `src/core/sources/arxiv/arxivClient.test.ts`
- `scripts/smoke-sources.ts`

## Explicitly Out of Scope (Do Not Touch)

- SQLite schema or repositories
- UI / AppKit / React renderer files
- `.github/workflows/`
- Any other source adapters
- Do NOT run `git push` or modify installed apps

## Acceptance Criteria & RED/GREEN Plan

1. **RED**: Add failing unit tests in `requestPacer.test.ts` and `arxivClient.test.ts` covering:
   - `RequestPacer` enforcing `intervalMs` measured after completion of a slow request (not just start time).
   - `RequestPacer` shared cooldown (`cooldownUntil` / `applyCooldown`) pausing queued arXiv requests after a `429`/`Retry-After` and aborting promptly when `AbortSignal` triggers.
   - `fetchArxivItems` retrying `429` (honoring `Retry-After` bounded up to 30,000 ms), `503`, and single per-attempt timeout (`TimeoutError`) up to `maxAttempts`.
   - `fetchArxivItems` NOT retrying caller-initiated aborts (`options.signal?.aborted`) or permanent statuses like `400`/`404`.
2. **GREEN**: Implement the smallest coherent changes in `requestPacer.ts`, `arxivClient.ts`, and `scripts/smoke-sources.ts` (serializing `arxiv:interest` then `arxiv:recent` while keeping `github:radar` independent and preserving exact `id\tstatus\tdetail` format and assertions).
3. **Invariants**: Owned `src/` files <= 800 lines; >= 80% coverage across statements, branches, functions, lines; zero live network calls in unit tests; clean Prettier & ESLint.

## Required Verification Commands

- `npx vitest run src/core/sources/arxiv/requestPacer.test.ts src/core/sources/arxiv/arxivClient.test.ts`
- `npm run check`

## Required Delivery Report

Report via Orca `worker_done`:

1. Summary of changes and exact modified file list
2. Focused RED → GREEN results and full `npm run check` output (test counts & coverage)
3. Deliberately untouched files and checks not run (note that live `smoke:sources` is opt-in)
4. Residual risks and rollback steps
