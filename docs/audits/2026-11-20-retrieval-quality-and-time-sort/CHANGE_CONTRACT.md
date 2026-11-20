# Change Contract: Wave 2 — Multi-Constraint Retrieval Quality & I3 Time/Sort Controls

## Feature Intake

- User outcome:
  1. Multi-constraint Discover queries (e.g., training carbon/energy + deadlines; residential electricity cost + comfort demand response; structured channel pruning) rank items that satisfy **all/multiple** user constraints ahead of broad single-concept distractors, with inspectable `MatchReason` evidence.
  2. Native Discover users can narrow persisted session results by time window (`All dates`, `Last 7 days`, `Last 30 days`) and switch between `Relevance` and `Newest` sorting locally without rerunning models or source adapters.
- Observed problem/evidence:
  - The 2026-09-07 quality baseline (`docs/audits/2026-09-07-source-quality/REPORT.md`) measured only 0%–20% Top-10 direct relevance on multi-constraint queries because:
    - `discoverPlanner.ts` (`semantic-discover-v2`) produces flat keywords without decomposing required constraint facets or explicit adjacent-domain exclusions.
    - `rankDiscoveryItem.ts` scores keywords purely additively using raw substring `.includes()`, allowing broad single-facet items with category/recency bonuses (or short substring false positives) to outrank true multi-constraint matches.
  - `PRIORITIES.md` P1-5 and `2026-11-12-interaction-review/DECISION.md` I3 record missing time range and newest-sort controls in Discover.
- Product fit and relevant non-goal: Directly serves Discover core capability in `PRODUCT.md` and `GOALS.md`. Keeps ranking 100% deterministic, explainable, and testable without an LLM; no vector/embedding ranking, no live calls in tests, no SQLite schema migration.
- Alternatives considered, including no change: Tuning static keyword weights without constraint facets cannot separate single-facet high-category papers from multi-constraint matches; deferring I3 keeps "latest" discovery noisy.
- Cost: Focused TypeScript updates across `src/shared/`, `src/core/ranking/`, `src/core/discover/`, `src/core/storage/`, `src/core/evaluation/`, and `src/main/appkit/`; zero new dependencies, zero SQLite schema migrations.
- Boundary changes:
  - Additive optional field `constraintGroups?: readonly (readonly string[])[]` on `DiscoverPlan` (`version: 'discover-plan-v1'`, backward compatible with all stored plans).
  - Prompt version bump `semantic-discover-v2` → `semantic-discover-v3` (legacy v1 and v2 provenance records remain readable).
  - Additive `MatchReasonKind` value `'coverage'`.
  - New pure local view filter/sort module `src/shared/discoverViewFilter.ts` wired into native AppKit `DiscoverScreen` (Web fallback left unchanged in this slice per I4 precedent).
- Kill criterion: If whole-term matching or constraint-coverage scoring breaks existing single-facet deterministic ranking tests or weakens browse-only semantic match gating, revert and narrow.
- Decision: proceed.

## Capability Contract

- Objective: Ship deterministic multi-constraint ranking (`rankDiscoveryItem` + `semantic-discover-v3` planner + SQLite v3 provenance support) and native Discover local time-range (`All dates` / `Last 7 days` / `Last 30 days`) & sort (`Relevance` / `Newest`) controls.
- Goals:
  1. **Whole-term matching & multi-constraint coverage (`core-retrieval-storage`)**:
     - Upgrade `rankDiscoveryItem` keyword & exclusion matching to whole-term matching for Latin/alphanumeric terms (preserving CJK substring matching) to stop short-term false positives.
     - Accept optional 4th argument `options?: { readonly constraintGroups?: readonly (readonly string[])[] }` (100% backward compatible).
     - When `constraintGroups` has >= 2 facets, emit one explicit `'coverage'` `MatchReason` awarding a deterministic multi-facet bonus (`+35` full coverage, `+16` multi-facet >=2 of N when N >= 3) and applying an explicit partial-match penalty (`-20` for 1 of N, `-35` for 0 of N; final score clamped >= 0).
     - Update `discoverSnapshotStore.ts` to accept `'semantic-discover-v3'` (requiring boolean `personalizationApplied`) while preserving full backward compatibility for `v1` and `v2`.
     - Add deterministic offline multi-constraint regression tests in `src/core/evaluation/discoveryQuality.test.ts` covering the 2026-09-07 failure modes (verifying multi-constraint matches outrank single-concept distractors).
  2. **Constraint-aware planning (`ai-wiki-integration`)**:
     - Extend `discoverPlanSchema` in `src/core/discover/discoverPlan.ts` with optional `constraintGroups` (up to 4 groups, each 1–4 bounded lowercase deduplicated terms; optional so legacy plans pass unchanged).
     - Bump `DISCOVER_PROMPT_VERSION` to `'semantic-discover-v3'` in `discoverPlanner.ts`, instructing planners to decompose multi-constraint queries into `constraintGroups`, include compound multi-word phrases, and emit explicit adjacent-domain `excludeKeywords`.
     - Pass `plan.constraintGroups` into `rankDiscoveryItem` in `discoverService.ts` while preserving all browse-only semantic-match, deduplication, cancellation, and retry invariants.
     - Update the explicit prompt-version assertions in `discoverPlanner.test.ts` and `e2e/desktop.spec.ts:707` per the Acceptance-change log below.
  3. **Native Discover I3 time range & sort (`native-ui`)**:
     - Wire `filterAndSortDiscoverItems` from `src/shared/discoverViewFilter.ts` into native `DiscoverScreen` (`src/main/appkit/discover.ts`, extracting toolbar helper into `src/main/appkit/discoverToolbar.ts` if needed to keep `discover.ts` well under 750 lines).
     - Expose native controls `discover-time-range` (`All dates`, `Last 7 days`, `Last 30 days`) and `discover-sort` (`Relevance`, `Newest`) in the Discover results toolbar.
     - Preserve `sourceOutcomes`, never trigger network/model calls on filter/sort changes, preserve `openLocal` checkpoint/restore, and provide clear empty-filter recovery (`Show all results` resetting kind + time range).
