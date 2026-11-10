# Change contract: stop writing index.md and correct the promotion prompt

## Feature intake

- **User outcome:** A promotion writes only where the llm-wiki rules allow, and the recorded prompt version matches the prompt text that produced the note.
- **Observed problems:**
  1. llm-wiki rules state that `index.md` is a content catalog and never receives per-paper entries. TheRSS appends every promotion to a `## TheRSS promoted papers` section of `index.md`. The same entry already goes to `## TheRSS manual promotions` in `Literature/Paper_Notes/Paper_Notes_Index.md`.
  2. The Codex prompt says "Include status/unread only for L2 because the live L1 template forbids duplicating status in tags". Since #96 the L1 template and the normalizer use `status/unread` for both levels and add `queue: must-read`, so the sentence is false. Changing prompt text without a new prompt version would break the provenance rule that model output keeps the prompt version that produced it.
- **Product fit:** No product or UI change.
- **Alternatives:** For (1), keep writing `index.md` and let the vault delete the section: the next promotion would recreate it. For (2), leave the stale sentence: harmless to the written note, but the prompt contradicts the vault. Select: stop the `index.md` write, and correct the sentence under a new prompt version.
- **Cost and boundaries:** Path constants, the confirm step, the prompt sentence, the prompt-version constant and receipt schema, their tests, the E2E fixture path list, and `docs/DESIGN.md`. No new package, IPC, storage table, UI, network or schedule.
- **Kill criterion:** If llm-wiki makes `index.md` a per-paper log again, revert (1).

## Capability contract

- **Objective:** A promotion updates the note's related Topic/Method pages, `Paper_Notes_Index.md` and `log.md`, and never reads or writes `index.md`. New receipts record `promptVersion: llm-wiki-promotion-v2`.
- **Interfaces:** `MUTABLE_INDEX_PATHS` and `REQUIRED_FILES` drop `index.md`; the required writer scopes drop `index.md`. The receipt schema accepts `llm-wiki-promotion-v1` (stored history) and `llm-wiki-promotion-v2` (new runs) and rejects other values. The receipt `version` field is unchanged.
- **Ownership:** Unchanged. llm-wiki owns its catalog rules and lock-scope registry.
- **Failure states:** Unchanged messages. A vault whose scope registry still lists `index.md` remains valid, because extra scopes are allowed.
- **Migration/rollback:** Stored v1 receipts keep validating, so no data migration is needed. The vault removes its `## TheRSS promoted papers` section separately (its one entry is also in `Paper_Notes_Index.md`). Rollback is a revert. The installed app changes only after the separate, user-authorized reinstall.
- **Allowed scope:** `src/core/integrations/llmWikiVaultTypes.ts`, `llmWikiVaultConfirm.ts`, `llmWikiVaultSupport.ts`, `src/shared/llmWikiPromotion.ts`, `src/main/index.ts` (E2E fixture path list only), their tests, `docs/DESIGN.md`, `docs/AGENT_SETUP.md` (scope list, which also still named the `Methods` scope removed in #94), and this record. No vault write from tests.

## Frozen acceptance contract

- **Test contract change (recorded before editing):** the adapter tests expected `index.md` in `updatedPaths`, and the concurrent-edit test used `index.md` as its concurrently edited file. Both encode the old write set. The concurrent-edit test keeps its meaning and uses `Paper_Notes_Index.md` instead.
- **RED:** the adapter test asserts `updatedPaths` without `index.md` and `index.md` unchanged after a successful promotion; the schema test asserts that a v2 receipt validates and an unknown version does not. Both fail on the current code.
- **Verifiers:** focused suites, `npm run check`, diff review. No live model call, installation, push of `main` or release.
- **Stop:** All verifiers pass on the development build.

## Verification record (2026-11-10)

- **RED:** with only the new assertions, 2 of 22 focused tests failed: `updatedPaths` still contained `index.md`, and the schema rejected a v2 receipt.
- **GREEN:** the integration, shared and storage suites pass (179 of 179).
- **Full gate:** `npm run check` exit 0 (architecture, format, lint, typecheck, 878 + 194 tests, coverage above 80%, build). The first run failed only on Prettier formatting of `llmWikiVaultTypes.ts`; fixed with `prettier --write`.
- **Not done here:** release. Reinstalling the local beta app is a separate step.
