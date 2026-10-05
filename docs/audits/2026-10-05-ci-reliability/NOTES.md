# CI reliability fixes for PR #58 (2026-10-05)

Scope: CI failures reported by Auto-fix on PR #58 and the user's request "排查 smoke-appkit-controls
第 1009 行的间歇性失败". Evidence is in the CI run artifacts and local runs listed below.

## 1. Sidebar width measured at the node, not the divider (CI `desktop`, workflow smoke)

- Symptom (run 37313940373): "The input did not match /248,/" with `native-sidebar` frame
  `{{0, 0}, {240, 661}}` after the window was widened to 1360 pt.
- Evidence (downloaded artifact): the same run's `discover-light.json` reports
  `toolbar.sidebarDivider = 224` (the saved width) while the `native-sidebar` node is
  216 × 627 inside a 224 × 643 pane. On CI's macOS the system sidebar split item insets its
  content view by 8 pt; the product restored the width correctly.
- Fix: the smoke measures the sidebar at the divider (`sidebarFits`), allowing for the content
  minimum in narrow windows. No product change.

## 2. Intermittent `smoke-appkit-controls.mjs:1009` (reader not scrollable)

- Symptom: after switching a compact split to its reading pane, `scroll 400` left the origin at
  0,0. Before the fix it failed in roughly a third to a half of local runs (also on the pushed
  head without the date change).
- Evidence: in every failed run `retained-text` measured 8 pt (insets only) instead of about
  5590 pt, so the document was not taller than the 728 pt viewport and the scroll was clamped.
  An in-memory record of the last measurement in a failed run showed: requested width 1000,
  text view frame 500 × 5590, text container 500, 8001 glyphs, laid-out height 0.
- Cause: `heightForWidth` set the container to the requested width while
  `widthTracksTextView` was on; AppKit reset the container to the stale view width and
  invalidated the layout just made, so the measurement read an empty layout. Whether the view
  frame was already current depended on layout order, hence the intermittency.
- Fix: reading text views do not track the view width; the measurement owns the container width.
- Correction: commit `3261956` first attributed the failure to TextKit 2 and switched reading
  text views to TextKit 1. That change stays (it avoids a TextKit 2 → 1 switch on first
  measurement) but it was not the cause: the failure recurred with the same 8 pt signature.
- Verification: 0 failures in 15 consecutive controls runs after the fix; a file-based trace
  hid the failure (timing), the in-memory record above caught it.

## 3. Arrow keys from a focused descendant resized an outer split (product defect)

- Found while emulating a small CI window: arrow and Escape keys aimed at a compact inner split
  bubbled up the responder chain to the window split's `TRSplit`, which moved the sidebar and
  saved 264, then 184, as width preferences. The same happens for any focused control that
  ignores arrow keys (e.g. a button with Full Keyboard Access).
- Fix: `TRSplit` handles divider keys only while it is the first responder.
- Regression: new controls group "Arrow keys reach a split divider only when the divider itself
  has focus"; RED without the fix ("Keys on a focused button do not move the divider").

## 4. Sidebar show animation sampled too slowly (CI `desktop`)

- Symptom (run 37316499167): "Showing the sidebar passes through intermediate widths". The test
  sampled widths from outside the app; on CI the slide finished between two samples.
- Fix: the native split records the distinct sidebar widths drawn during each animation and
  reports how many lie strictly between the start and end widths (`animationSteps`); the smoke
  requires at least one (an instant change draws none). The first threshold, two, failed on CI
  run 37318584177, whose artifact shows `animationSteps = 1`: the runner drew one frame. A collapsed pane is hidden but keeps its frame width, so the start
  width of a show is 0 (first version of the counter missed this; a diagnostic run showed the
  real frames 0 → 25 → 70 → 116 → 173 → 207 → 222 → 224).
- RED: with animations forced off the check fails ("Hiding the sidebar draws intermediate
  widths"). GREEN: 15/15 workflow runs, including runs with the fixture app inactive as on CI.

## Verification of the combined head

`npm run check` exit 0 (743 main, 141 AppKit tests); workflow smoke 15/15 in CI mode
(`THERSS_NATIVE_DEFAULT_ONLY=1`); controls smoke 18/18 (15 consecutive runs); E2E 8/8.
