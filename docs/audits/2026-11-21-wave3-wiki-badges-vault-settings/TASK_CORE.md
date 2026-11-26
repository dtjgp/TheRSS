# Task Spec — Slice 3A (`core-retrieval-storage` · Codex)

Read `docs/audits/2026-11-21-wave3-wiki-badges-vault-settings/CHANGE_CONTRACT.md` first.

## Owned Files (strictly stay inside these paths)

- `src/core/storage/llmWikiSettingsStore.ts` (new)
- `src/core/storage/llmWikiSettingsStore.test.ts` (new)
- `src/core/storage/researchSchema.ts`
- `src/core/storage/researchRepository.ts`
- `src/core/storage/researchRepository.test.ts`
- `src/core/storage/researchRepository.discover.test.ts` (new split target)

## Deliverables

1. **Additive SQLite `llm_wiki_settings` store (`llmWikiSettingsStore.ts`)**:
   - Export `LLM_WIKI_SETTINGS_TABLE` (`CREATE TABLE IF NOT EXISTS llm_wiki_settings (singleton_id INTEGER PRIMARY KEY CHECK (singleton_id = 1), vault_path TEXT, updated_at TEXT NOT NULL)`).
   - Export `readLlmWikiVaultPath(database): string | null` and `saveLlmWikiVaultPath(database, candidate: unknown, now?: string): string | null`.
   - Validate input with `llmWikiVaultPathSchema` from `../../shared/llmWikiSettings` (reject relative paths, `..`, control chars, >1000 chars; accept `null` to reset to default; normalize trailing slashes).
   - Wire `LLM_WIKI_SETTINGS_TABLE` into `researchSchema.ts` (additive, safe for existing databases) and expose `getLlmWikiVaultPath()` and `saveLlmWikiVaultPath(vaultPath: string | null)` on `ResearchRepository`.
2. **Split `researchRepository.test.ts` (currently 800 lines)**:
   - Move Discover/Analytics/Personalization test cases cleanly into `src/core/storage/researchRepository.discover.test.ts` WITHOUT weakening or deleting ANY existing assertion. Both test files must be comfortably `<= 500` lines.
3. **Keep `researchRepository.ts` trim**:
   - Keep `researchRepository.ts` comfortably `< 720` lines (all storage logic for `llm_wiki_settings` lives in `llmWikiSettingsStore.ts`).
4. **TDD & Verification**:
   - Write failing tests in `llmWikiSettingsStore.test.ts` first (RED), implement (GREEN), split `researchRepository.test.ts`, and verify `npm run check` exits 0 with >=80% coverage on all changed/new files and all `src/` files <= 800 lines. No `git push`.
