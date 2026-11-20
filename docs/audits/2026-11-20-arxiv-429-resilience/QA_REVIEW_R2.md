# Independent Review Report

- **Task / PR**: Issue #89 arXiv 429 & Timeout Resilience (branch `dtjgp/core-retrieval-storage`)
- **Review Round**: 2 (incremental since Round 1; max 3 rounds)
- **Author Role & Model**: `core-retrieval-storage / GPT-6.2-Sol (High)`
- **Reviewer Role & Model**: `qa-security-reviewer / Claude Opus 5.5 (High)`
- **Reviewed Commit / Diff Range**: `692f9e4..working tree`; incremental slice = `/private/tmp/therss-arxiv-429-qa-r1.6jACvrnz/qa-r1.patch` (2 files, +15/−2)

## Verdict

- `APPROVED`

## Findings

No new findings.

Round 1 disposition:

| ID  | Severity | Status             | Evidence                                                                                                                                                                                                                                                                                        |
| --- | -------- | ------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| R1  | MEDIUM   | Resolved           | `redirect: 'error'` removed from `arxivClient.ts`; its assertion removed from `arxivClient.test.ts`. `grep redirect src/core/sources/arxiv/*.ts` returns no match. Fetch redirect behavior is the same as at base `692f9e4`, so the change again stays within the contract (retry/pacing only). |
| R2  | LOW      | Resolved           | New test `uses exponential backoff when Retry-After is invalid`: two 429 responses with `Retry-After: soon`, then success; asserts 3 calls and sleeps `[[3000],[6000]]`. `arxivClient.ts` line 158 (`return undefined` fallback) is now covered. No other assertion changed.                    |
| R3  | LOW      | Open, non-blocking | Worst-case latency vs the 20-min Source Health job timeout. No change required in this scope.                                                                                                                                                                                                   |
| R4  | LOW      | Open, non-blocking | Smoke serialization verified by inspection only. No change required.                                                                                                                                                                                                                            |

## Mandatory Gate Audit

- [x] Matches `CHANGE_CONTRACT.md` and owned scope (same 5 files; the undeclared redirect policy is gone)
- [x] No weakened assertions or skipped acceptance tests (the only removed assertion checked the removed behavior)
- [x] Security & privacy boundaries intact
- [x] Evidence & failure-state semantics intact
- [x] Owned `src/` files <= 800 lines (arxivClient.ts 241, arxivClient.test.ts 364) and coverage >= 80%
- [x] Migration & rollback path verified (N/A)

## Commands Verified by Reviewer

- `grep -n redirect src/core/sources/arxiv/*.ts`: no match.
- `git diff --stat`: only `arxivClient.ts` (−1 line) and `arxivClient.test.ts` (+14 net) changed since Round 1. `requestPacer.ts`, `requestPacer.test.ts` and `smoke-sources.ts` stats match Round 1.
- `npx vitest run src/core/sources/arxiv/` with coverage into the scratchpad: exit 0. Coverage (stmts/branch/funcs/lines): arxivClient.ts 93.51/89.32/94.11/96.77 (line 158 now covered); requestPacer.ts 97.91/83.33/100/100. Target tree status unchanged afterwards.

## Checks Not Run / Human QA Still Required

- Full `npm run check` not rerun by the reviewer; the author reports exit 0 (`check.log`).
- Live `npm run smoke:sources` (opt-in) not run.
