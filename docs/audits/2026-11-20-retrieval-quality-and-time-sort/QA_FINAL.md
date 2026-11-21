# Wave 2 Cross-Family Independent QA Review — Final Closeout (Rounds 2–3)

Date: 2026-11-21
Branch: `feat/wave2-retrieval-quality-and-time-sort`
Final Audited Commit: `72ee92a3e57541f7b18a436dbbb08c75a24e124a`

## Final Verdicts

| Review Track                                                             | Reviewer (Cross-Family)                                                  | Round 1             | Round 2             | Round 3 (Final) |
| ------------------------------------------------------------------------ | ------------------------------------------------------------------------ | ------------------- | ------------------- | --------------- |
| Track A: Shared Contract (Gemini) + Slice 2A (Codex) + Slice 2C (Gemini) | `qa-security-reviewer` (`claude/claude-opus-5-5`, read-only)             | `CHANGES_REQUESTED` | **`APPROVED`**      | **`APPROVED`**  |
| Track B: Slice 2B (Claude) + Cross-Slice Integration                     | Cross-family fallback (`codex/gpt-6.2-sol`, read-only, 0 lines authored) | `CHANGES_REQUESTED` | `CHANGES_REQUESTED` | **`APPROVED`**  |

## Closed Findings Ledger

| ID   | Severity | Summary                                                                                                          | Resolution Commit | Closed By       |
| ---- | -------- | ---------------------------------------------------------------------------------------------------------------- | ----------------- | --------------- |
| H1   | HIGH     | `includesWholeTerm` missed English regular plurals (`LLMs`, `Transformers`, `surveys`), triggering `-20` penalty | `011f062`         | Track A Round 2 |
| M1   | MEDIUM   | Latin terms adjacent to CJK characters failed (`基于LLM的推荐系统`, `AI驱动的需求响应`)                          | `011f062`         | Track A Round 2 |
| M2   | MEDIUM   | Multi-word phrases failed across hyphen/space/newline separator variants (`low rank` vs `low-rank`)              | `011f062`         | Track A Round 2 |
| L1   | LOW      | Duplicate `includesWholeTerm` copies in `rankDiscoveryItem.ts` and `discoverService.ts`                          | `011f062`         | Track A Round 2 |
| B-M1 | MEDIUM   | `discoverPlan.ts` checked `MAX_TERM_LENGTH` before locale-sensitive lowercasing (`U+0130` reload break)          | `011f062`         | Track B Round 2 |
| B-M2 | MEDIUM   | Distinct `constraintGroups` could share identical normalized terms (`[["Energy"], ["energy"]]`)                  | `011f062`         | Track B Round 2 |
| B-L1 | LOW      | `.trim()` stripped leading/trailing ASCII controls and missed Unicode C1 controls (`U+0085`)                     | `011f062`         | Track B Round 2 |
| I-M1 | MEDIUM   | Cross-group uniqueness checked literal strings while `termMatch` merged separator/plural variants (`llm`/`llms`) | `72ee92a`         | Track B Round 3 |

## Verification Evidence on Final Code (`72ee92a`)

- `npm run check`: **PASS**
  - `check:architecture`: all owned `src/` files `<= 800` lines
  - `format:check` (`prettier --check .`), `lint` (`eslint .`), `typecheck` (`tsc --noEmit`): PASS
  - `test:coverage`: **146/146 files, 1,073/1,073 tests passed** (`All files`: 92.7% stmts / 84.77% branches / 95.87% funcs / 94.96% lines; `termMatch.ts` 100/100/100/100%, `discoverPlan.ts` 100/90.32/100/100%)
  - `test:appkit`: **41/41 files, 234/234 tests passed** (`All files`: 90.41% / 85.26% / 87.84% / 92.68%)
  - `build` (main, preload, renderer, native glass, native AppKit, MCP): PASS
- `npm run smoke:mcp`: **PASS** (`list_today_items, get_item, get_analysis_context`)
- `npm run test:e2e`: **11/11 passed** (10/11 initial + 2/2 `e2e/native-glass.spec.ts` rerun; includes `e2e/desktop.spec.ts:707` `semantic-discover-v3` check)
- `smoke:appkit` (verified on integrated Slice 2C, unchanged in Rounds 2–3): `THERSS_NATIVE_DEFAULT_ONLY=1 THERSS_NATIVE_SCREENSHOTS=0 node scripts/smoke-native-appkit.mjs` **17/17 workflow groups passed**; `node scripts/smoke-appkit-controls.mjs` **20/20 groups passed**

## Tracked Non-Blocking Residuals (Deferred to Wave 3 / Later)

- `src/core/storage/researchRepository.test.ts` is at exactly 800 lines (`L4`): split before adding new storage tests in Wave 3.
- Optional UI/filter follow-ups (`L2` future-date upper bound, `L3` row subtitle showing `Updated <date>` under `Newest`, `L5` time-filtered kind counts + native smoke assertion for `discover-time-range`/`discover-sort`).
- Opt-in live P0-1 relevance evaluation (`semantic-discover-v3` with real LLM + live sources) and human physical-keyboard/VoiceOver verification remain explicit user-authorized gates.
