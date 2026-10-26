# Change Contract: animated sidebar show and hide

Scope authority: on 2026-10-05 the user asked "继续做侧栏展开收起的过渡动画" (the last P2 item in
the [UX audit](../2026-09-23-apple-native-ux/REPORT.md): "animated NSSplitViewController
transitions within MOTION_INTENSITY 2").

## Feature Intake

- User outcome: hiding or showing the sidebar slides it like Finder, Mail and Notes, so the
  user sees where it went; with Reduce Motion it changes at once.
- Current behaviour (code, 2026-10-05): the window split item's `collapsed` is set directly; the
  sidebar disappears and reappears in one frame.
- Product fit: UI skill row Motion and preferences ("add motion only to explain a demonstrated
  transition, with reduced-motion behavior"); accepted profile `MOTION_INTENSITY 2`; D6 allows
  built-in transitions only; no animation library, no custom physics.
- Alternatives: no animation (status quo); a custom frame animation (rejected: the split view
  controller animates its items natively).
- Boundary changes: native only (window split update, host motion check, fixture switches and
  inspection). No scene field, IPC, SQLite, network or package change.
- Kill criterion: stop if the animation can write a sidebar width preference, leave the sidebar
  at an intermediate width, or fight the width restoration.

## Capability Contract

- M1: the toolbar toggle collapses and expands the sidebar through the split item's animator
  (system timing) unless Reduce Motion is on; then it changes at once.
- M2: during the animation no width preference is written and the width reconcile waits; after
  expansion the sidebar returns to its saved width.
- M3: fixtures stay instant by default; a fixture switch enables animations and another
  simulates Reduce Motion, so both paths are testable; inspection reports `animating`.
- Non-goals: other transitions, Web fallback.
- Allowed scope: `native/appkit/{node,host,bridge,chrome}.mm`, `native/appkit/ui.h`,
  `scripts/smoke-native-appkit.mjs`, this directory, the UX audit report.

## Frozen Acceptance Contract

- RED (workflow smoke, native window): with animations enabled, hiding passes through an
  intermediate divider position (or reports `animating`) and ends at 0; showing passes through
  an intermediate position and ends at the saved width; the saved preference is unchanged; with
  Reduce Motion simulated, hiding is at 0 on the first read and never `animating`.
- Full verifier: `npm run check`; controls smoke; workflow smoke 15/15 with and without
  screenshots.
- Stop condition: M1-M3 verified; no existing assertion weakened.

### Acceptance-change log

| Date | Contract change | Evidence/reason | Reviewer |
| ---- | --------------- | --------------- | -------- |

No existing assertion changed; the new assertions extend the S1 sidebar-toggle step.

## Verification (2026-10-05)

- RED (workflow smoke, real window): with the fixture switches added but the old instant
  collapse, "Hiding the sidebar ... animated" failed. GREEN after the change.
- Recorded samples (`sidebar-motion.json`, saved width 224 pt): hiding 224 → 221 → 205 → 153 →
  95 → 41 → 10 → 0; showing 0 → 5 → 27 → 61 → 103 → 150 → 195 → 217 → 224 (system ease-in-out);
  the saved preference is unchanged afterwards; with Reduce Motion simulated the first read
  after the click is 0 and not animating.
- Workflow smoke 15/15 without screenshots (twice) and with screenshots (39 images); controls
  smoke 17/17; `npm run check` exit 0 (733 main, 136 AppKit tests).
- Independent diff review (fresh-context reviewer, static): no blocker.
  1. Medium: a toggle during a running animation let the first completion end the pause while
     the second animation ran, so the width reconcile could fight the slide. Fixed: a
     generation counter; only the latest completion ends the pause. A new smoke step reverses
     the toggle 60 ms into the hide and requires the sidebar to end shown at the saved width and
     stay settled. Not shown: that this step fails without the counter (timing race).
  2. Low: the preference check could pass even if widths were emitted. Fixed: the native split
     counts width events; the smoke requires no new event across all animations.
  3. Low: the Reduce Motion show was not asserted. Fixed: it must reach the saved width on the
     first read.
- After the review fixes: workflow smoke 15/15 without screenshots (twice) and with screenshots
  (39 images); controls smoke 17/17; `npm run check` exit 0 (733 main, 136 AppKit tests).
- Not run: the real system Reduce Motion setting (simulated by the fixture switch), VoiceOver.
