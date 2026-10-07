# Change Contract: dates in the system language

Scope authority: on 2026-10-05 the user decided F14 ("F14 日期改成按系统语言显示") in the
[UX audit](../2026-09-23-apple-native-ux/REPORT.md): display dates follow the macOS language
and region instead of ISO.

## Feature Intake

- User outcome: the native interface shows dates as the system does, e.g. `Aug 14, 2026`
  (en-US), `2026年8月14日` (zh-CN), `14.08.2026` (de-DE).
- Current behaviour (code, 2026-10-05): native display dates are ISO (`2026-08-14`) in result
  subtitles, the reading header, the Discover status line, local search, Data Analytics (analysis
  list, daily table) and the Sources content list. The Web fallback already localizes result
  dates with `toLocaleDateString`.
- Product fit and evidence: a display-only change. The calendar day is unchanged (formatted in
  UTC, as the ISO slice was); month-only publication dates show only the month and keep
  "(month only)". Exact timestamps in source details (`Published: …`), copy/drag citations and
  chart data keep ISO, because they are evidence or machine-readable.
- Alternatives: ISO everywhere (status quo); the app's UI language (rejected: the interface is
  English while the user's region formats dates).
- Boundary changes: shared `formatDisplayDate(value, locale)` and `sourcePublicationDisplay`;
  `NativeContext.locale` from Electron `app.getSystemLocale()` (fixture override
  `THERSS_E2E_LOCALE` for deterministic smokes). No IPC, SQLite, network or package change.
- Kill criterion: stop if a localized date could show a different calendar day than the stored
  value, or if any evidence/citation field changes.

## Capability Contract

- L1: `formatDisplayDate`: date-only and timestamp inputs → medium date style in the locale,
  UTC calendar day; invalid input → the original text (bounded); unknown locale → system
  default; month-only helper → localized month.
- L2: native display sites above use it with `NativeContext.locale`; evidence/citation/chart
  data unchanged.
- Non-goals: the Web fallback, times of day, relative dates, translating UI text.
- Allowed scope: `src/shared/sourceDate.ts` and test, `src/main/appkit/{common,presenter,
recordPresenter,discover,saved,reading,researchMetadata,localSearch,analytics,sources,
savedSourceUpdate,testSupport}.ts` and tests, `src/main/nativeAppKitRuntime.ts`, AppKit smoke
  scripts, this directory, the UX audit report.

## Frozen Acceptance Contract

- RED (unit): formatter cases for en-US, zh-CN and de-DE, a UTC day boundary
  (`2026-03-01T00:30:00Z` stays March 1), month-only, invalid input; native sites render the
  localized form for `en-US`; source details and citations keep ISO.
- Native/workflow smoke with `THERSS_E2E_LOCALE=en-US`: the Discover status line ends with a
  localized date.
- Full verifier: `npm run check`; controls smoke; workflow smoke 15/15.
- Stop condition: L1-L2 verified; every changed assertion logged below.

### Acceptance-change log

| Date       | Contract change                                                                                                                           | Evidence/reason                               | Reviewer |
| ---------- | ----------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------- | -------- |
| 2026-10-05 | `discover.test.ts` status line expects `Sep 6, 2026` instead of `2026-09-06`                                                              | L2 localizes the session date (en-US harness) | user F14 |
| 2026-10-05 | `researchMetadata.test.ts` subtitles expect `Sep 6, 2026` and `Aug 2026 (month only)` instead of ISO; `researchSubtitle` takes the locale | L1/L2                                         | user F14 |
| 2026-10-05 | `analytics.test.ts` daily table date cell expects `Sep 6, 2026`; the counts stay exact                                                    | L2: the visible date column is display        | user F14 |
| 2026-10-05 | Workflow smoke pins `THERSS_E2E_LOCALE=en-US` and the status pattern expects `Mon D, YYYY`                                                | Deterministic smokes on any Mac               | user F14 |
| 2026-10-05 | `nativeAppKitRuntime.test.ts` Electron mock gains `app.getSystemLocale`                                                                   | The runtime reads the system locale           | user F14 |

## Verification (2026-10-05)

- Unit RED: `formatDisplayDate`/`sourcePublicationDisplay` missing; GREEN with en-US, zh-CN and
  de-DE cases, a UTC day boundary, month-only and invalid input (`sourceDate.test.ts`). New
  `localizedDates.test.ts`: zh-CN reading header and rows, de-DE local search, record reader;
  the drag citation keeps the ISO day and source details keep the raw `Published:` value.
- Real native window: with `THERSS_E2E_LOCALE=zh-CN` the Discover capture shows
  `2026年10月5日` (status), `2026年8月14日` (header and row); the run then stopped at the en-US
  status pattern, as intended. This Mac reports `app.getSystemLocale()` = `en-US`
  (`Aug 14, 2026`).
- Workflow smoke 15/15 without and with screenshots (pinned en-US); controls smoke 17/17;
  `npm run check` exit 0 (740 main, 139 AppKit tests).
- Independent diff review (fresh-context reviewer, static): no blocker. Fixed: the daily Date
  column widened from 110 to 130 pt (pt-BR medium dates measured 116 pt of text; hu-HU and ru-RU
  were borderline); a month-only value that does not parse falls back to the stored text instead
  of throwing (test); added tests for the fixture-only locale gate, the Sources content list,
  "Local retrieval" and the Analytics analysis list. Remaining ISO sites (`Created:`,
  `Indexed:`, `Expires:`, `Tested:`, `Published:`, citations, chart points) are evidence or
  provenance and stay ISO.
- After the review fixes: `npm run check` exit 0 (743 main, 141 AppKit tests); `npm audit
--audit-level=high` exit 0; E2E 8/8 in two consecutive runs (a first run failed both quit
  tests on a 5 s exit timeout, not reproduced); workflow smoke 15/15.
- Controls smoke: the existing compact-navigation check (`smoke-appkit-controls.mjs:1009`,
  reader scroll origin 0,0 after a pane switch) failed in 3 of 5 runs here and in 1 of 2 runs at
  the pushed head without this change; it is a pre-existing intermittent fault, not caused by
  this slice, and needs its own investigation.
- Not run: Web fallback (unchanged by scope), VoiceOver speech.
