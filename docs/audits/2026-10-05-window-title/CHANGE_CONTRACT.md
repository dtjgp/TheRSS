# Change Contract: window title over the content column

Scope authority: on 2026-10-05 the user asked "继续做窗口标题位置" (the open S1 residual in the
[UX audit](../2026-09-23-apple-native-ux/REPORT.md): "the title sits over the sidebar column
because `NSTrackingSeparatorToolbarItem` needs an NSSplitViewController").

## Feature Intake

- User outcome: the window reads like Mail or Notes: traffic lights and the sidebar toggle over
  the sidebar, the workspace title starting over the content column, and the title moving with
  the sidebar divider.
- Current behaviour (screenshots, 2026-10-04): the toggle and title sit beside the traffic lights
  over the sidebar; at the minimum sidebar width the title crosses the sidebar boundary.
- Product fit: navigation, workspaces and data are unchanged; UI skill row Familiarity; profile
  3/2/7 unchanged; no dependency.
- Alternatives: keep the S1 layout; a custom title toolbar item sized to the sidebar (rejected:
  replaces the AppKit title and needs manual width tracking).
- Boundary changes: scene field `windowSidebar` on the presenter's workspace split; native: that
  split is hosted by an `NSSplitViewController` (sidebar split item + content split item) and the
  toolbar adds an `NSTrackingSeparatorToolbarItem` for its divider. Inner splits are unchanged.
  No IPC, SQLite, network or package change.
- Kill criterion: stop and revert if hosting the split in a controller crashes, loses the saved
  sidebar width, breaks collapse, divider keyboard/fixture resizing or window recreation, or
  AppKit does not place the title after the separator.

## Uncertainty Reducer (technical spike, 2026-10-05)

Question: can the existing node trees live in split view controller items, and does the tracking
separator then place the title over the content column, with Electron 44 owning the window?

- Result 1: no crash; separator installed; AppKit draws the title 54 pt right of the divider at
  sidebar widths 184, 224 and 248 pt (inspection `titleFrame` vs `sidebarDivider`).
- Defects found and fixed during the spike (each from the real workflow smoke):
  - `controller.view` is a container, not the split view: code that cast the node control to
    `NSSplitView` raised `-[NSView isVertical]`; a `splitView` accessor now serves resize,
    keyboard, focus, divider fixture and inspection paths.
  - the controller adds its own subviews: panes are read from `arrangedSubviews`.
  - moving the divider inside a layout pass raised an Auto Layout exception: the width is applied
    right after layout (coalesced), and collapse is applied in the scene update, not in layout.
  - the controller also resizes panes for window changes: only user resizes (divider drag,
    keyboard, divider fixture) now update the saved width; widening the window restores it.
  - the first layout runs before the split has a width: the controller's `viewDidLayout`
    reconciles the saved width after its own layout passes.
- Kill criterion not met.

## Capability Contract

- W1: `windowSidebar` is valid only on a split; the presenter's `native-workspace` sets it.
- W2: native hosting keeps the saved sidebar width, min/max limits, collapse/expand, divider
  keyboard and fixture resizing, focus, inspection and window recreation.
- W3: the toolbar shows the sidebar toggle in the sidebar section and a tracking separator; the
  AppKit title starts over the content column.
- Non-goals: inner list/detail splits, toolbar items, Settings window, Web fallback.
- Allowed scope: `native/appkit/{node,host,chrome,bridge}.mm`, `native/appkit/ui.h`,
  `src/main/appkit/{presentation,presenter}.ts` and tests, `scripts/smoke-native-appkit.mjs`, this
  directory, the UX audit report.

## Frozen Acceptance Contract

- RED (unit): `windowSidebar` accepted on a split, rejected elsewhere; the presenter workspace
  carries it.
- Native (workflow smoke): toolbar items include the separator; the title starts at or after the
  divider; hiding collapses the native sidebar (divider 0) and showing restores it; saved width
  after divider resize, narrow window and window recreation.
- Full verifier: `npm run check`; controls smoke; workflow smoke 14/14 with and without
  screenshots.
- Stop condition: W1-W3 verified; every changed assertion logged below.

### Acceptance-change log

| Date       | Contract change                                                                                                            | Evidence/reason                                                                                                            | Reviewer   |
| ---------- | -------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------- | ---------- |
| 2026-10-05 | Workflow smoke S1 toolbar item list includes `therss.sidebar-separator` after `sidebar-toggle`                             | W3 adds the tracking separator                                                                                             | user title |
| 2026-10-05 | Workflow smoke window-recreation step waits for the sidebar to reach 248 pt instead of reading it once when results appear | W2: the controller-hosted sidebar takes its saved width right after the first layout pass; the value asserted is unchanged | user title |

## Verification (2026-10-05)

- Unit RED/GREEN: both new tests failed with the implementation stashed and pass with it
  (128 AppKit tests).
- Workflow smoke (native window): title starts at or after the sidebar divider with a tracking
  separator; hiding collapses the native sidebar (divider 0), showing restores it; divider resize
  saves 248 pt; a narrow (820 px) zoomed window keeps the sidebar shown and the saved width
  unchanged; window recreation restores 248 pt. Without screenshots 14/14 (final build); with
  screenshots 14/14 and 38 images (final build).
- Rendered evidence: `discover-light.png`, `discover-dark.png` and the 820 px capture show the
  traffic lights and sidebar toggle over the sidebar and "Discover" starting over the content
  column (title 54 pt right of the divider at 184, 224 and 248 pt).
- Independent diff review (fresh-context reviewer, static): no blocker; fixed:
  1. Medium: thickness limits scaled by zoom while the saved range did not. Now unscaled points
     throughout (as the other splits).
  2. Medium: `canCollapse` let a drag or narrow window collapse the sidebar without the scene.
     Now `canCollapse = NO` (the toolbar toggle still collapses it), the content minimum counts
     the divider so both minimums fit 820 px, and the width reconcile tries once per split width
     and target. Smoke asserts after the narrow/zoomed steps.
  3. Low: a replaced split would leave a stale tracking separator; `apply` replaces it.
  4. Low: guarded `super` call; the accessibility label/help move to the real split view.
- `npm run check`: exit 0; 719 main and 128 AppKit tests; coverage at or above 80% on all axes.
- Controls smoke 16/16 in three of five runs. One run failed in the existing IME group and one
  screenshot workflow run failed with "ie" appended to the Discover question; both match real
  desktop keystrokes reaching the fixture window. One controls run ended in an Electron crash
  (`-[NSApplication reportException:]` from the run loop, no exception backtrace in the report)
  that did not reproduce in two reruns; the controls fixture does not use the window-split
  hosting, so the crash is recorded as unexplained, not attributed.
- Not run: package/install smoke, VoiceOver speech, full-screen enter/exit (covered only by the
  S1 spike).
