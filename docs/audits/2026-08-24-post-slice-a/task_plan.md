# Task Plan: TheRSS Post-Slice-A Product Audit

## Goal

Re-audit the current development build after Slice A and identify remaining or newly visible UX,
visual-design, accessibility, and software-design improvements without modifying product code.

## Phases

- [x] Phase 1: Confirm scope, capture surface, and evidence boundaries
- [x] Phase 2: Recheck current governance, implementation, and saved design context
- [x] Phase 3: Launch the current development build and capture the core flow
- [x] Phase 4: Inspect responsive, interaction, semantic, and design-system behavior
- [x] Phase 5: Separate resolved, remaining, and newly discovered findings
- [x] Phase 6: Verify the evidence bundle and deliver the report

## Key Questions

1. Did Slice A resolve its four findings without creating regressions?
2. Which remaining issues most obstruct daily research triage?
3. Are there new problems visible only after source status and Analytics became clearer?
4. Which next implementation slice has the best user value and safest scope?

## Decisions Made

- Audit the current source-built Electron app, not the older installed `TheRSS Dev.app`.
- Use only screenshots captured in this audit run as visual evidence.
- Do not modify product source, run live sources/models, install, commit, push, or publish.
- Do not update Figma unless the user explicitly asks for a new board or board revision.

## Errors Encountered

- Computer Use intermittently returned a Saved accessibility tree with a Discover screenshot and
  then reported no available window while scrolling. Rejected the mismatched captures and switched
  to the required in-app Browser with the current compiled renderer and an isolated deterministic
  fixture.
- The first Browser measurement used `instanceof HTMLElement`, which is unavailable in the
  restricted read-only evaluation scope. Removed that unnecessary type check and reran the
  measurement successfully.
- `09-navigation-scroll-state.png` was inspected but rejected as redundant; the Analytics and
  Sources screenshots directly demonstrate the cross-view scroll carry-over.

## Status

**Complete** - Current-run screenshots and DOM measurements distinguish resolved Slice A findings,
three high-priority remaining problems, and lower-priority follow-up work.
