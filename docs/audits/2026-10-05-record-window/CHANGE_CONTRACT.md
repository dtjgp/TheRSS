# Change Contract: open a record in its own window

Scope authority: on 2026-10-05 the user asked "继续做独立窗口打开记录" (audit section P2 in the
[UX audit](../2026-09-23-apple-native-ux/REPORT.md): "opening a record in its own window").

## Feature Intake

- User outcome: read or compare papers side by side, as Mail opens a message in its own window:
  double-click a Discover or Saved row, or choose "Open in New Window" in its context menu.
- Current behaviour (code, 2026-10-05): one window per app; records open only in the reading pane.
- Product fit: reading and provenance are unchanged; the window shows the same reader, evidence
  note, match reasons and stored analysis.
- Decision inside scope (default, reversible): the record window is read-only (Open original,
  Share, source details, stored analysis). Each window's presenter keeps its own dashboard copy
  and there is no cross-window update; Save, Analyze, Dismiss and Promote in a second window
  would leave the main window stale. They stay in the main window; cross-window sync is a
  separate change.
- Alternatives: no record windows (status quo); full actions plus a cross-window broadcast
  (larger: every presenter would need refresh semantics).
- Boundary changes: native-only `NativeRecordPresenter`; `NativePresenterPort.openRecord`;
  table field `openWindow` (double-click action); context-menu action `open-window` behind
  target flag `canOpenWindow` (set only by the native route); main-process record windows
  (one per record, cascaded, `native-host.html`, sandboxed preload as the main window). No IPC
  channel, SQLite, network or package change.
- Kill criterion: stop if a record window can change data, outlive the app's shutdown drain, or
  leave the app without a main window after activation.

## Capability Contract

- R1: `ResearchReader` read-only mode omits Save, Analyze, Dismiss, analysis readiness and
  Promote; keeps Open original, Share, source details and stored analysis.
- R2: `NativeRecordPresenter` renders the read-only reader for one record; window title = record
  title (bounded); menu zoom works; app commands are ignored.
- R3: Discover and Saved rows open a record window on double-click and from the context menu
  ("Open in New Window", native only); opening the same record again focuses its window.
- R4: main process: record windows bind like the main window, close independently, are drained
  at quit; activation recreates the main window when only record windows remain.
- Non-goals: editing actions in record windows, window state restoration, Web fallback.
- Allowed scope: `src/main/appkit/{reading,recordPresenter(new),presenter,discover,saved,common,
presentation}.ts` and tests, `src/shared/contextMenu.ts`, `src/core/menus/contextMenu.ts` and
  test, `src/main/{index,nativeAppKitRuntime,windowApplicationRuntime,recordWindowRouting(new)}.ts` and
  tests,
  `native/appkit/{node,bridge}.mm`, AppKit smoke scripts, this directory, the UX audit report.

## Frozen Acceptance Contract

- RED (unit): read-only reader omits the listed controls; the record presenter renders the
  title, toolbar title and read-only actions; the context menu offers `open-window` only with
  `canOpenWindow`; Discover/Saved route double-click and the menu action to `openRecord`.
- Native/workflow smoke: double-clicking a Discover row opens a second native window whose
  title is the record title and whose reader has Open original and no Save; double-clicking
  again focuses it (still two windows); closing it leaves the main window working.
- Full verifier: `npm run check`; controls smoke; workflow smoke (now 15 groups) with and
  without screenshots.
- Stop condition: R1-R4 verified; no existing assertion weakened.

### Acceptance-change log

| Date       | Contract change                                                                                                              | Evidence/reason                          | Reviewer           |
| ---------- | ---------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------- | ------------------ |
| 2026-10-05 | Workflow smoke gains a 15th group (record window); the full verifier counts 15 groups                                        | R3/R4 need a real second native window   | user record window |
| 2026-10-05 | `contextMenuTargetSchema` (IPC boundary) gains optional `canOpenWindow`; `RENDERER_CONTEXT_MENU_ACTIONS` gains `open-window` | R3; the Web fallback never sets the flag | user record window |

## Verification (2026-10-05)

- Unit RED: no `NativeRecordPresenter`, no read-only reader, no `open-window` menu entry; GREEN
  after the change (`recordWindow.test.ts`, `contextMenu.test.ts`). The "current Saved state"
  test failed with the fix removed and passes with it (the window first showed the session
  snapshot's unsaved state; found in the rendered record window).
- Workflow smoke without screenshots 15/15 (twice): double-clicking a Discover row opens a second
  native window titled with the record, with Open original and without Save/Analyze;
  double-clicking again keeps two windows; closing it leaves the main window working. With
  screenshots 15/15 and 39 images including `record-window.png`.
- Rendered evidence: `record-window.png` shows the record title in the title bar, Open original
  and Share only, the summary, evidence note, match reasons and the stored analysis.
- Controls smoke 17/17 in two of three runs; one run failed in the existing compact-navigation
  group (reader scroll origin read as 0,0 right after a pane switch), not reproduced in two
  reruns; the group's split/scroll code is unchanged by this slice.
- `npm run check`: exit 0; 730 main and 136 AppKit tests; coverage at or above 80% on all axes.
- Independent diff review (fresh-context reviewer): no blocker; the read-only reader and
  action dispatch hold. Fixed:
  1. Medium (kill criterion): app commands from a focused record window went to the main
     window, so Save/Dismiss/Analyze/Undo Triage acted on the main window's selection. New
     `routeAppCommand`: view commands (workspaces, sidebar, Find, Settings, Help) go to the main
     window; item and triage commands are dropped (unit test).
  2. Medium: Discover record windows lost the source metadata (row selection passed none). The
     selection now passes it and `NativeRecord.extra` carries it (unit test).
  3. Medium: a failed open left a hidden window in the dedupe map; failures now remove and
     destroy it.
  4. Low: a double-click on empty table space opened the selected row; a real double-click now
     uses only the clicked row (the nil-sender fixture path keeps the selection).
     Not changed: the first click of a double-click activates the row, as every single click in
     these lists does. Lifecycle paths in `index.ts` other than command routing remain covered
     only by the workflow smoke.
- After the review fixes: `npm run check` exit 0 (733 main, 136 AppKit tests); controls smoke
  17/17; workflow smoke without screenshots 15/15.
- Not run: a real mouse double-click, package/install smoke, VoiceOver speech.
