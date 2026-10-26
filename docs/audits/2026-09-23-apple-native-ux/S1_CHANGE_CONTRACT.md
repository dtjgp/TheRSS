# Change Contract: S1 native window structure

Scope authority: on 2026-09-23 the user asked to commit S0 and start S1 of the
[audit roadmap](REPORT.md): typed toolbar and source-list sidebar; remove the title strip and
sidebar branding. Navigation, data and evidence contracts stay unchanged (decision gate D5 option
A: sidebar plus list-detail workspaces are kept).

## Feature Intake

- User outcome: the native window reads as a first-party macOS application: AppKit title bar and
  unified toolbar, a full-height source-list sidebar, and window-level commands in the toolbar.
- Observed problem: findings F1 and F2 (empty strip under the traffic lights, button-column
  sidebar with `AXButton` roles, no arrow-key navigation, branding, 84 pt text-only collapse,
  Find/Undo as a content row).
- Product fit: PRODUCT.md "macOS presentation"; project UI skill rows Familiarity, Spatial
  consistency, Visual hierarchy. No non-goal touched.
- Alternatives: keep the frameless window and position controls manually (keeps Electron's
  `WindowButtonsProxy` fighting any toolbar); adopt NSSplitViewController (replaces the tested
  TRSplit layout and persisted widths; larger change, deferred).
- Cost: new native chrome code, presentation schema additions, smoke migration.
- Boundary changes: native-route BrowserWindow uses a standard frame; a typed scene-level
  `toolbar`; a typed `sidebar` node kind. No SQLite, IPC channel, network or package change.
  The Web fallback (`THERSS_UI=web`) keeps its current window options.
- Kill criterion: if the spike shows Electron re-hides the title, replaces the toolbar, or moves
  the traffic lights after resize, full screen or window recreation, stop and report.
- Decision: technical spike, then implement.

## Capability Contract

- Goals:
  1. Native route: standard-frame window with full-size content view, visible AppKit title equal
     to the current workspace name, and a unified NSToolbar. No empty strip.
  2. Toolbar items from a validated scene `toolbar`: sidebar toggle (leading), then Back to
     search results (when available), Find local research and Undo triage. Items carry an
     SF Symbol, label, tooltip, enabled state and a presentation-bound action.
  3. Sidebar: `sidebar` node rendered as an NSTableView in source-list style with SF Symbol rows;
     selection equals the current workspace; arrow keys move and navigate; rows are accessibility
     rows. Brand heading and caption removed.
  4. Collapse hides the sidebar entirely (no 84 pt text rail); toggled by the toolbar item and
     Control-Command-S; the persisted `collapsed` preference is reused.
  5. Content and sidebar lists start below the toolbar (safe-area top inset); the sidebar glass
     reaches the window top.
  6. Transient notices move from the old top row to a fixed-height status row at the bottom of
     the content column (a status bar). It is always present, so the existing non-shifting
     feedback contract (`presenter.feedback.test.ts`) still holds.
- Non-goals: removing in-content page titles, toolbar search field, Settings window, subtitles,
  NSSplitViewController migration, Web fallback changes.
- Invariants: settings discard guard still applies to sidebar navigation; modal sheets unchanged;
  window bounds, sidebar width and zoom persistence unchanged; secure-field and IME behavior
  unchanged.
- Failure states: when a navigation is refused (settings kept), the sidebar selection returns to
  the current workspace on the next render.
- Migration and rollback: no data migration; revert the S1 commit.
- Allowed scope: `native/appkit/*`, `scripts/build-native-appkit.mjs` (source list only if a new
  file is added), `src/main/index.ts` (window options for the native route),
  `src/main/appkit/presentation.ts`, `src/main/appkit/presenter.ts`, their tests, the AppKit smoke
  scripts, and this audit directory.

## Uncertainty Reducer

- Change class: redesigned UI structure plus a native architecture boundary.
- Artifact: technical spike in the native host (framed Electron 44 window + NSToolbar +
  full-size content), inspected by native `inspect` and a window screenshot.
- Question: do the title, toolbar and traffic lights stay AppKit-managed across resize, full
  screen and window recreation with Electron 44?
- Evidence gathered before the spike: Electron 44 `native_window_mac.mm` makes `hiddenInset`
  windows frameless (`has_frame_` false) and repositions traffic lights through
  `WindowButtonsProxy`; framed windows skip that path.
