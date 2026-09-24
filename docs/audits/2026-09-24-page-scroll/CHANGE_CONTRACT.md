# Change Contract: page-level scrolling and Discover pagination

Scope authority: on 2026-09-24 the user asked to commit the keyboard slice and "开始做整页滚动和分页"
(audit finding F3 in the [UX audit](../2026-09-23-apple-native-ux/REPORT.md)).

## Feature Intake

- User outcome: at the default window size every workspace fits the window, with scrolling only
  inside lists, tables and reading panes; Discover lists every result without "Show 24 more".
- Evidence (2026-09-24, `test-results/2026-09-24-keyboard/workflow-plain`, 35 captured states):
  `native-main` is an adaptive scroll view that scrolls only when the page's minimum content
  exceeds the window. In the current build exactly one captured state overflows:
  `analytics-daily-values` (962 pt content in an 848 pt viewport). All Discover, Saved, Sources and
  Settings states fit, including 820x600 and 150% zoom. The audit's original Discover overflow was
  caused by the page title and top row removed in S1 and the title slice.
- Pagination: Discover renders 24 rows and a "Show 24 more" button although `NSTableView` loads
  rows lazily; opening a local result beyond the first page needs page arithmetic.
- Decisions:
  - Keep the adaptive outer scroll as an overflow fallback for very small windows and high zoom
    (macOS forms also scroll there); guard the default size instead.
  - Analytics "Show daily values" swaps the chart for the exact-value table inside the trend
    panel (Health-style "show data"); the series pop-up is hidden while the table, which lists all
    series, is shown; the button reads "Show chart". This keeps the table's full 7-row height and
    PRODUCT.md's exact daily values. Alternative rejected: shrinking the table beside the chart
    (would scroll 7 rows inside ~120 pt and need a weaker height assertion).
- Kill criterion: stop if a workspace cannot fit the default window without hiding evidence.

## Capability Contract

- P1: Discover shows every filtered result; footer reads "N results"; no "Show 24 more"; local
  results beyond row 24 open without paging state.
- P2: Analytics daily values replace the chart while shown; the page fits at the default size.
- P3: the workflow smoke fails any capture at a viewport of 800 pt or more whose page content
  exceeds the viewport ("needs an outer page scroll").
- Non-goals: removing the adaptive fallback, restyling Analytics metrics, Web fallback.
- Allowed scope: `src/main/appkit/{discover,analytics}.ts` and tests,
  `src/main/appkit/localNavigation.test.ts`, `scripts/smoke-native-appkit.mjs`, this directory.

## Frozen Acceptance Contract

- RED: `analytics.test.ts` (chart hidden, series pop-up hidden, "Show chart" while values shown);
  `discover.test.ts` (30 of 30 rows, "30 results", no `discover-more`); the smoke overflow guard
  is RED by the recorded 962/848 measurement above.
- Verifier: `npm run check`; workflow smoke 14/14 with and without screenshots including the new
  guard; controls smoke.
- Stop condition: P1-P3 verified; the only changed assertions are logged below.

### Acceptance-change log

| Date       | Contract change                                                                                                                                                                          | Evidence/reason                                                                             | Reviewer |
| ---------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------- | -------- |
| 2026-09-24 | `discover.test.ts` "pages 24 items" expects all 30 rows and no `discover-more` instead of 24 rows then 30 after "Show 24 more"                                                           | P1 removes pagination by request                                                            | user F3  |
| 2026-09-24 | `discover.polish.test.ts` and `directInteraction.test.ts` expect the full restored session (`nativeDiscoverFixture.items.length`, 30) instead of the 24-row page while a draft is edited | Same intent (old results retained); P1 removes the page size; found by the first full check | user F3  |

## Verifier log

1. First run: `npm run check` failed two further unit assertions on the 24-row page
   (`discover.polish`, `directInteraction`; now logged above); its build step therefore did not
   run, and both workflow smokes exercised the previous build and stopped at the new guard on
   `analytics-daily-values` (962 pt / 848 pt), a live RED for P3.
2. Second run (current build): `npm run check` exit 0 (704 main, 113 AppKit tests); controls smoke
   with screenshots 11/11; workflow smoke with screenshots 14/14 including the guard. One plain
   run failed in group 2 because the fixture window had already been destroyed (`Object has been
destroyed` at the source-picker click; no crash report). Two immediate plain reruns with
   `THERSS_NATIVE_CLOSE_TRACE=1` passed 14/14, so no close trace was captured. This matches the
   unreproduced test-window-close event already recorded in GOALS.md; this slice does not touch
   window lifetime.

## Independent Review

- Fit: P1-P3 met. The adaptive outer scroll stays as a small-window/high-zoom fallback, now
  guarded at ordinary heights.
- Assertions: three pagination assertions changed, all logged; their intent (restored results
  stay listed) is kept. No other assertion changed.
- Behaviour changes to note: Discover lists every result (30 in the fixture) with an "N results"
  footer; Analytics "Show daily values" replaces the chart (button "Show chart") instead of adding
  a table below it.
- Residual: the intermittent fixture-window close remains unexplained (1 of 4 workflow runs in
  this slice).

## Evidence Closeout

- Changed files: `src/main/appkit/{discover,analytics}.ts`, `src/main/appkit/{discover,analytics,discover.polish,directInteraction}.test.ts`,
  `scripts/smoke-native-appkit.mjs`.
- `npm run check`: exit 0. Native: controls 11/11; workflow 14/14 in 3 of 4 runs (see log).
- Not run: package/install, VoiceOver.
- Rollback: revert the slice commit. Git: uncommitted; installed app not updated.
