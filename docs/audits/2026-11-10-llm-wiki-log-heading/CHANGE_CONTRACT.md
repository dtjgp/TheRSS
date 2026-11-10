# Change contract: give each llm-wiki promotion its own log heading

## Feature intake

- **User outcome:** A paper promotion from TheRSS appears in llm-wiki `log.md` as its own dated entry, like every other vault operation.
- **Observed problem:** On 2026-11-10 llm-wiki adopted one entry format for `log.md`: each entry starts with `## [YYYY-MM-DD] <op> | <title>`, and the vault health check (`System/Scripts/wiki_lint.py`) reports a trailing operation bullet without its own heading. TheRSS appends only the bullet `- **THRSS_PAPER_PROMOTION** | …`, so each promotion attaches to the previous, unrelated entry and the vault check fails.
- **Product fit:** No product or UI change. The confirmation-gated promotion writes the same files.
- **Alternatives:** (1) Keep the bullet and let the vault repair it: every promotion would need a manual fix. (2) Write the heading and keep the bullet as the body. Select (2); the bullet keeps the existing marker for anyone who searches for it.
- **Cost and boundaries:** One string in `llmWikiVaultConfirm.ts` and one test assertion. No new package, IPC, storage, UI, network or schedule.
- **Kill criterion:** If llm-wiki drops the `## [date] op | title` log format, revert this change.

## Capability contract

- **Objective:** The `log.md` append is `## [<Rome date>] therss | Paper promotion — <safe title>`, a blank line, then the existing `- **THRSS_PAPER_PROMOTION** | …` bullet.
- **Interfaces:** Unchanged signatures and updated paths. Only the appended text changes.
- **Ownership:** Unchanged. llm-wiki owns the log format; TheRSS remains a governed writer.
- **Failure states:** Unchanged. The write still goes through the staged, hash-checked replacement.
- **Migration/rollback:** No data migration. Earlier bullets in the vault log stay as they are (llm-wiki archives them by quarter). Rollback is a revert. The installed app keeps the old format until it is rebuilt; reinstalling is a separate, user-authorized step.
- **Allowed scope:** `src/core/integrations/llmWikiVaultConfirm.ts`, `src/core/integrations/llmWikiVaultAdapter.test.ts`, and this record. No vault write from tests.

## Frozen acceptance contract

- **RED:** The adapter confirm test asserts that `log.md` ends with a heading line matching `## [YYYY-MM-DD] therss | Paper promotion — <title>` followed by the bullet. It fails on the current code because only the bullet is written.
- **Verifiers:** focused adapter suite, `npm run check`, diff review. No live model call, installation, push of `main` or release.
- **Stop:** All verifiers pass on the development build.

## Verification record (2026-11-10)

- **RED:** with only the new assertion, the adapter suite failed 1 of 18: `log.md` held `# Log` followed directly by the `THRSS_PAPER_PROMOTION` bullet.
- **GREEN:** after the one-line change in `llmWikiVaultConfirm.ts`, the adapter suite passes 18 of 18.
- **Full gate:** `npm run check` exit 0 (architecture, format, lint, typecheck, 878 + 194 tests, coverage above 80%, build).
- **Not done:** no merge, release or reinstall of the local beta app; the installed app writes the old format until it is rebuilt.
