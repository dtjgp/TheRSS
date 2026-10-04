# Change Contract: source picker popover

Scope authority: on 2026-10-04 the user asked to continue the UI/UX optimisation from the
previous analysis session. This slice is the second half of audit finding F11 in the
[UX audit](../2026-09-23-apple-native-ux/REPORT.md) (roadmap S3, `popover`).

## Feature Intake

- User outcome: choosing Discover sources does not push the results down the window. "Sources
  (n/22)" opens a popover anchored to the button, as in Safari or Mail; clicking elsewhere in the
  window or pressing Escape closes it; the button count updates while choosing.
- Current behaviour (code, 2026-10-04): the button toggles `picker`; the 22-source controls
  (`discover-source-controls`: find field, Select all, Clear selection, five groups of checks)
  render inline in `discover-page` between the composer and the results.
- Product fit: PRODUCT.md source selection semantics are unchanged (selection, group actions,
  find, no source while a run is active). UI skill rows Familiarity and Spatial consistency.
  Profile 3/2/7 unchanged; no dependency, font, icon or motion beyond the system popover.
- Alternatives: keep inline (status quo); a sheet (rejected: blocks the window and hides the
  question); a pull-down menu with check items (rejected: no find field or group actions).
- Boundary changes: optional scene `popover` (`anchor` node id, `close` action, content node
  tree) validated at the presentation boundary; native semi-transient `NSPopover`. No IPC, SQLite,
  network or package change.
- Kill criterion: stop if the popover cannot keep keyboard focus in its find field and checks,
  or closes on its own while the user toggles a source.

## Capability Contract

- P1: `NativePopover { anchor, close, root }`: `anchor` must name a node in the scene root;
  node ids must stay unique across root, modal and popover; `close` is an action id.
- P2: native: a semi-transient `NSPopover` below the anchor control holds the content tree; a
  scene without `popover` closes it without emitting; a user dismissal (click in the window,
  Escape) emits `close`; switching to another app keeps it open; a click on the anchor that
  dismissed it does not reopen it; content controls work through the normal node paths; `find` and inspection include
  the popover tree.
- P3: Discover: the source button opens the popover; the inline picker is removed; `close`
  ends the picker; a modal sheet, navigation or an active run closes it.
- Non-goals: other popovers, Web fallback, picker content or wording changes.
- Allowed scope: `src/main/appkit/{presentation,common,presenter,discover}.ts` and tests,
  `native/appkit/{host,node,bridge,popover(new)}.mm`, `native/appkit/ui.h`,
  `scripts/build-native-appkit.mjs`, AppKit smoke scripts, this directory, the UX audit report.

## Frozen Acceptance Contract

- RED (unit): presentation accepts a popover anchored to a root node and rejects a missing
  anchor or duplicate ids; Discover renders the picker as a popover anchored to
  `discover-source-picker` and not in the root, and `close` hides it.
- RED (native): controls smoke group: popover shown below the anchor, content inspectable and
  interactive, programmatic removal emits nothing, fixture dismissal emits `close`.
- Full verifier: `npm run check`; controls smoke; workflow smoke 14/14 with and without
  screenshots, with the source step reading the picker from the popover tree.
- Stop condition: P1-P3 verified; every changed assertion logged below.

### Acceptance-change log

| Date       | Contract change                                                                                                                                                                                                                                                                                                | Evidence/reason                                                                                                                                                                                             | Reviewer |
| ---------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------- |
| 2026-10-04 | P2 popover behaviour `transient` -> `semi-transient` (closes on clicks in the window and Escape, not on an app switch)                                                                                                                                                                                         | Screenshot workflow run: the transient popover closed between two captures when the inactive fixture app lost activation, which a real app switch also does; an in-progress source choice should survive it | user F11 |
| 2026-10-04 | Unit harness `render()` appends the screen's popover tree to the returned root (test view) and adds `popover()`; picker tests in `discover.polish`, `discover.recovery` and `workflows` keep their assertions                                                                                                  | P3 moves the picker out of the root; lookups/actions still need to reach it; separation is asserted by the new Discover test                                                                                | user F11 |
| 2026-10-04 | Workflow smoke source step reads checks from `state.popover.root`, asserts anchor/below/focus and that the root has no picker; it closes the picker with a fixture dismissal instead of a second button click; `wait` and capture input checks also search the popover tree; captures add `<name>-popover.png` | Same 22-source and group-toggle intent; the picker lives in a popover window                                                                                                                                | user F11 |

## Verification (2026-10-04)

- Unit RED: the scene had no `popover` and Discover returned none; GREEN after the change. The
  run-start close and navigation close were each confirmed discriminating by removing the line
  (the test failed) and restoring it.
- Controls smoke group (popover below the anchor, semi-transient, focus makes it key, typing and
  checks inside it, scene updates, silent programmatic close, fixture dismissal emits `close`,
  the dismissing anchor click is ignored, Escape dismisses): GREEN 14/14 groups in three runs.
  Not executed RED: the pre-change native build has no `popover` inspection field, so the first
  assertion fails by construction.
- Workflow smoke without screenshots: 14/14 in three runs.
- Workflow smoke with screenshots: all 14 behaviour groups passed in every run. The first run with
  the transient popover failed when the popover closed between two captures (the reason for the
  semi-transient change in the log). Later runs passed behaviour but some `screencapture -l`
  calls failed with "could not create image from window": in those runs the fixture window was
  not on the active Space (`onActiveSpace: false`), and only windows with an attached child
  window (sheets, the popover) failed; main-window captures succeeded. One run on the active
  Space captured both popover images.
- Rendered evidence: `source-picker-checked(-popover).png` shows the popover under "Sources
  (22/22)" with the finder, Select all, Clear selection and groups; the results area is not
  pushed down. The list height in the popover is 380 pt (was 224 pt inline).
- `npm run check`: exit 0; 710 main and 119 AppKit tests; coverage at or above 80% on all axes.
- Independent diff review (fresh-context reviewer): no blocker; three low findings and two test
  gaps, all addressed:
  1. Compact reading hid the anchor but kept `picker` true, so the popover could reopen without a
     click: Discover now ends the choice when the composer is hidden (new RED/GREEN unit test).
  2. The 0.4 s anchor suppression also followed Escape and outside clicks: suppression now
     applies only to the mouse-up whose event number matches a dismissing mouse-down on the
     anchor (controls smoke: only the dismissing click is ignored; a quick click after Escape
     reopens).
  3. Content taller than the window cap could clip: popover content now scrolls inside the cap
     (controls smoke with 40 checks: scrolls, stays within the cap, last check works).
  4. Root actions staying live while a popover is open is now asserted in the unit test. The real
     mouse-down/mouse-up order remains untested by fixtures (residual risk).
- After the review fixes: controls smoke 14/14; workflow smoke without screenshots 14/14; with
  screenshots all 14 behaviour groups passed and the same off-Space capture failures recurred
  (`onActiveSpace: false`); `npm run check` exit 0 (711 main, 120 AppKit tests).
- Not run: package/install smoke, VoiceOver speech.
