# Wave 2 Cross-Family Independent QA Review — Round 1

Date: 2026-11-20
Branch: `feat/wave2-retrieval-quality-and-time-sort` (base `b51a927`, frozen shared contract `7d996ab` + integrated Slices 2A, 2B, 2C)

## Summary Verdict

- **Overall Round 1 Verdict**: `CHANGES_REQUESTED` (1 HIGH, 4 MEDIUM, 6 LOW across both cross-family reviews; **0 Critical**).
- **Shared Contract (`src/shared/*`) & Slice 2C (`native-ui`)**: No blocking findings (only optional LOW follow-ups L2, L3, L5).
- **Slice 2A (`core-retrieval-storage` · Codex)** — audited by `qa-security-reviewer` (Claude Opus 5.5 High): **1 HIGH (H1), 2 MEDIUM (M1, M2), 2 actionable LOW (L1, L4)**.
- **Slice 2B (`ai-wiki-integration` · Claude)** — audited by cross-family fallback reviewer (`release-devops` · GPT-6.2-Sol High, zero Wave 2 authorship): **2 MEDIUM (B-M1, B-M2), 1 actionable LOW (B-L1)**.

---

## Track A: Shared Contract + Slice 2A + Slice 2C + Integration Fit

- **Reviewer**: `qa-security-reviewer` (Claude Opus 5.5 High, read-only)
- **Verdict**: `CHANGES_REQUESTED`

### Findings

1. **HIGH (H1) — `src/core/ranking/rankDiscoveryItem.ts:13-21` (`includesWholeTerm`)**
   - Regular English plural inflections fail to match (`"llm"` misses `"LLMs"`, `"transformer"` misses `"Transformers"`, `"survey"` misses `"surveys"`). Combined with the `-20` partial-coverage penalty, a true multi-constraint hit like `"Structured Pruning of LLMs"` with `[["llm"], ["pruning"]]` is demoted to score `10`, tying with single-facet distractor `"Pruning for CNNs"`. Exclusions like `"survey"` also stop excluding `"surveys"`.
   - **Action**: For Latin terms whose last character is a letter, accept optional English plural suffix `(?:s|es)?` before the trailing boundary across keywords, exclusions, and coverage while keeping short-substring false positives (`"address"` vs `"dr"`, `"every"` vs `"ev"`, `"paid"` vs `"ai"`) blocked. Add RED → GREEN tests.
2. **MEDIUM (M1) — `src/core/ranking/rankDiscoveryItem.ts:20`**
   - Latin terms adjacent to CJK characters fail because CJK characters match `\p{L}` (`"llm"` in `"基于LLM的推荐系统"`, `"ai"` in `"AI驱动的需求响应"` both returned `false`), hurting NCPSD (`folo:611`) and mixed-script records.
   - **Action**: Treat CJK-script characters (`[\p{Script=Han}\p{Script=Hiragana}\p{Script=Katakana}\p{Script=Hangul}]`) as valid boundaries for Latin whole-term matching. Add mixed-script RED → GREEN tests.
3. **MEDIUM (M2) — `src/core/ranking/rankDiscoveryItem.ts:19`**
   - Multi-word phrases require exact separator parity (`"low rank"` misses `"low-rank"`, `"low-rank"` misses `"low rank"`, and `"carbon\nintensity"` misses `"carbon intensity"`).
   - **Action**: Normalize internal whitespace/hyphen runs in escaped multi-word terms to match `[\s\-‐–]+`. Add bidirectional RED → GREEN tests.
4. **LOW (L1 — Adopted in Round 1 Revision) — `src/core/discover/discoverService.ts:167` & `src/core/ranking/rankDiscoveryItem.ts:13`**
   - Duplicate `includesWholeTerm` copies would cause browse-only semantic gating (`hasSemanticMatch`) and ranking to diverge after H1/M1/M2 fixes.
   - **Action**: Extract one shared `includesWholeTerm` helper into `src/core/ranking/termMatch.ts` (with `src/core/ranking/termMatch.test.ts`) and reuse it in both `rankDiscoveryItem.ts` and `discoverService.ts`.
5. **LOW (L4 — Tracked) — `src/core/storage/researchRepository.test.ts`**
   - Currently at 800 lines (exact architecture limit); avoid adding further lines here in Round 2 (defer split to Wave 3 hotspot cleanup).
6. **LOW (L2, L3, L5 — Deferred optional polish)**
   - L2 (`discoverViewFilter.ts` upper bound for future-dated items), L3 (native row subtitle showing `Updated <date>` when `updatedAt` drives `Newest`), L5 (time-filtered kind segment counts & native smoke coverage for `discover-time-range`/`discover-sort`): tracked as non-blocking follow-ups outside the frozen Wave 2 contract.

---

## Track B: Slice 2B Cross-Family Review (`ai-wiki-integration`)

- **Reviewer**: Cross-family fallback (`release-devops` · GPT-6.2-Sol High, read-only, zero Wave 2 authorship)
- **Verdict**: `CHANGES_REQUESTED`

### Findings

1. **MEDIUM (B-M1) — `src/core/discover/discoverPlan.ts:20,30-45,73-77`**
   - Length is validated before locale-sensitive `.toLocaleLowerCase()`. Input of 100 `U+0130` (`İ`) characters passes length validation, expands to 200 code units after lowercasing, and then fails re-parsing on SQLite snapshot reload (`discoverSnapshotStore.ts:255`).
   - **Action**: Use locale-independent `.toLowerCase()` for constraint terms and enforce `MAX_TERM_LENGTH` **after** normalization. Add an expanding-case round-trip regression test.
2. **MEDIUM (B-M2) — `src/core/discover/discoverPlan.ts:73-77`**
   - Identical normalized terms across distinct `constraintGroups` (e.g., `[["Energy"], ["energy"]]`) are accepted, letting a single-facet item earn `+35` and `"Covers all 2 intent constraints"`.
   - **Action**: Fail closed in `discoverPlanSchema` when two distinct `constraintGroups` share a normalized term. Add a regression test.
3. **LOW (B-L1 — Adopted in Round 1 Revision) — `src/core/discover/discoverPlan.ts:9-13,27-33,73-77`**
   - `.trim()` strips leading/trailing ASCII controls (`\t`, `\n`) before control-character checks, and `containsControlCharacter` misses Unicode C1 controls (`U+0080–U+009F`, e.g., `U+0085`).
   - **Action**: Validate raw `constraintGroups` terms against Unicode control characters (`/\p{Cc}/u`) **before** trimming while preserving legacy field compatibility. Add edge and C1 control regression tests.
