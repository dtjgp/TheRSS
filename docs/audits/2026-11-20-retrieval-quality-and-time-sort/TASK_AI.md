# Task Dispatch Spec (Wave 2 — Slice 2B): Multi-Constraint Planner (`semantic-discover-v3`) & Discover Wiring

- **Task Title**: Add optional `constraintGroups` to `discoverPlan`, bump planner prompt to `semantic-discover-v3`, and pass constraints to ranking
- **Assigned Role**: `ai-wiki-integration`
- **Change Contract**: `docs/audits/2026-11-20-retrieval-quality-and-time-sort/CHANGE_CONTRACT.md`

## Objective

Upgrade Discover semantic planning so multi-constraint research intents are decomposed into bounded `constraintGroups`, compound phrases, and adjacent-domain exclusions, and wire `plan.constraintGroups` from `discoverService.ts` into `rankDiscoveryItem`.

## Frozen Interfaces (Do Not Modify `src/shared/`)

- `DiscoverPlan` in `src/shared/discover.ts` now includes optional `constraintGroups?: readonly (readonly string[])[]`.
- `DiscoverPlannerProvenance['promptVersion']` now includes `'semantic-discover-v3'`.
- `rankDiscoveryItem(item, profile, now, options?)` will accept optional 4th parameter `options?: { readonly constraintGroups?: readonly (readonly string[])[] }` (implemented in parallel by `core-retrieval-storage` in Slice 2A; note that in your worktree `rankDiscoveryItem` currently takes 3 args until PM integrates 2A + 2B, OR you may keep `discoverService.ts` cleanly typed—wait: check `rankDiscoveryItem.ts` signature! To keep your worktree typecheck green right now, PM has NOT edited `rankDiscoveryItem.ts` yet, so see the note below!).

> **Parallel Typing Note**: Because Slice 2A (`rankDiscoveryItem.ts`) runs in parallel in `core-retrieval-storage`, do NOT edit `src/core/ranking/rankDiscoveryItem.ts`. In `discoverService.ts`, keep `rankDiscoveryItem` invoked cleanly via an injectable optional ranker or pass `(item, profile, now)` with a helper `rankItemWithPlan(item, profile, now, plan)` that forwards `plan.constraintGroups` once 2A merges—wait: actually, to make `discoverService.ts` 100% complete AND typecheck green right now without touching `rankDiscoveryItem.ts`, PM will add the optional 4th parameter type stub `options?: { readonly constraintGroups?: readonly (readonly string[])[] }` to `rankDiscoveryItem.ts` BEFORE dispatching! Verify `rankDiscoveryItem.ts` already accepts the optional 4th parameter before editing `discoverService.ts`.

## Allowed Edit Scope

- `src/core/discover/discoverPlan.ts`
- `src/core/discover/discoverPlan.test.ts`
- `src/core/discover/discoverPlanner.ts`
- `src/core/discover/discoverPlanner.test.ts`
- `src/core/discover/discoverService.ts`
- `src/core/discover/discoverService.test.ts`
- `e2e/desktop.spec.ts` (update line 707 expected prompt version `'semantic-discover-v2 · personal context applied'` → `'semantic-discover-v3 · personal context applied'` per approved Acceptance-change log ONLY)

## Explicitly Out of Scope (Do Not Touch)

- `src/shared/*` (frozen by Technical PM)
- `src/core/ranking/*` and `src/core/storage/*` (owned by `core-retrieval-storage` in Slice 2A)
- `src/main/appkit/*` and `src/renderer/*` (owned by `native-ui` in Slice 2C)
- Do NOT run `git push` or call live model APIs

## Acceptance Criteria & RED/GREEN Plan

1. **RED**: Add failing tests first for:
   - `parseDiscoverPlan`: accepts optional `constraintGroups` (1–4 groups, each 1–4 trimmed lowercase deduplicated bounded terms, no control chars); preserves backward compatibility when `constraintGroups` is omitted; rejects >4 groups, empty group, >4 terms per group, or control characters.
   - `DiscoverPlannerService` / `buildDiscoverPlannerPrompt`: uses `DISCOVER_PROMPT_VERSION = 'semantic-discover-v3'`, instructs the planner to decompose multi-constraint intents into `constraintGroups`, prefer compound phrases over overly broad single words, and add adjacent-domain `excludeKeywords` while preserving all untrusted-input / Personal Prompt safety boundaries.
   - `DiscoverService`: forwards `plan.constraintGroups` to `rankDiscoveryItem` without breaking browse-only `hasSemanticMatch`, deduplication, cancellation, or retry behavior.
2. **GREEN**: Implement clean, minimal changes staying <= 800 lines per file and >= 80% coverage.
3. **Verify**:
   - `npx vitest run src/core/discover/discoverPlan.test.ts src/core/discover/discoverPlanner.test.ts src/core/discover/discoverService.test.ts`
   - `npm run check`

## Required Delivery Report

Report via Orca `worker_done` with exact modified files, RED -> GREEN counts, `npm run check` result, and any residual risks.
