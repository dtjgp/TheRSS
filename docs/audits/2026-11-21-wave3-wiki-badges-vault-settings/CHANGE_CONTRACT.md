# Change Contract: Wave 3 — I5 List-Level llm-wiki Badges/Filters, P1-6 Vault Settings & Diagnostics, and Hotspot Splits

## Feature Intake

- User outcome:
  1. **I5 (`PRIORITIES.md` #4)**: Discover and Saved paper rows show compact, truthful `llm-wiki` membership badges (`In llm-wiki · L1`, `In llm-wiki · L2`, `In llm-wiki · Record only`, `llm-wiki: Pending`, fault states) via one bounded batch read per list, and expose an `All llm-wiki` / `In llm-wiki` / `Not in llm-wiki` filter without triggering extra scans, network calls, or vault writes.
  2. **P1-6 (`PRIORITIES.md` #6)**: Native Settings includes a **Knowledge Base** (`llm-wiki`) pane displaying the resolved vault path and origin (`Environment override` / `Custom folder` / `Default folder`), structured local diagnostics with concrete remediation hints (missing folder, symlink, missing `AGENTS.md`/`_schema.md`, missing `raw/paper_records` or `Literature/Paper_Notes`), and explicit `Choose folder…`, `Use default folder`, and `Recheck vault` actions.
  3. **Structural health**: Split the 800-line ceiling file `src/core/storage/researchRepository.test.ts` (flagged as L4 in Wave 2 QA), trim `src/core/storage/researchRepository.ts` (714 lines), and split `src/core/integrations/llmWikiVaultSupport.ts` (736 lines) into cohesive modules well below the 800-line limit.
- Observed problem/evidence:
  - Currently `llm-wiki` membership is only visible after selecting a paper in the detail reader (`WikiStatus`). Scanning a list of papers requires clicking each one.
  - Vault root is currently fixed to `THERSS_LLM_WIKI_PATH` or `~/Obsidian/llm-wiki` with no in-app folder chooser or diagnostic checklist.
  - `src/core/storage/researchRepository.test.ts` sits at exactly 800 lines, blocking any new storage test additions.
- Product fit and relevant non-goal: Read-only membership badges, bounded local vault path preference + diagnostics, and zero-behavior-change file splits directly support `PRODUCT.md` and `GOALS.md`. Does NOT expand vault writer scope (no GitHub/news Inbox promotion in this wave, no note-body indexing, no vault writes from Settings or list scanning).
- Boundary changes:
  - Additive shared contracts in `src/shared/llmWikiLibrary.ts`, `src/shared/llmWikiListFilter.ts`, `src/shared/llmWikiSettings.ts`, `src/shared/api.ts`, and `src/shared/ipc.ts`.
  - Additive SQLite table `llm_wiki_settings` (`CREATE TABLE IF NOT EXISTS`, ignored cleanly by older builds, zero destructive migration).
  - Native AppKit Settings adds a 3rd pane `'wiki'` (`Knowledge Base`) in `SettingsSection` (`src/main/appkit/common.ts` / `settings.ts` / `settingsWiki.ts`); Web fallback untouched in this wave.
- Kill criterion: If batch status lookup triggers repeated full vault scans per row or if vault path changes fail to invalidate cached library scans / fail to honor `THERSS_LLM_WIKI_PATH` precedence, stop and fix before merging.
- Decision: proceed.

## Capability Contract

- Objective: Ship I5 batch `llm-wiki` badges & filters, P1-6 vault folder configuration & read-only diagnostics, and hotspot splits for `researchRepository.test.ts`, `researchRepository.ts`, and `llmWikiVaultSupport.ts`.
- Goals:
  1. **Slice 3A (`core-retrieval-storage` · Codex)**:
     - Add additive SQLite store `src/core/storage/llmWikiSettingsStore.ts` (`CREATE TABLE IF NOT EXISTS llm_wiki_settings`) supporting `getLlmWikiVaultPath()` and `saveLlmWikiVaultPath(vaultPath: string | null)` using `llmWikiVaultPathSchema`, wired into `researchSchema.ts` and `researchRepository.ts`, with unit tests in `src/core/storage/llmWikiSettingsStore.test.ts`.
     - Split `src/core/storage/researchRepository.test.ts` (800 lines) by extracting Discover/Analytics/Personalization tests into `src/core/storage/researchRepository.discover.test.ts` (keeping every existing assertion intact and both files comfortably `<= 500` lines).
     - Trim `src/core/storage/researchRepository.ts` (714 lines → `< 650` lines) without changing public APIs.
  2. **Slice 3B (`ai-wiki-integration` · Claude)**:
     - Add `statusBatch(request: LlmWikiBatchStatusRequest): Promise<LlmWikiBatchStatusResponse>` to `src/core/integrations/llmWikiLibrary.ts`, performing at most ONE `this.scan(refresh)` for up to 200 unique arXiv IDs, isolating per-paper header failures cleanly, and supporting dynamic `resolveVaultRoot?: () => string` + `clearCache()` when the configured vault path changes.
     - Add read-only `src/core/integrations/llmWikiDiagnostics.ts` + `llmWikiDiagnostics.test.ts` validating resolved vault root (origin `'env' | 'custom' | 'default'`, exists/directory/non-symlink, required files `AGENTS.md` and `_schema.md`, required folders `raw/paper_records` and `Literature/Paper_Notes`) with clear `ready` / `incomplete` / `unavailable` status and actionable remediation strings; never writes to the vault.
     - Update `LlmWikiDaily` and `LlmWikiVaultAdapter` to accept optional dynamic `resolveVaultRoot?: () => string` (preserving existing `vaultRoot` option backward compatibility).
     - Split `src/core/integrations/llmWikiVaultSupport.ts` (736 lines) into cohesive modules (e.g. `llmWikiVaultPaths.ts` + `llmWikiVaultSupport.ts` both `< 500` lines) while re-exporting all existing public symbols from `llmWikiVaultSupport.ts`.
  3. **Slice 3C (`native-ui` · Gemini)**:
     - Add `src/main/appkit/wikiListState.ts` + tests to fetch batch statuses once per list via `api.getLlmWikiStatuses` (when available), cache by arXiv ID, refresh a single paper on `llmWikiChanged(arxivId)`, and format list subtitles via `llmWikiListBadge` / filter rows via `matchesLlmWikiListFilter`.
     - Wire I5 badges + `discover-wiki-filter` (`All llm-wiki` / `In llm-wiki` / `Not in llm-wiki`) into `src/main/appkit/discover.ts` & `discoverToolbar.ts`, and `saved-wiki-filter` into `src/main/appkit/saved.ts`, preserving `sourceOutcomes`, `openLocal` checkpoint/restore, and empty-filter `Show all` reset.
     - Add P1-6 `'wiki'` (`Knowledge Base`) pane to `SettingsSection` (`src/main/appkit/common.ts`, `settings.ts`, and extracted `src/main/appkit/settingsWiki.ts`) showing resolved path, origin, structured diagnostic checks with remediation hints, `Choose folder…`, `Use default folder`, and `Recheck vault` actions. Keep every file well below 750 lines.
  4. **Coordinator Integration (`technical-pm`)**:
     - Wire `getLlmWikiStatuses`, `getLlmWikiSettings`, `saveLlmWikiVaultPath`, `chooseLlmWikiVaultFolder` through `src/main/windowApplication.ts`, `src/main/windowApplicationRuntime.ts`, `src/preload/index.ts`, `src/main/index.ts`, and `src/main/e2eFixtures.ts` (plus native folder dialog handler in `src/main/index.ts`).
- Non-goals: No real vault writes, no GitHub/news Inbox promotion, no note-body indexing, no Web fallback UI redesign, no `native/appkit/*.mm` C++ changes.
- Allowed scope:
  - Frozen shared contract (`technical-pm`): `src/shared/llmWikiLibrary.ts`, `src/shared/llmWikiListFilter.ts`, `src/shared/llmWikiListFilter.test.ts`, `src/shared/llmWikiSettings.ts`, `src/shared/llmWikiSettings.test.ts`, `src/shared/api.ts`, `src/shared/ipc.ts`
  - Slice 3A (`core-retrieval-storage`): `src/core/storage/llmWikiSettingsStore.ts`, `llmWikiSettingsStore.test.ts`, `researchSchema.ts`, `researchRepository.ts`, `researchRepository.test.ts`, `researchRepository.discover.test.ts`
  - Slice 3B (`ai-wiki-integration`): `src/core/integrations/llmWikiLibrary.ts`, `llmWikiLibrary.test.ts`, `llmWikiDiagnostics.ts`, `llmWikiDiagnostics.test.ts`, `llmWikiDaily.ts`, `llmWikiVaultAdapter.ts`, `llmWikiVaultSupport.ts`, `llmWikiVaultPaths.ts` (and existing integration tests)
  - Slice 3C (`native-ui`): `src/main/appkit/common.ts`, `src/main/appkit/wikiListState.ts`, `src/main/appkit/wikiListFilter.test.ts`, `src/main/appkit/discover.ts`, `src/main/appkit/discoverToolbar.ts`, `src/main/appkit/saved.ts`, `src/main/appkit/settings.ts`, `src/main/appkit/settingsWiki.ts`, `src/main/appkit/settingsWiki.test.ts`, `src/main/appkit/testHarness.ts`

## Frozen Acceptance Contract

- RED verifier: Each specialist adds failing tests first for its slice (storage store + round-trip, batch status + diagnostics + dynamic root, native list badges/filters + Settings Knowledge Base pane) and confirms RED before implementing GREEN.
- Full verifier: `npm run check`, `npm run smoke:mcp`, `npm run test:e2e`, `smoke:appkit`, and cross-family independent QA (`APPROVED` on all tracks).
- Stop condition: All 3 slices + main/preload integration complete, full gates green, and cross-family QA returns unanimous `APPROVED`.
