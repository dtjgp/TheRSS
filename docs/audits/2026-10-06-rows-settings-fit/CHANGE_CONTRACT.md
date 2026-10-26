# Change Contract: row text grouping, Settings window fit, fixture key diagnostic

Scope authority: on 2026-10-06 the user asked "先修 A1 和 A2，R1 选方案 1", after the
[appearance acceptance](../2026-10-06-appearance-acceptance/REPORT.md).

## Feature Intake

- User outcome:
  - A1: in every research and source list, a row's subtitle reads as part of its own title, not
    the next row's.
  - A2: each Settings pane shows all of its content when it opens (Model Provider includes
    "Local agents"), as first-party Settings windows do.
  - R1: when a synthetic key press cannot reach a button, the native smoke states the reason
    instead of timing out later on a missing state.
- Current behaviour (rendered, 2026-10-06, head `f4e413a`):
  - A1: `TRResearchCell` places a 35 pt title frame at y = 27 pt and the subtitle at y = 7 pt in
    a 70 pt row. A one-line title (16 pt) leaves about 19 pt above its subtitle, and the gap to
    the next row is smaller.
  - A2: the Settings window opens at 640 × 660 pt for both panes. Model Provider needs 660 pt of
    content in a 500 pt viewport, so the panel is cut and "Local agents" is hidden.
  - R1: the fixture sends a Space keyDown to a focused `NSButton`. While the window is not key,
    AppKit drops it and the step fails 20 s later on a missing status.
- Product fit: UI skill rows Visual hierarchy and Familiarity; accepted profile `3 / 2 / 7`
  (density unchanged: row height stays 70 pt); Settings window decision D5.
- Alternatives:
  - A1: variable row heights (rejected: uneven list rhythm; Mail uses uniform rows); a shorter
    fixed row (rejected: two-line titles need 70 pt; a density change needs its own decision).
  - A2: fixed per-pane window heights in TypeScript (rejected: wrong under zoom, errors and
    status messages); grow only (rejected: Personal Context keeps an empty tail).
  - R1: options 2 and 3 of the acceptance report (not selected by the user).
- Boundary changes: one optional presentation field `fitWindow` (scroll nodes only, zod
  validated); native layout of research cells; native window resize for a preference toolbar;
  fixture-only diagnostic. No IPC, SQLite, network, package or dependency change.
- Kill criterion: stop if the fit moves the window off its screen, fights a user resize within a
  pane, or changes any list row height.

## Capability Contract

- L1: in a research row, the subtitle sits 4 pt below the title's measured lines (one or two),
  and the title-subtitle block is centred vertically in the 70 pt row. Kind and Saved glyphs stay
  on the first title line. A row without a subtitle centres the title alone.
- L2: the title frame keeps two lines with tail truncation (F7), the glyph clearances (row
  glyphs contract) and the spoken label.
- W1: a scroll node may carry `fitWindow: true`. When the window's preference-toolbar selection
  changes (and on the first presentation), the window height changes by the difference between
  that scroll's content height and its viewport. The top edge stays fixed; the height stays
  between the window minimum and the screen's visible height. It animates only when the window
  is visible and transitions are allowed (Reduce Motion: at once).
- W2: until the user resizes the window, a content or status-line change within a pane also
  fits exactly. After a user resize (a width change, or a height that differs from the last fit),
  a width change only updates the record and a content change may grow the window so nothing is
  cut off, never shrink it. No fit runs during a live resize or the fit animation; the animation
  does not block the caller. Layout and fit measure the scroll content with one method
  (children stacked, each clamped to its `maxWidth`).
- K1: the fixture `key` action on an `NSButton` in a window that is not key fails with a reason
  that names the key-window and app-active state. Other controls are unchanged.
- Non-goals: Sources row density, other list layouts, Settings width, main and record windows,
  Web fallback, the R2 capture failures.
- Allowed scope: `native/appkit/{node,host,bridge,chrome}.mm`, `native/appkit/ui.h`,
  `src/main/appkit/{presentation,settings}.ts` and their tests,
  `scripts/smoke-appkit-controls.mjs`, `scripts/smoke-native-appkit.mjs`, this directory, the
  acceptance report.

## Frozen Acceptance Contract

- RED A1 (controls smoke, `glyph-list`): for each row, the gap between title and subtitle frames
  is at most 6 pt; the space above the title block and below the subtitle differ by at most 2 pt;
  the kind glyph's top is within 4 pt of the title's top.
- RED A2 (unit): `fitWindow` is accepted on a scroll node and rejected elsewhere; the Settings
  scroll carries it. (Workflow smoke): after selecting Model Provider, `settings-scroll` content
  fits its viewport (difference at most 1 pt) and `agent-status-claude` lies inside the viewport;
  after returning to Personal Context, the content fits again; the window's top edge is
  unchanged by both switches.
