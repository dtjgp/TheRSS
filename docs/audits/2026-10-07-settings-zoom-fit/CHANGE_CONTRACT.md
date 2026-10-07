# Change Contract: Settings window refits after a zoom change

Scope authority: on 2026-10-07 the user asked "修复 Settings 缩放后不重新适配窗口的问题", after the
finding in [CI reliability notes](../2026-10-05-ci-reliability/NOTES.md) ("Separate finding").

## Feature Intake

- User outcome: after View > Zoom In, Zoom Out or Actual Size in the Settings window, the window
  takes the height of the selected pane at the new size, as it does after a pane change.
- Current behaviour (head `74153f8`, local, overlay scroll bars): after five Zoom In commands on
  Model Provider (zoom 1.5) the window stayed 818 pt tall with 961 pt of content in a 628 pt
  viewport, on a 1194 pt work area.
- Cause: zoom scales the padding around the fitted scroll view, so its width changes. The fit
  (W2 of the [Settings fit contract](../2026-10-06-rows-settings-fit/CHANGE_CONTRACT.md)) reads a
  width change within a pane as a user resize and only records it. A second gap: a fit requested
  while the fit animation runs is dropped, so a fast second zoom keeps the first zoom's height.
- Product fit: Settings window decision D5; zoom is a user command that changes all content, like
  a pane change.
- Alternatives: refit only when the content grows (rejected: a Zoom Out leaves an empty tail);
  disable the fit animation (rejected: D5 and W1 allow it).
- Boundary changes: native `TRHost` fit logic only. No IPC, schema, SQLite, network or
  dependency change.
- Kill criterion: stop if the fit fights a user resize within one zoom level, or moves the window
  off its screen.

## Capability Contract

- Z1: a zoom change refits the window exactly, like a pane change (W1): it clears the user-resize
  record, keeps the top edge unless the window must move up to stay on the work area, and keeps
  the height between the window minimum and the screen's visible height.
- Z2: within one pane and one zoom level, W2 is unchanged (a user resize is kept).
- Z3: a fit requested while the fit animation runs is kept and runs when the animation ends, with
  the scene current at that time.
- Non-goals: main and record window zoom, Settings width, zoom persistence.
- Allowed scope: `native/appkit/{host.mm,ui.h}`, `scripts/smoke-native-appkit.mjs`, this file.

## Uncertainty Reducer

- Reproduced locally at zoom 1.5 (numbers above). The scroller-free width also changes with
  zoom, so the cause is the zoom-scaled padding, not the scroll bar.

## Frozen Acceptance Contract

- A1 (Z1): in the workflow smoke, after a user resize of the Personal Context pane, five Zoom In
  commands make the pane fit its window (content = viewport, or a scrolling pane in a window that
  fills the work area), with the top-edge rule of the Settings step.
- A2 (Z1): Actual Size fits the pane again at zoom 1.
- A3 (Z3): with fixture animations on, Zoom In twice in quick succession ends fitted at zoom 1.2.
- A4 (Z2): the existing user-resize checks in the Settings step still pass.
- Verifier: `npm run check`; `npm run build`; the workflow smoke with
  `THERSS_NATIVE_DEFAULT_ONLY=1 THERSS_NATIVE_SCREENSHOTS=0`, with and without
  `THERSS_NATIVE_LEGACY_SCROLLERS=1`; the controls smoke.
- Stop condition: A1–A4 pass, and A1 or A3 fail on the unfixed native code.

### Acceptance-change log

- 2026-10-07, after the independent review: A3 sends the second Zoom In 40 ms after the first, in
  a separate main-process task (the presenter merges redraws within one task), and asserts that a
  fit at the new zoom was deferred during the animation. `zoomFits` waits until the fit animation
  has ended and two bounds readings are equal. This strengthens A3; it does not weaken it.

## Implementation Slices

1. Smoke checks A1–A3 (RED on head `74153f8`).
2. `fitWindowToPane:` treats a zoom change like a pane change; a fit skipped during the animation
   runs on its completion.
3. Found while making A3 pass: the animated `setFrame` reports `inLiveResize`, so the old order
   dropped a fit during the animation before it could be deferred. The `fitAnimating` check now
   comes first. Fixture `inspect` reports `fitAnimating` and `deferredZoomFits`.

## Independent Review

- A fresh-context `code-reviewer` (static review) found no blocking defect: the pending fit is
  safe after dispose, there are no retain cycles or loops, and W1/W2 hold within one pane and zoom.
- Low findings and outcome:
  1. The deferred fit needs `inLiveResize` to be NO in the completion handler: verified by A3
     GREEN with overlay and legacy scroll bars.
  2. A3 did not prove the overlap: fixed (`deferredZoomFits` assertion; see the log above).
  3. A possible flake from asserting during the last animation frames: fixed (settle wait).
  4. Z2 is not rechecked after a zoom refit: accepted gap, same code path as zoom 1.

## Evidence Closeout

- RED (unfixed head `74153f8` native code): A1 failed, "622 pt of content in 494 pt".
- RED (deferral present, old check order): A3 failed, "479.6 pt of content in 438 pt" (the window
  kept the zoom 1.1 height).
- GREEN: the workflow smoke passed 16/16 with overlay scroll bars, including A1–A4 and the overlap
  assertion. With `THERSS_NATIVE_LEGACY_SCROLLERS=1` it also passed 16/16; the controls smoke
  passed 20/20 and `npm run check` passed.
- Local runs that failed while another app (WeChat) was in front stopped in main-window steps
  that this change does not touch (Discover query, marked-text IME); reruns passed.
