# Task Dispatch Spec (Wave 2 — Slice 2A): Multi-Constraint Ranking & v3 Provenance Storage

- **Task Title**: Implement whole-term matching, multi-constraint coverage scoring, and semantic-discover-v3 storage support
- **Assigned Role**: `core-retrieval-storage`
- **Change Contract**: `docs/audits/2026-11-20-retrieval-quality-and-time-sort/CHANGE_CONTRACT.md`

## Objective

Fix the deterministic ranking failure modes documented in `docs/audits/2026-09-07-source-quality/REPORT.md` so multi-constraint research matches consistently outrank single-concept distractors, and allow `discoverSnapshotStore` to round-trip `semantic-discover-v3` provenance plus optional `plan.constraintGroups`.

## Frozen Interfaces (Do Not Modify `src/shared/`)

- `MatchReasonKind` in `src/shared/discovery.ts` now includes `'coverage'`.
- `DiscoverPlan` in `src/shared/discover.ts` now includes optional `constraintGroups?: readonly (readonly string[])[]`.
- `DiscoverPlannerProvenance['promptVersion']` now includes `'semantic-discover-v3'`.

## Allowed Edit Scope

- `src/core/ranking/rankDiscoveryItem.ts`
- `src/core/ranking/rankDiscoveryItem.test.ts`
- `src/core/storage/discoverSnapshotStore.ts`
- `src/core/storage/researchRepository.test.ts`
- `src/core/evaluation/discoveryQuality.test.ts`

## Explicitly Out of Scope (Do Not Touch)

- `src/shared/*` (frozen by Technical PM)
- `src/core/discover/*` (owned by `ai-wiki-integration` in Slice 2B)
- `src/main/appkit/*` and `src/renderer/*` (owned by `native-ui` in Slice 2C)
- Do NOT run `git push` or modify `package.json`

## Acceptance Criteria & RED/GREEN Plan

1. **RED**: Add failing unit tests first for:
   - Whole-term matching preventing short Latin terms (e.g., `"ai"`, `"dr"`, `"ev"`) from matching inside unrelated words (`"detail"`, `"address"`, `"level"`), while preserving CJK substring matching (e.g., `"剪枝"` inside `"结构化通道剪枝"`).
   - Multi-constraint `constraintGroups` (optional 4th parameter `options?: { readonly constraintGroups?: readonly (readonly string[])[] }` on `rankDiscoveryItem`):
     - When `constraintGroups` has >= 2 facets:
       - Matching all N facets adds `+35` (`kind: 'coverage'`, label `"Covers all N intent constraints"`).
       - Matching >= 2 of N facets (when N >= 3) adds `+16` (`kind: 'coverage'`, label `"Covers M of N intent constraints"`).
       - Matching 1 of N adds `-20` (`kind: 'coverage'`, label `"Partial match: 1 of N intent constraints"`).
       - Matching 0 of N adds `-35` (`kind: 'coverage'`, label `"Partial match: 0 of N intent constraints"`).
       - Final score is clamped to `>= 0` (and stays `0` if `excluded`).
     - When `constraintGroups` is absent or has < 2 facets, existing ranking scores remain unchanged (except whole-term accuracy).
   - Regression test in `discoveryQuality.test.ts` (or `rankDiscoveryItem.test.ts`) proving a multi-constraint paper (`training` + `carbon` + `deadline`) outranks a broad single-facet paper (`carbon intensity` + 2 categories + recency).
   - `discoverSnapshotStore.ts` round-tripping `semantic-discover-v3` (requiring boolean `personalizationApplied`) while still reading `v1` and `v2` sessions and rejecting missing `personalizationApplied` on `v3`.
2. **GREEN**: Implement minimal, clean, well-typed code staying well under 800 lines per file and >=80% coverage across statements/branches/functions/lines.
3. **Verify**:
   - `npx vitest run src/core/ranking/rankDiscoveryItem.test.ts src/core/storage/researchRepository.test.ts src/core/evaluation/discoveryQuality.test.ts`
   - `npm run check`

## Required Delivery Report

Report via Orca `worker_done` with exact modified files, RED -> GREEN counts, `npm run check` result, and any residual risks.
