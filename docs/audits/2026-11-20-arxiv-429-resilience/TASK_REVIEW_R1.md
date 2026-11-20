# Independent Review Task (Round 1): Issue #89 arXiv 429 & Timeout Resilience

- **Task / PR**: Issue #89 arXiv 429 & Timeout Resilience
- **Review Round**: 1 (Full diff review; max 3 rounds)
- **Author Role & Model**: `core-retrieval-storage` / `GPT-6.2-Sol (High)`
- **Reviewer Role & Model**: `qa-security-reviewer` / `Claude Opus 5.5 (High)` (cross-family)
- **Target Worktree to Inspect (READ-ONLY)**: `/Users/dtjgp/orca/workspaces/TheRSS/core-retrieval-storage`
- **Change Contract**: `/Users/dtjgp/Projects/TheRSS/docs/audits/2026-11-20-arxiv-429-resilience/CHANGE_CONTRACT.md`
- **Author Delivery Report**: `/private/tmp/therss-arxiv-429.KbaLkRTc/REPORT.md`

## Instructions (Strict Read-Only Review)

Do NOT edit any production or test files. Inspect the exact diff in `/Users/dtjgp/orca/workspaces/TheRSS/core-retrieval-storage` (`git -C /Users/dtjgp/orca/workspaces/TheRSS/core-retrieval-storage diff`) and read the full modified files to verify:

1. **Contract & Scope Fit**: Only the 5 allowed files were changed; all `CHANGE_CONTRACT.md` goals and invariants are met without scope creep.
2. **Correctness & Edge Cases**:
   - Does `RequestPacer` accurately enforce post-completion `intervalMs` and shared `cooldownUntil` without race conditions, deadlocks, or stale timer leaks?
   - Does `AbortSignal` cancel immediately in every state (before queue, queued, sleeping in cooldown, mid-request, mid-retry-sleep) without retrying caller aborts?
   - Are `429`, `503`, `Retry-After` (seconds & HTTP-date, bounded to 30 s), and per-attempt `TimeoutError` handled properly while permanent errors (`400`/`404`/`500`) fail fast?
   - Check the author's explicit HTTP redirect rejection (`redirect: 'error'` or similar) against `export.arxiv.org` behavior and existing `arxivClient` expectations/tests: is it safe and contract-aligned, or could it break legitimate arXiv responses?
   - Check `scripts/smoke-sources.ts`: are `arxiv:interest` and `arxiv:recent` serialized cleanly, does `github:radar` still run independently, and are TSV format, exit code, and item validation assertions completely preserved?
3. **Test Integrity**: No weakened assertions, no skipped tests, no live network calls in unit tests, and >=80% coverage across statements/branches/functions/lines.
4. **Architecture & Security**: All modified `src/` files <= 800 lines, 10 MB XML/response safety limits intact, zero secret exposure.

## Required Delivery

Write your structured review using the format in `/Users/dtjgp/Projects/TheRSS/.agents/team/templates/review-report.md` and report back via Orca `worker_done` (`outcome: succeeded` if your review finished cleanly; include Verdict `APPROVED` or `CHANGES_REQUESTED` and full severity-classified findings in your report body).
