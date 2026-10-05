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
  0,0. Failure rate before the fix: 5 failed runs out of 12 on this Mac (also on the pushed
  head without the date change, 1 of 2).
- Evidence: in all five failed runs `retained-text` measured 8 pt (insets only) instead of
  about 5590 pt, so the document was not taller than the 728 pt viewport and the scroll was
  clamped to 0.
- Cause (inference): reading text views were created as TextKit 2 views and measured through
  `layoutManager`, which switches them to TextKit 1 on first access; that measurement could
  report an empty layout.
- Fix: reading text views are created with TextKit 1 (`textViewUsingTextLayoutManager:NO`).
- Verification: 0 failures in 10 consecutive controls runs, then 18/18 in later runs. Limit:
  the evidence is statistical; a deterministic check was tried (TextKit mode at inspection)
  and removed because it also passed without the fix.

## 3. Arrow keys from a focused descendant resized an outer split (product defect)

- Found while emulating a small CI window: arrow and Escape keys aimed at a compact inner split
  bubbled up the responder chain to the window split's `TRSplit`, which moved the sidebar and
  saved 264, then 184, as width preferences. The same happens for any focused control that
  ignores arrow keys (e.g. a button with Full Keyboard Access).
- Fix: `TRSplit` handles divider keys only while it is the first responder.
- Regression: new controls group "Arrow keys reach a split divider only when the divider itself
  has focus"; RED without the fix ("Keys on a focused button do not move the divider").

## Verification of the combined head

`npm run check` exit 0 (743 main, 141 AppKit tests); workflow smoke 15/15 in CI mode
(`THERSS_NATIVE_DEFAULT_ONLY=1`); controls smoke 18/18; E2E 8/8.
