# Change contract: promoted notes join the llm-wiki reading queue

## Feature intake

- **User outcome:** A paper the user promotes from TheRSS appears in the llm-wiki "must-read" queue and passes the vault's read-state check.
- **Observed problem:** On 2026-11-10 llm-wiki separated "has the user read it" from "should the user read it". Every L1/L2 note now carries `queue` (`must-read | skim | reference`) and `queue_date`, and the vault health check (`System/Scripts/wiki_lint.py`) warns on an unread note without `queue`. The same change fixed the L1 template: L1 notes now carry `status/unread` like L2 notes, because the vault requires `status`, `read_date` and the `status/*` tag to agree. TheRSS writes neither queue field and refuses an L1 note that has `status/unread`, so every promotion would fail the vault check.
- **Product fit:** No product or UI change. A promotion is a user choice, so the vault rule assigns it `queue: must-read`.
- **Alternatives:** (1) Let the vault default missing `queue` values: the vault check would keep warning, and the user's choice would be lost. (2) Write the fields in the deterministic frontmatter normalizer. Select (2).
- **Cost and boundaries:** The normalizer and validator in `llmWikiVaultSupport.ts` and their adapter tests. No new package, IPC, storage, UI, network or schedule.
- **Kill criterion:** If llm-wiki drops the `queue` field or the L1 `status/*` tag rule, revert this change.

## Capability contract

- **Objective:** Promoted L1 and L2 notes carry `queue: must-read`, `queue_date: <promotion date>` and the `status/unread` tag.
- **Interfaces:** Unchanged signatures. The Codex prompt text and `llm-wiki-promotion-v1` stay unchanged: the normalizer rewrites the whole note frontmatter, so the prompt's tag sentence does not reach the note. Changing the prompt would need a prompt-version change; it is left for a separate decision.
- **Ownership:** Unchanged. llm-wiki owns the queue rules (its `_schema.md` §2.4); TheRSS remains a governed writer.
- **Failure states:** Unchanged messages. The validator now rejects a note without the queue fields and no longer rejects `status/unread` on L1.
- **Migration/rollback:** No TheRSS data migration. Existing vault notes were assigned by the vault's own one-time migration. Rollback is a revert. The installed app keeps the old behavior until it is rebuilt; reinstalling is a separate, user-authorized step.
- **Allowed scope:** `src/core/integrations/llmWikiVaultSupport.ts`, `src/core/integrations/llmWikiVaultAdapter.test.ts`, and this record. No vault write from tests.

## Frozen acceptance contract

- **Test contract change (recorded before editing):** the L1 adapter test asserted that an L1 note has no `status/unread` tag. That assertion encoded the old vault template and changes because the vault rule changed, not to fit an implementation.
- **RED:** the normalization test (L2) and the L1 test assert `queue: must-read`, a dated `queue_date`, and `status/unread`; both fail on the current code.
- **Verifiers:** focused adapter suite, `npm run check`, diff review. No live model call, installation, push of `main` or release.
- **Stop:** All verifiers pass on the development build.

## Verification record (2026-11-10)

- **RED:** with only the new assertions, the adapter suite failed 2 of 18 (the L2 normalization test and the L1 test): no `queue` lines, and the L1 note had no `status/unread`.
- **GREEN:** after the normalizer and validator change, the adapter suite passes 18 of 18.
- **Full gate:** `npm run check` exit 0 (architecture, format, lint, typecheck, 878 + 194 tests, coverage above 80%, build).
- **Not done:** no merge, release or reinstall of the local beta app. The prompt sentence about L1 status tags is now stale but has no effect on the written note; changing it needs a prompt-version decision.
