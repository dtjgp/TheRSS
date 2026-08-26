# Notes: Discover list-detail workspace

## Current evidence

- The installed Discover surface can return 100 records but renders long-summary cards in a single
  stream; only 24 are revealed initially.
- Saved already provides a proven resizable list-detail hierarchy, roving selection, bounded long
  summaries, accessible action labels, and native context menus.
- `DiscoverView` owns filters, progressive reveal, Saved mutation, paper analysis, and Search
  details. Retrieval and persistence do not need to change.
- `DiscoverResultItem` already contains every field needed by a result row and detail pane: stable
  ID, source, kind, URL, title, summary, timestamp, score, match reasons, and Saved state.
- `DiscoverView.tsx` is 659 lines and `App.tsx` is 753 lines. New workspace behavior belongs in a
  focused component so the 800-line architecture gate keeps useful headroom.

## Reference evidence

### Internal reference: Saved research signals

- Task: scan a research list, select one item, inspect full evidence, then act.
- Reusable pattern: compact row plus persistent detail pane, explicit position, resizable divider,
  keyboard movement, actions next to the selected record.
- Intentionally rejected: Saved-only Dismiss and read-on-selection behavior.

### External-framework reference from the reviewed X article

- Task-first evidence is more important than copying a visual gallery.
- AI workspaces should expose system state and user control rather than rely on decorative motion.
- Design-system reuse must preserve accessibility, performance, and product consistency.

## Product boundary

- No new source, planner, agent, IPC, SQLite, credential, network, update, or export behavior.
- No live-source or live-provider verification in this slice.
- No result virtualization in this slice; the existing progressive 24-item batch remains bounded.

## Verification notes

- Accepted prototype screenshots:
  - `01-prototype-wide.png`: three compact rows, one persistent detail pane, result filters, actions,
    match reasons, evidence boundary, and collapsed Search details are visible without card
    repetition.
  - `02-prototype-820.png`: existing Saved-style narrow behavior stacks the bounded list above the
    detail pane; filters stay reachable and there is no horizontal overflow.
- Focused RED command: `npm test -- src/renderer/src/App.test.tsx`.
- RED result: 15 existing tests passed; two new/updated acceptance tests failed because the current
  DOM has no labelled `Discover result list`, selected-detail article, or Discover list divider.
- Focused GREEN: `App`, shell, resizer, promotion, and style tests passed 5 files / 63 tests.
- Full gate: `npm run check` passed 57 files / 382 tests with 90.42% statements, 80.80% branches,
  93.49% functions, and 93.29% lines; format, lint, typecheck, architecture, coverage, renderer/main/
  preload/MCP builds all passed.
- Electron E2E: 2/2 passed outside the restricted macOS sandbox. It verifies search, row selection,
  Arrow movement, independent pane scroll ownership, divider presence, paper-only actions,
  promotion preview/confirmation, analysis, filters, Saved toggle, Saved handoff, 820 px, dark,
  200% zoom overflow, and forced-colors keyboard focus.
- Accepted production screenshots:
  - `02-discover-results.png` — wide list-detail workspace with selected paper actions;
  - `02a-discover-results-820.png` — stacked list/detail and two-column filters;
  - `02b-discover-results-dark.png` — dark appearance;
  - `02d-discover-results-forced-colors.png` — system colors and real keyboard focus;
  - `03-discover-other.png` — deterministic filter fallback to a non-paper result;
  - `03b-discover-star-saved.png` — selected-result Saved state;
  - `04-saved.png` — existing Saved workflow regression.
- Recorded but not accepted as complete Shell zoom conformance:
  - `02c-discover-results-200-percent.png` — no document/main horizontal overflow and filters remain
    available through a one-column container query, but the pre-existing expanded sidebar causes the
    magnified main surface to show only a crop. Zoom-driven sidebar state remains a separate gate.
- Follow-up resolution: `../2026-08-26-zoom-sidebar-shape/` closes that gate with automatic effective
  compaction below 760 renderer pixels and a verified zoom-reset restoration path.
- `git diff --check` passed. Production/test changed files contain no console/debugger or credential
  literals. The standalone prototype uses `innerHTML` only with hard-coded local fixture records; no
  external or user content enters it.
- No dependency changed, so a fresh network dependency audit was not required for this slice.
- No live provider/source, real llm-wiki write, package install, commit, push, or publication ran.
