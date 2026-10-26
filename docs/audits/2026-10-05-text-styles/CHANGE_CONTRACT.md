# Change Contract: macOS system text styles

Scope authority: on 2026-10-05 the user decided F13 ("F13 阅读区摘要保持 14 pt"): the reading
summary keeps 14 pt. That decision unblocked the remaining F13 item in the
[UX audit](../2026-09-23-apple-native-ux/REPORT.md): "ad hoc font sizes (23/14/12/11/10)
instead of system text styles".

## Feature Intake

- User outcome: the native interface uses the macOS text hierarchy (Title 1, Title 2, Body,
  Callout, Subheadline) like first-party apps, with one deliberate exception: the reading
  summary stays 14 pt for comfortable long reading.
- Current behaviour (code, 2026-10-05): labels set point sizes directly (`size: 12`, `size: 11`,
  `size: 17`); headings use a hard-coded 23 pt; research row details and table headers use a
  hard-coded 12 pt; the reading summary uses 14 pt.
- Measured system sizes on this Mac (macOS 27.2, `NSFont preferredFont(forTextStyle:)`):
  Title 1 22, Title 2 17, Title 3 15, Headline 13 bold, Body 13, Callout 12, Subheadline 11,
  Footnote 10. Every current size except the 23 pt heading and the 14 pt summary matches a style.
- Product fit: UI skill row Visual hierarchy ("use system text styles"); D3 keeps the system font;
  profile 3/2/7 unchanged. Visible change: headings 23 → 22 pt; everything else keeps its size.
- Boundary changes: node field `textStyle` (`title1`, `title2`, `title3`, `headline`, `body`,
  `callout`, `subheadline`, `footnote`) in the typed presentation contract; `size` remains only
  for the reading text exception and symbol glyphs. No IPC, SQLite, network or package change.
- Kill criterion: stop if a migrated label changes its rendered size other than the heading's
  documented 1 pt, or if the reading summary is no longer 14 pt.

## Capability Contract

- T1: native fonts come from `preferredFontForTextStyle` scaled by the window zoom; bold weight
  keeps the style size; `weight: 'title'` means Title 1 bold.
- T2: all label sizes in `src/main/appkit` use `textStyle`; research row details and table
  headers use Callout; the reading summary keeps `size: 14` with its decision comment.
- T3: the schema rejects `size` on labels and buttons (only `text` and `symbol` nodes take it).
- Non-goals: Web fallback CSS, table row font (Body), translating text.
- Allowed scope: `src/main/appkit/*.ts` and tests, `native/appkit/node.mm`, AppKit smoke
  scripts, this directory, the UX audit report.

## Frozen Acceptance Contract

- RED (unit): schema accepts `textStyle` and rejects `size` on a label; screens emit the mapped
  styles; the reading summary keeps `size: 14`.
- RED (native): controls smoke: labels with each style report the measured system point size
  (× zoom), a heading reports 22 pt bold, a reading text node reports 14 pt.
- Full verifier: `npm run check`; controls smoke; workflow smoke 15/15; E2E 8/8.
- Stop condition: T1-T3 verified; every changed assertion logged below.

### Acceptance-change log

| Date | Contract change | Evidence/reason | Reviewer |
| ---- | --------------- | --------------- | -------- |

No existing assertion changed.

## Verification (2026-10-05)

- Unit RED: the schema had no `textStyle` and accepted `size` on labels; screens emitted point
  sizes. GREEN after the change (`textStyles.test.ts`).
- Controls smoke RED on the pre-change binary ("style-title1 uses its system size": the heading
  was 23 pt); GREEN 19/19 groups: each style at its measured system size at zoom 1 and 1.5,
  bold where set, reading text 14 pt.
- Workflow smoke with screenshots 15/15; E2E 8/8; `npm run check` exit 0 (745 main, 143 AppKit
  tests).
- Rendered evidence: `discover-light.png` shows the reading heading at Title 1 (22 pt bold), the
  summary at 14 pt and secondary lines at Callout/Subheadline.
- Independent diff review (fresh-context reviewer, static): no blocker; no producer still emits
  `size` outside reading text and symbols. Fixed: a controls fixture label still sent
  `size: 17` (now `textStyle: 'title2'`); the smoke compared with hard-coded sizes, which could
  break on CI's macOS, so inspection reports the system size of each style and the smoke checks
  `fontSize = system size × zoom` plus the hierarchy order; style sizes are looked up once per
  process; `headline` is bold, as the system style is.
- After the review fixes: controls smoke 19/19; workflow smoke 15/15; `npm run check` exit 0
  (745 main, 143 AppKit tests).
- Not run: VoiceOver speech, the Web fallback (unchanged).
