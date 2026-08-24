# Task Plan: TheRSS Software Design Audit

## Goal

Produce an evidence-backed combined UX, visual-design, and accessibility audit of the current TheRSS desktop application without changing product behavior.

## Phases

- [x] Phase 1: Confirm audit scope, plugin boundaries, and saved design context
- [x] Phase 2: Read current product, design, engineering, and implementation sources
- [x] Phase 3: Run the app and capture the main user flow in ordered screenshots
- [x] Phase 4: Inspect responsive, keyboard, semantic, and visual-system behavior
- [x] Phase 5: Synthesize prioritized findings and implementation sequence
- [x] Phase 6: Verify the evidence bundle and deliver the report

## Key Questions

1. Can a researcher understand the daily workflow and next action without learning the internal architecture?
2. Are Today, Discover, Saved, Sources, Analytics, and Settings organized around user goals rather than system modules?
3. Which problems are structural, which are visual polish, and which are accessibility risks?
4. Which improvements provide the largest usability gain without violating the local-first product boundary?

## Decisions Made

- Audit mode: Combined UX and accessibility audit.
- Evidence: Screenshots captured in this run plus current repository implementation; memory is context only, not visual audit evidence.
- Change boundary: Report and audit artifacts only; no product-code changes.
- Open Design boundary: No Cloud, Local Codex, or secure BYOK generation because the request is analysis-only.

## Errors Encountered

- The first native screenshot caught the loading transition even though the accessibility tree had
  already stabilized. Rejected it and recaptured the stable Discover state.
- The first screenshot-copy retry reused an unavailable module binding. Re-imported the file and
  URL helpers explicitly before saving the accepted image.
- The in-app browser does not support the attempted raw-CDP new-document injection. Built an
  isolated temporary renderer copy with a deterministic local mock instead; no product source was
  changed.
- The first isolated mock used `window.api`, while the renderer consumes `window.therss`. Corrected
  the temporary mock and reloaded the local fixture.
- Browser-level Tab key injection did not advance focus reliably in this host surface. Keyboard
  conclusions are therefore limited to current semantics, source/tests, and visible focus states;
  a full native keyboard/VoiceOver pass remains an explicit verification gap.
- The first audit-only Prettier check found formatting drift in `audit-report.md`. Formatted that
  file and reran the three-file check successfully.

## Status

**Complete** - Eleven current-run screenshots were inspected, the report and notes are formatted,
and the final audit preserves all external-action and product-code boundaries.
