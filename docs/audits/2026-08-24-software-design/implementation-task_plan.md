# Task Plan: TheRSS Design Audit Slice A

## Goal

Implement and verify the audit's correctness-and-trust slice: minimum-width Discover layout,
truthful source-state language, readable dark placeholders, and explicit Analytics time scopes.

## Task Contract

- Objective: Complete D1, D2, D8, and D9 from the software-design audit.
- Evidence to read first: Current renderer sources/tests, product contract, and audit screenshots.
- Allowed scope: Renderer source, focused tests, Electron E2E coverage, and audit implementation
  documentation.
- Verifier: Focused RED/GREEN tests, `npm run check`, Electron viewport/appearance inspection,
  and fresh screenshots.
- Stop condition: All four behaviors pass automated checks and current-run visual inspection, or a
  concrete blocker is documented.
- Persistent writeback: This plan, `implementation-notes.md`, and `implementation-report.md`.

## Phases

- [x] Phase 1: Confirm scope, worktree, evidence boundaries, and implementation guidance
- [x] Phase 2: Read the focused source and test contracts
- [x] Phase 3: Add failing tests for D1, D2, D8, and D9
- [x] Phase 4: Implement the smallest coherent renderer changes
- [x] Phase 5: Run focused and full verification
- [x] Phase 6: Inspect the rendered Electron result and record fresh evidence
- [x] Phase 7: Review the diff and deliver the implementation report

## Key Questions

1. Can the 820 px layout preserve complete source-selection information without hiding controls?
2. Can source copy distinguish configured membership, prior verification, current retrieval state,
   and cache freshness without adding new network calls?
3. Can the placeholder meet normal-text contrast in both appearances without weakening the current
   Apple visual system?
4. Can Analytics state lifetime and seven-day scopes without changing its honest metric semantics?

## Decisions Made

- Implement Slice A before the larger Discover/Saved restructuring.
- Preserve the existing Apple system typography, semantic colors, local-first architecture, and
  source/analytics data contracts.
- Do not run live sources, model providers, llm-wiki writes, packaging, installation, commit, push,
  or publication in this slice.
- Treat the existing untracked audit directory as user-requested work and preserve all other files.
- Keep the established Apple system typography and semantic palette; the generic SaaS typography
  lookup is not applicable to this accepted macOS design system.
- Pass the existing dashboard source-health snapshot into Sources rather than inventing a second
  health store or triggering network requests.
- Treat `lastIndexedAt` as local item-index freshness, not proof of the latest request or current
  reachability.

## Errors Encountered

- RED verification passed as intended: 7 focused assertions failed across the four missing
  contracts; 13 neighboring assertions remained green.
- The first post-implementation focused run found one stale `App.test.tsx` heading assertion from
  the intentional source-copy change. Updated that integration expectation; all 47 focused tests
  then passed.
- The first full gate stopped at TypeScript because `exactOptionalPropertyTypes` rejects passing an
  explicit `undefined` to an optional prop. Made the source-health prop explicitly
  `DashboardSnapshot['sourceHealth'] | undefined`; typecheck and the full gate then passed.
- The first focused Electron launch aborted inside the restricted desktop sandbox with the known
  `SIGABRT` / `kill EPERM` boundary. The approved desktop-permission retry passed; the application
  was not the cause.

## Status

**Complete** - Slice A passes focused/full/Electron verification, all five accepted after-state
screenshots were inspected, and no unrelated, installed-app, or external state was changed.
