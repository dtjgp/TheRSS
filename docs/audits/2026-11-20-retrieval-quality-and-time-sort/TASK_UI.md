# Task Dispatch Spec (Wave 2 — Slice 2C): Native Discover I3 Time Range & Newest Sort Controls

- **Task Title**: Add local Time Range (`All dates` / `Last 7 days` / `Last 30 days`) and Sort (`Relevance` / `Newest`) controls to native AppKit Discover
- **Assigned Role**: `native-ui`
- **Change Contract**: `docs/audits/2026-11-20-retrieval-quality-and-time-sort/CHANGE_CONTRACT.md`

## Objective

Implement I3 (`PRIORITIES.md` P1-5) in the native macOS AppKit Discover workspace using the frozen pure helper `filterAndSortDiscoverItems` from `src/shared/discoverViewFilter.ts`, allowing users to locally filter persisted Discover results by date window and switch between Relevance and Newest sorting without rerunning models or adapters.

## Mandatory Pre-Read

- `AGENTS.md`, `skills/therss-ui-improvement/SKILL.md` (and references)
- `src/shared/discoverViewFilter.ts` and `src/shared/discoverViewFilter.test.ts`
- `src/main/appkit/discover.ts` and `src/main/appkit/discover.test.ts`

## Frozen Interfaces (Do Not Modify `src/shared/`)

- `DiscoverTimeRange = 'all' | '7d' | '30d'`
- `DiscoverSortOrder = 'relevance' | 'newest'`
- `filterAndSortDiscoverItems(items, { kind, timeRange, sortOrder, referenceTime })` in `src/shared/discoverViewFilter.ts`

## Allowed Edit Scope

- `src/main/appkit/discover.ts` (currently 672 lines — keep well below 800 lines; extract toolbar helper into `src/main/appkit/discoverToolbar.ts` if helpful)
- `src/main/appkit/discoverToolbar.ts` (optional new helper)
- `src/main/appkit/discover.test.ts`
- `src/main/appkit/discoverTimeSort.test.ts` (new focused test file)

## Explicitly Out of Scope (Do Not Touch)

- `src/shared/*` (frozen by Technical PM)
- `src/core/*` (owned by Slices 2A & 2B)
- `src/renderer/*` (Web fallback left unchanged in this slice per I4 precedent)
- `native/appkit/*.mm` (existing native segmented/popup controls already support these controls; do not touch Objective-C++ unless proven necessary)
- Do NOT run `git push`

## Acceptance Criteria & RED/GREEN Plan

1. **RED**: Add failing presenter tests in `src/main/appkit/discoverTimeSort.test.ts` covering:
   - Native Discover results toolbar renders `discover-time-range` (`All dates`, `Last 7 days`, `Last 30 days`) and `discover-sort` (`Relevance`, `Newest`) when a session snapshot is present.
   - Switching `discover-time-range` to `7d` or `30d` filters visible results locally via `filterAndSortDiscoverItems` (including NCPSD month-only interval overlap) with zero API/network calls, and updates selection cleanly if the selected item is filtered out.
   - Switching `discover-sort` to `newest` reorders visible results by newest effective date without losing `Relevance` order when switched back.
   - Empty-filter recovery: when `kind` + `timeRange` hides all items in a non-empty session, displays a clear empty state with `discover-show-all` (`Show all results`) that resets BOTH `filter` (`'all'`) and `timeRange` (`'all'`) while keeping `sourceOutcomes` intact.
   - `openLocal` checkpoints and restores `timeRange` and `sortOrder` (and resets them to `'all'` / `'relevance'` when opening a historical local record so the target item is guaranteed visible!).
2. **GREEN**: Implement cleanly in `src/main/appkit/discover.ts` (and optional `discoverToolbar.ts`), keeping every owned file <= 800 lines and >= 80% coverage.
3. **Verify**:
   - `npx vitest run src/main/appkit/discover.test.ts src/main/appkit/discoverTimeSort.test.ts`
   - `npm run test:appkit`
   - `npm run check`

## Required Delivery Report

Report via Orca `worker_done` with exact modified files, RED -> GREEN counts, `npm run test:appkit` and `npm run check` results, and any residual risks (explicitly noting that agent presenter tests do not replace human physical-keyboard/VoiceOver acceptance).
