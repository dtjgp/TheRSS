# Independent Review Report

- **Task / PR**: `<title or branch>`
- **Review Round**: `<1 | 2 | 3>` (Max 3 rounds; escalate unresolved Critical/High after Round 3)
- **Author Role & Model**: `<role-id / model>`
- **Reviewer Role & Model**: `<qa-security-reviewer / actual model used>`
- **Reviewed Commit / Diff Range**: `<base..head>`

## Verdict

- `<APPROVED | CHANGES_REQUESTED | ESCALATE_TO_USER>`

## Findings

| ID  | Severity (`CRITICAL` / `HIGH` / `MEDIUM` / `LOW`) | File & Lines | Category (`Contract` / `Security` / `Tests` / `Evidence` / `Architecture` / `UX`) | Finding & Required Fix |
| --- | ------------------------------------------------- | ------------ | --------------------------------------------------------------------------------- | ---------------------- |
| R1  |                                                   |              |                                                                                   |                        |

_(If none, write "No findings.")_

## Mandatory Gate Audit

- [ ] Matches `CHANGE_CONTRACT.md` and owned scope (no accidental scope creep)
- [ ] No weakened assertions or skipped acceptance tests
- [ ] Security & privacy boundaries intact (untrusted input, URLs, secrets, vault paths/leases, SQL)
- [ ] Evidence & failure-state semantics intact (no abstract-as-full-paper overclaiming)
- [ ] Owned `src/` files <= 800 lines and coverage >= 80%
- [ ] Migration & rollback path verified (or N/A)

## Commands Verified by Reviewer

- `<command>`: `<result>`

## Checks Not Run / Human QA Still Required

- `<explicit list, e.g., physical keyboard, VoiceOver, live vault write, real provider quality>`
