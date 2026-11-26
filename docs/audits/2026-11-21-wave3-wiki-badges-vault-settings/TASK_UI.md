# Task Spec — Slice 3C (`native-ui` · Gemini)

Read `docs/audits/2026-11-21-wave3-wiki-badges-vault-settings/CHANGE_CONTRACT.md` and `skills/therss-ui-improvement/SKILL.md` first.

## Owned Files (strictly stay inside these paths)

- `src/main/appkit/common.ts`
- `src/main/appkit/wikiListState.ts` (new)
- `src/main/appkit/wikiListFilter.test.ts` (new)
- `src/main/appkit/discover.ts`
- `src/main/appkit/discoverToolbar.ts`
- `src/main/appkit/saved.ts`
- `src/main/appkit/settings.ts`
- `src/main/appkit/settingsWiki.ts` (new)
- `src/main/appkit/settingsWiki.test.ts` (new)
- `src/main/appkit/testHarness.ts` (only if adding optional mock defaults for the new API methods)

Do NOT edit `src/shared/`, `src/core/`, `src/renderer/`, or `native/appkit/*.mm`.

## Deliverables

1. **Shared native list-level llm-wiki state (`src/main/appkit/wikiListState.ts`)**:
   - Manage bounded batch status lookups via `context.api.getLlmWikiStatuses?.({ arxivIds, refresh })` (gracefully degrades to no-op if the optional method is absent in legacy mocks).
   - Deduplicate in-flight/cached requests per unique arXiv ID list so rendering never triggers redundant IPC calls.
   - Expose `sync(items)` (extracts eligible arXiv IDs via `llmWikiArxivId`, fetches any missing IDs in ONE batch, triggers `context.redraw()` on completion), `refreshOne(arxivId)` (called from `llmWikiChanged(arxivId)` after promotion!), `invalidateAll()` (called when Settings changes the vault folder), `badge(item)` (delegates to `llmWikiListBadge`), `matches(item, filter)` (delegates to `matchesLlmWikiListFilter`), and `dispose()`.
2. **I5 in Discover (`discover.ts`, `discoverToolbar.ts`) & Saved (`saved.ts`)**:
   - Append the non-null `llmWikiListBadge` cleanly to row subtitles (`${researchSubtitle(...)} · ${badge}`) on Discover and Saved tables without altering row glyphs or drag payloads.
   - Add `discover-wiki-filter` (`select` with `LLM_WIKI_LIST_FILTER_OPTIONS`: `All llm-wiki` / `In llm-wiki` / `Not in llm-wiki`) in `discoverToolbar.ts` and `saved-wiki-filter` in `saved.ts`.
   - Preserve `sourceOutcomes`, never trigger network/model calls on wiki filter changes, include `wikiFilter` in `openLocal` checkpoint/restore (resetting to `'all'` so opened historical items remain visible), reset to `'all'` on new Discover searches, and reset `wikiFilter` on `Show all results` / `Show all Saved` empty-filter recovery.
   - Wire `llmWikiChanged(arxivId)` in both `DiscoverScreen` and `SavedScreen` to call `wikiList.refreshOne(arxivId)` in addition to `reader.llmWikiChanged(arxivId)`.
3. **P1-6 Knowledge Base Settings pane (`common.ts`, `settings.ts`, `settingsWiki.ts`)**:
   - Extend `SettingsSection = 'personal' | 'provider' | 'wiki'` in `src/main/appkit/common.ts`.
   - Add `wiki: { title: 'Knowledge Base', symbol: 'square.stack' }` to `SETTINGS_SECTIONS` in `settings.ts` (reusing existing `square.stack` symbol — zero native ObjC++ changes!).
   - Extract the Knowledge Base pane controller/renderer into `src/main/appkit/settingsWiki.ts` (keeping `settings.ts` trim!):
     - Loads diagnostics via `context.api.getLlmWikiSettings?.()` when opened / loaded.
     - Displays resolved vault path, origin label (`Environment override` / `Custom folder` / `Default folder`), overall status (`Ready` / `Incomplete` / `Unavailable`), last-checked timestamp, and every diagnostic check with its status and remediation hint when non-ok.
     - Provides `wiki-choose-folder` (`Choose folder…` → calls `chooseLlmWikiVaultFolder()`, if not canceled and path present calls `saveLlmWikiVaultPath(path)` and triggers `options.changed?.()`), `wiki-use-default` (`Use default folder` → calls `saveLlmWikiVaultPath(null)` when `customPath !== null`), and `wiki-recheck` (`Recheck vault` → reloads diagnostics).
     - When `origin === 'env'`, clearly notes that `THERSS_LLM_WIKI_PATH` overrides saved folder selection.
     - Preserve existing `Personal Context` and `Model Provider` behavior, dirty tracking, and `settingsPresenter.test.ts` expectations unchanged!
4. **TDD & Verification**:
   - Write failing RED tests in `src/main/appkit/wikiListFilter.test.ts` and `src/main/appkit/settingsWiki.test.ts`, verify RED, implement GREEN, and verify `npm run test:appkit` + `npm run check` exit 0 with >=80% coverage on all changed/new files and every file <= 800 lines. No `git push`.
