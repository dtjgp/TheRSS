# Change Contract: segmented result-kind filter

Scope authority: on 2026-10-04 the user asked to continue the UI/UX optimisation from the
previous analysis session. This slice is the first half of audit finding F11 in the
[UX audit](../2026-09-23-apple-native-ux/REPORT.md) (roadmap S3, `segmented` node kind).
The source-picker popover (second half of F11) is a separate slice.

## Feature Intake

- User outcome: the Discover result-kind filter shows all four choices with their counts at
  once and changes with one click, like the scope bars in Finder and Mail.
- Current behaviour (code and workflow screenshot, 2026-10-04): `discover-kind` is a 210 pt
  `NSPopUpButton` ("All (3)") in the results toolbar row. The user must open a menu to see the
  other kinds and their counts.
- Product fit: PRODUCT.md Discover result filtering is unchanged; UI skill rows Familiarity and
  Simplicity. Profile 3/2/7 unchanged; no new dependency, font, icon or motion.
- Alternatives: keep the pop-up (status quo); a scope bar under the toolbar (rejected: AppKit has
  no scope-bar control, and the row already holds the filter and status).
- Boundary changes: one bounded `segmented` node kind in the typed presentation contract,
  rendered as `NSSegmentedControl` (select-one). No IPC, SQLite, network or package change.
- Kill criterion: stop if the segmented control cannot fit the results row at the minimum
  content width without clipping a count.

## Capability Contract

- G1: `segmented` node: `title` (accessibility label), `options` (2-6, each `id`, `title`,
  optional `enabled`), `selected` (must be one of the option ids), `action` with the existing
  `choice` rule over enabled option ids. `options` and `selected` stay valid only on `select`
  and `segmented` nodes as today; the segment limit applies to `segmented` only.
- G2: native rendering: `NSSegmentedControl`, `NSSegmentSwitchTrackingSelectOne`, one segment
  per option with its title, disabled options are disabled segments, the selected id is the
  selected segment, intrinsic width in rows, accessibility label from `title`. A click emits
  the option id; programmatic updates do not emit.
- G3: Discover `discover-kind` uses `segmented` with the same ids, titles and counts.
- Non-goals: Saved source filter (13+ options stays a pop-up), Analytics series pop-up, the
  source-picker popover, Web fallback.
- Allowed scope: `src/main/appkit/{presentation,common,discover}.ts` and tests,
  `native/appkit/{node,bridge}.mm`, `scripts/smoke-appkit-controls.mjs`,
  `scripts/smoke-native-appkit.mjs`, this directory, the UX audit report.

## Uncertainty Reducer

NSSegmentedControl is a standard AppKit control. The open question is only the row width at the
minimum content width; the controls smoke measures the frame and the workflow smoke checks the
rendered Discover row.

## Frozen Acceptance Contract

- RED (unit): `presentation.test.ts` accepts a valid segmented node and rejects 1 or 7 options,
  a `selected` id outside the options, and options on a label; `discover.test.ts` expects
  `discover-kind` of kind `segmented` with the four ids and count titles, and choosing
  `repository` filters the list.
- RED (native): controls smoke group: class `NSSegmentedControl`, segment labels, selected
  segment, a disabled segment, clicking a segment emits its id, a scene update does not emit,
  accessibility label.
- Full verifier: `npm run check`; controls smoke; workflow smoke 14/14 with screenshots and
  without, with the Discover step asserting the segmented filter.
- Stop condition: G1-G3 verified; no existing assertion weakened.

### Acceptance-change log

| Date | Contract change | Evidence/reason | Reviewer |
| ---- | --------------- | --------------- | -------- |

No existing assertion changed. New assertions only: two unit tests, one controls-smoke group and
segmented checks in the workflow-smoke Discover step.

## Verification (2026-10-04)

- Unit RED: the schema rejected kind `segmented`; `discover-kind` had kind `select`. GREEN after
  the change.
- Controls smoke RED on the pre-change native build: `discover-kind` rendered as a plain `TRNode`
  instead of `NSSegmentedControl` (the first RED attempt stopped earlier, at the existing IME
  refresh group, and did not recur). GREEN 13/13 groups.
- Workflow smoke: with screenshots 14/14 in 2 of 3 runs; the other run failed at the existing
  divider-preference step (sidebar width read 224 instead of 248 after a 300 ms wait), after the
  Discover step had passed; without screenshots 14/14. Both intermittent failures are outside this
  change and are recorded as residual risks.
- Rendered evidence: wide Discover shows `All (3) | Papers (1) | Repositories (1) | Other (1)`
  next to the status; at 820 px the row wraps and the segments keep every count visible, so the
  kill criterion is not met.
- `npm run check`: exit 0; 707 main and 116 AppKit tests; coverage at or above 80% on all axes.
- Independent diff review (fresh-context reviewer): no blocker. Medium: the width assertion was
  true by construction in an unwrapped row and the minimum-width case was unasserted. Resolution:
  the content column cannot be narrower than 591 pt (window minimum 820 px, sidebar split
  `minContentWidth` 636), and the workflow smoke now asserts the segmented width at the 820 px
  wrapped row (351 >= 343 pt). Low: the Discover unit test now checks that `other` empties the
  list and `paper` restores every row.
- After the review fixes: workflow smoke without screenshots 14/14; with screenshots one run had
  all 14 behaviour groups pass but macOS `screencapture` could not image the promotion sheet,
  and the rerun passed 14/14; `npm run check` exit 0 (707 main, 116 AppKit tests).
- Not run: package/install smoke, VoiceOver speech (accessibility label checked by inspection).
- Stop condition: G1-G3 verified.
