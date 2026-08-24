# Task Plan: TheRSS Post-Audit Slice B

## Goal

Implement the next high-priority product-design slice: correct cross-view navigation scroll,
progressively render large Discover sessions with correct heading hierarchy, and keep Saved triage
actions visible while reducing summary dominance.

## Task Contract

- Objective: Implement R1, R2, R3, and R4 from the post-Slice-A audit.
- Evidence to read first: Current renderer sources/tests, current-run screenshots, and the existing
  Figma audit file.
- Allowed scope: Renderer components/styles, focused tests, Electron E2E, audit/Figma writeback.
- Verifier: RED/GREEN component contracts, `npm run check`, focused/full Electron E2E, fresh
  rendered screenshots, and inspected Figma output.
- Stop condition: Cross-view navigation opens at the top; initial Discover DOM is bounded and can
  reveal more results; Saved actions are visible initially and stay available while scrolling; card
  headings have the correct level.
- Persistent writeback: This plan, `implementation-notes.md`, `implementation-report.md`, and the
  existing Figma audit board.

## Phases

- [x] Phase 1: Confirm scope, evidence boundaries, and current worktree
- [x] Phase 2: Read focused source/tests and append the new audit findings to Figma
- [x] Phase 3: Add RED coverage for R1–R4
- [x] Phase 4: Implement the smallest coherent interaction and visual changes
- [x] Phase 5: Run focused and full verification
- [x] Phase 6: Inspect Electron at normal/minimum widths and update after-state evidence
- [x] Phase 7: Review the diff and deliver the aesthetic/UE analysis plus implementation report

## Decisions Made

- Implement R1 separately in code but ship it in the same verified slice as R2–R4.
- Use progressive disclosure for Discover before considering a heavier virtualization dependency.
- Preserve every persisted result; limit only initial rendering, not storage or filtering semantics.
- Keep the current Apple system typography, semantic palette, evidence boundaries, and local-first
  architecture.
- Do not implement Provider credential lifecycle or Settings restructuring in this slice because
  that requires a separate security-sensitive contract.
- Do not install, commit, push, publish, or run live providers/sources.
- Preserve the current refined native research-desk aesthetic. Do not apply the generic SaaS font
  or decorative-gradient suggestions from a broad UI heuristic.
- Use 24 results as the initial progressive-rendering batch; this bounds DOM/focus cost while
  keeping multiple paper/repository comparisons visible.
- Put Saved actions immediately below the title, make the row sticky within the detail pane, and
  collapse long summaries to six lines with an explicit expansion control.

## Errors Encountered

- RED verification passed as intended: 4 tests failed only at progressive rendering/heading,
  Saved action order/summary collapse, navigation scroll reset, and their CSS contracts.
- The first Saved RED test matched a long string with trailing whitespace and failed before reaching
  the intended contract. Replaced it with the semantic summary element; the corrected RED failure
  then proved the actions were after the summary.
- The first post-implementation style test assumed declaration order inside CSS rules. Rewrote it
  to inspect the rule body without order dependence; all 40 focused tests then passed.
- The first full gate rejected synchronous state resets inside React effects. Moved Discover resets
  into search/filter/session events and represented Saved expansion as an expanded item ID; lint,
  typecheck, and tests then passed without effect-driven cascading renders.
- A trial `display: contents` rule did not visually move an existing llm-wiki receipt below all
  action buttons in Chromium. Removed the ineffective rule and its temporary test rather than
  claiming a polish improvement that was not rendered.
- The final full gate first stopped on Prettier after the Saved selection-reset regression test was
  added. Formatted that test and reran the complete gate; all checks passed.

## Status

**Complete** - R1–R4 pass component/style/full/Electron verification, accepted after-state images
were inspected, and the existing Figma audit board contains before/after evidence.