- Non-goals: No SQLite schema migration, no live LLM/arXiv calls in automated tests, no Web fallback UI redesign in this slice, no changes to `llm-wiki` promotion or Saved shelf.
- Interfaces and public API invariants: Frozen in `src/shared/discovery.ts`, `src/shared/discover.ts`, and `src/shared/discoverViewFilter.ts`.
- Data ownership and evidence semantics: Time filtering operates strictly on the persisted session snapshot; NCPSD month-only records use month-interval overlap (`publicationIntervalEnd`) for window inclusion and stored month-start anchor for sorting without claiming exact publication-day precision.
- Failure states: Empty filtered views never overwrite session `status` or `sourceOutcomes`; malformed `constraintGroups` fail closed at `parseDiscoverPlan`.
- Migration and rollback: Zero DB migration. Rollback by reverting the branch commits.
- Allowed scope:
  - Frozen shared contract (`technical-pm`): `src/shared/discovery.ts`, `src/shared/discover.ts`, `src/shared/discoverViewFilter.ts`, `src/shared/discoverViewFilter.test.ts`
  - Slice 2A (`core-retrieval-storage`): `src/core/ranking/rankDiscoveryItem.ts`, `src/core/ranking/rankDiscoveryItem.test.ts`, `src/core/storage/discoverSnapshotStore.ts`, `src/core/storage/researchRepository.test.ts`, `src/core/evaluation/discoveryQuality.test.ts`
  - Slice 2B (`ai-wiki-integration`): `src/core/discover/discoverPlan.ts`, `src/core/discover/discoverPlan.test.ts`, `src/core/discover/discoverPlanner.ts`, `src/core/discover/discoverPlanner.test.ts`, `src/core/discover/discoverService.ts`, `src/core/discover/discoverService.test.ts`, `e2e/desktop.spec.ts` (line 707 prompt-version string only)
  - Slice 2C (`native-ui`): `src/main/appkit/discover.ts`, optional `src/main/appkit/discoverToolbar.ts`, `src/main/appkit/discover.test.ts`, `src/main/appkit/discoverTimeSort.test.ts`

## Uncertainty Reducer

- Change class: Product & cross-cutting retrieval + native UI capability.
- Chosen artifact: Executable frozen shared contract (`discoverViewFilter.test.ts`) + deterministic multi-constraint ranking RED tests reproducing the 2026-09-07 single-facet distractor failure modes + native AppKit presenter tests.
- Question it must answer: Do whole-term matching + facet coverage deterministically promote multi-constraint hits over single-facet distractors, and do native I3 controls handle exact-day, repo-push, and NCPSD month-only dates cleanly?
- What it does not prove: Live LLM plan quality or human subjective relevance on new queries (verified separately in P0-1 opt-in live evaluation).

## Frozen Acceptance Contract

- RED verifier and expected failure:
  - Slice 2A: New RED tests fail before whole-term matching, coverage bonus/penalty, and `semantic-discover-v3` SQLite reload are implemented.
  - Slice 2B: New RED tests fail before `constraintGroups` schema parsing, `semantic-discover-v3` prompt generation, and `discoverService` propagation are implemented.
  - Slice 2C: New RED tests fail before native `discover-time-range` and `discover-sort` controls and empty-filter reset are implemented.
- Full verifier: `npm run check`, `npm run test:e2e`, `npm run smoke:appkit`, and cross-family independent review from `qa-security-reviewer`.
- Stop condition: All 3 slices integrated on the Wave 2 branch, full gates pass, and independent review returns `APPROVED`.

### Acceptance-change log

| Date       | Contract change                                                                                                                               | Evidence/reason                                                                                                                                                                            | Reviewer       |
| ---------- | --------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | -------------- |
| 2026-11-20 | Update `discoverPlanner.test.ts` and `e2e/desktop.spec.ts:707` expected prompt version from `semantic-discover-v2` to `semantic-discover-v3`. | Contract intentionally bumps `DISCOVER_PROMPT_VERSION` to `semantic-discover-v3` for multi-constraint `constraintGroups` planning; historical `v1`/`v2` records remain readable in SQLite. | `technical-pm` |