- Does not prove: VoiceOver speech quality, every appearance combination.
- Spike results (2026-09-23, fixture window, `test-results/s1-spike`, git-ignored):
  1. `NSTrackingSeparatorToolbarItem` crashes with the TRSplit delegate
     (`-[TRNode _trailingItemAtDividerIndex:]` unrecognized selector): it requires an
     NSSplitViewController. Dropped; the sidebar toggle uses `navigational` placement instead.
     Residual: the title sits over the sidebar column rather than at the content pane.
  2. Electron's window bridge restored an 816 pt content view inside the 848 pt full-size
     window after `show` (first layout used a 20 pt title bar). The host now re-fits the content
     view to the frame view on every frame change while the chrome is installed.
  3. With both fixes: unified toolbar, visible workspace title, traffic lights centred in the
     52 pt toolbar, consistent 52 pt safe area across initial show, navigation, resize, sidebar
     collapse/expand and full screen enter/exit. No Electron repositioning observed.
     Kill criterion not met; proceed.
  4. Dark smoke screenshots showed a dim sidebar-toggle glyph. A controlled A/B (dark, window
     verified focused, 1.2 s settle) measured full glyph luminance (255 on a 62-84 background)
     both with the glass under the toolbar and with it inset below, and a dim glyph (119) only
     in an unfocused capture: standard inactive-window toolbar rendering. The glass layout is
     unchanged. The smoke's `capture()` does not assert key-window state, so its dark
     screenshots are not evidence of glyph contrast.

## Frozen Acceptance Contract

- RED (unit): presentation rejects an invalid `toolbar`/`sidebar` payload and binds their actions;
  presenter renders `native-navigation` with the current route selected, no brand nodes, toolbar
  title equal to the workspace, collapse removes the sidebar pane, sidebar selection navigates.
- RED (native smoke): `inspect` reports `toolbar.style == unified`, visible title, items
  `sidebar-toggle`, `open-local-search`, `undo-triage`; `native-navigation` is a source-list
  table whose row count is 5; the main column top lies below the toolbar.
- Full verifier: `npm run check`, `npm run smoke:appkit` (aged Sources step handled as in S0 until
  its separate fix lands), rendered screenshot of the fixture window.
- Stop condition: goals 1-6 verified, gates pass, diff inside allowed scope.

### Acceptance-change log

| Date       | Contract change                                                                                                                               | Evidence/reason                  | Reviewer |
| ---------- | --------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------- | -------- |
| 2026-09-23 | Smoke navigation uses sidebar selection instead of `navigate-*` button clicks; toolbar items are found through `state.toolbar`                | Goals 2-3 replace those controls | user S1  |
| 2026-09-23 | Presenter tests assert `native-navigation` selection and toolbar items instead of `navigate-*` buttons, brand label and 84 pt collapsed width | Goals 3-4 replace those nodes    | user S1  |
| 2026-09-23 | Feedback tests locate `native-notice` in `native-status` instead of `native-toolbar`; `undo-triage` and `return-local-search` in `toolbar`    | Goals 2 and 6 move those nodes   | user S1  |

## Independent Review

- Product/contract fit: goals 1-6 met; navigation targets, settings discard guard, modal sheets,
  persisted widths and zoom unchanged. Web fallback window options untouched.
- Accidental scope: none; the spike scripts were disposable and deleted. A glass-inset variant
  tried during review was reverted after the controlled A/B (spike result 4).
- Test weakening: none. Replaced assertions are logged above; new assertions cover the toolbar
  style, title, items, safe area, source list, collapse and branding removal.
- Boundaries: toolbar items and sidebar rows pass zod validation (bounded ids, symbol allowlist,
  8 items, unique ids); toolbar actions are inert while a sheet is visible. No IPC channel,
  SQLite, network or package change.
- Residual limits: no NSTrackingSeparatorToolbarItem (title sits over the sidebar column);
  content view re-fit depends on Electron 44 behaviour observed in the spike and should be
  rechecked on Electron upgrades.

## Evidence Closeout

- Changed files: `native/appkit/{chrome.mm (new),bridge.mm,host.mm,node.mm,ui.h}`,
  `scripts/build-native-appkit.mjs`, `scripts/smoke-native-appkit.mjs`, `src/main/index.ts`,
  `src/main/appkit/{presentation,presenter}.ts` and five AppKit test files.
- Native smoke assertions were written after the spike-derived native implementation, so they
  have no recorded RED run; they pass against it.
- Focused RED/GREEN: 7 unit tests failed before implementation and pass after; see
  [verification-s1.json](verification-s1.json).
- `npm run check`: exit 0; 691 main and 106 AppKit tests; coverage above 80% on all axes.
- Native smoke: controls 9/9. Workflow (aged Sources step disabled in a disposable copy, as in
  S0): 13/13 in 4 of 5 runs; one screenshot-enabled run failed in step 2 with a trailing space
  in the query field (not reproduced in 2 immediate reruns). Open intermittent; suspected
  focus-steal keystroke interference, unproven.
- Rendered evidence: fixture window screenshots in light and dark, narrow window, collapse and
  full screen (git-ignored `test-results/s1-spike`, `test-results/2026-09-23-s1*`).
- Not run: package/install, VoiceOver, live providers/sources.
- Rollback: revert the S1 commit; no data migration.
- Git/install/push: uncommitted; installed app not updated.