- RED K1 (controls smoke): with the fixture window hidden (never key), a Space `key` action on an
  enabled button rejects with "not the key window"; the button's action does not run.
- Full verifier: `npm run check`; controls smoke; workflow smoke with screenshots; the
  appearance matrix re-run for Sources, Discover and both Settings panes.
- Stop condition: L1, L2, W1, W2 and K1 verified; no existing assertion weakened.

### Acceptance-change log

| Date       | Contract change                                                                                                                                                                                                                                                                                                          | Evidence/reason                                                                                               | Reviewer                   |
| ---------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------- | -------------------------- |
| 2026-10-06 | W2: refit also when the content or surrounding height changes within a pane                                                                                                                                                                                                                                              | GREEN run: a save status line appeared after the first fit and Personal Context overflowed (404 pt in 374 pt) | implementer, before review |
| 2026-10-06 | W2 rewritten as above; RED A2 checks the form frame (not the document, which is never shorter than the viewport) and that `agent-status-claude` belongs to the fitted pane; new user-resize checks; A1 adds a no-subtitle row, a fixed 70 pt row height and two-line/one-line bounds independent of the cell measurement | Independent review findings 1-5                                                                               | independent reviewer       |

## Verification (2026-10-06)

- RED/GREEN:
  - Unit: `fitWindow` on a scroll node and on `settings-scroll` failed (`Unrecognized key`,
    `undefined`); both pass after the change.
  - A1 (controls smoke): "The title frame hugs its measured lines" failed on the one-line row
    (35 pt frame, 16 pt of text); passes after the change.
  - A1 regression found during GREEN: measuring with `intrinsicContentSize` used the earlier,
    wider wrap width, so "BAAI structured pruning research fixture" was cut to one line. The
    inspection then used `boundingRect`, which ignores the cell insets and reported one line.
    Both now measure with `cellSizeForBounds:` at the final width. The workflow-smoke check "A
    Discover row title keeps its lines" failed (32 pt needed, 16 pt frame) and passes after the
    fix.
  - A2 (workflow smoke): with `fitWindow` removed, "The Model Provider pane fits its window"
    failed (660 pt of content in 470 pt); passes after the change.
  - K1 (controls smoke): "Missing expected rejection" before the change; passes after it. A
    first version applied to every key on a button; it failed an existing arrow-key step in an
    inactive window, where AppKit still delivers arrows. The check is now limited to Space.
- Rendered (capture matrix, light/dark, wide/minimum): Sources, Discover, Saved and local
  search rows show the subtitle under its own title; Model Provider opens with "Local agents"
  visible (window 788 pt, content 660 pt in a 660 pt viewport); Personal Context shrinks to its
  content (window 532 pt); the top edge stays at the same y.
- Workflow smoke 16/16 without screenshots (twice); with screenshots 16/16 behaviour groups, but
  the run fails its screenshot requirement on `search-details` and `promotion-preview`. At those
  captures the window reported `onActiveSpace=false` and the app inactive (R2, pre-existing).
- Controls smoke 20/20 (four runs after the final change set). One earlier run failed once on
  `keyboard-search` reporting an empty key equivalent; it did not recur and the changed code does
  not set key equivalents. Recorded, not attributed.
- `npm run check` exit 0 (758 main, 154 AppKit tests; coverage at least 80% on all axes).
- Independent review (fresh-context reviewer, static), with fixes:
  1. High: a width resize re-ran the fit and replaced the user's height; a live drag could
     jitter. Fixed: no fit during live resize; a width change in a pane only updates the record.
  2. Medium: a status line appearing or disappearing resized the window and discarded a user
     resize. Fixed: exact fit only until the user resizes; afterwards grow only. RED with the
     earlier logic: "A status change keeps a user resize" failed (532 pt, expected 642 pt).
  3. Low-Medium: the fit measured differently from the scroll layout (`maxWidth`, first child
     only). Fixed: one shared measurement.
  4. Medium: the smoke compared the document (never shorter than the viewport), so an empty tail
     passed; the `agent-status-claude` check was missing. Fixed (see the acceptance log).
  5. Low: some row checks compared the layout with itself. Added independent bounds, the fixed
     row height and a no-subtitle row.
  6. Very low: K1 message when a control has no window. Fixed. The animated fit now uses the
     window animator instead of a blocking `setFrame:display:animate:`.
- After the review fixes: controls smoke 20/20; workflow smoke 16/16 without screenshots. One
  RED attempt stopped earlier on the known Discover query intermittent (query value replaced by
  the boundary text); the repeat reached and failed the intended check.
- Not run: VoiceOver speech, packaged smoke of this change, a real user resize between panes,
  a screen shorter than the Model Provider pane.
