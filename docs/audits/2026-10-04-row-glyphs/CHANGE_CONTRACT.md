# Change Contract: kind glyphs and Saved star in research rows

Scope authority: on 2026-10-04 the user asked "继续做 F14" (audit finding F14 in the
[UX audit](../2026-09-23-apple-native-ux/REPORT.md)). The glyph part only; localized date display
remains a separate product decision.

## Feature Intake

- User outcome: research lists can be scanned like Mail or Finder lists. A leading glyph tells a
  paper from a repository, model, dataset, article or post; a star marks a saved result.
- Current behaviour (code and screenshots, 2026-10-04): Discover and Saved rows show only a title
  and a subtitle such as `arXiv · 2026-08-14 · Saved`; kind is not shown; Saved state is a word
  at the end of the subtitle, truncated first in narrow lists.
- Product fit: PRODUCT.md result lists and evidence fields are unchanged; UI skill rows Visual
  hierarchy and Familiarity; D4 allows the semantic saved colour; D7 (Lucide) governs only the
  Web fallback, the native route already uses SF Symbols. Profile 3/2/7 unchanged.
- Alternatives: keep text only (status quo); a kind column (rejected: list rows are single-column
  research cells); coloured kind badges (rejected: decorative colour, D4).
- Boundary changes: research-row fields `symbol` (kind glyph, existing allowlist extended by six
  SF Symbols), `symbolLabel` (accessible kind name) and `saved`. No IPC, SQLite, network or
  package change.
- Kill criterion: stop if the glyphs reduce the visible title width so that two-line titles in
  the minimum-width list lose their ellipsis behaviour or overlap the star.

## Capability Contract

- R1: `researchKindSymbol(kind)` maps every `DiscoveryItemKind` to one SF Symbol and label:
  paper `doc.text`, repository `chevron.left.forwardslash.chevron.right`, article `newspaper`,
  model `cpu`, dataset `tablecells`, post `text.bubble`.
- R2: Discover rows carry the kind glyph and `saved` from the current triage state; the subtitle
  no longer ends in ` · Saved`. Saved-workspace rows carry the kind glyph, no star and no
  ` · Saved` text (every row there is saved). The reading header keeps its Saved text.
- R3: native research cell: leading glyph (secondary label tint) before the title and subtitle;
  trailing `star.fill` on saved rows in the saved colour (contrast at least 3:1 against the row
  background in light and dark; label colour under Increase Contrast); title and subtitle never
  overlap the star; accessibility label `Title. Kind. Subtitle. Saved.`
- Non-goals: local-search and analytics rows, date format, Web fallback.
- Allowed scope: `src/main/appkit/{presentation,researchMetadata,discover,saved}.ts` and tests,
  `native/appkit/node.mm`, AppKit smoke scripts, this directory, the UX audit report.

## Frozen Acceptance Contract

- RED (unit): `researchKindSymbol` covers every kind; Discover rows carry `symbol`,
  `symbolLabel` and `saved` and no Saved text; Saved rows carry the glyph without `saved`;
  presentation accepts `saved`/`symbolLabel` on rows.
- RED (native): controls smoke: a research table with a saved and an unsaved row shows the glyph
  on both, the star only on the saved row, the title inset after the glyph and clear of the
  star, the accessibility label, and star contrast >= 3 in light and dark.
- Full verifier: `npm run check`; controls smoke; workflow smoke 14/14 with and without
  screenshots, with the Discover save step asserting the star.
- Stop condition: R1-R3 verified; every changed assertion logged below.

### Acceptance-change log

| Date       | Contract change                                                                                                                                  | Evidence/reason                                       | Reviewer |
| ---------- | ------------------------------------------------------------------------------------------------------------------------------------------------ | ----------------------------------------------------- | -------- |
| 2026-10-04 | `discover.test.ts` "persisted item state for Saved markers" expects `rows[0].saved === true` and no ` · Saved` subtitle text instead of the text | R2 moves the Saved marker from text to the row field  | user F14 |
| 2026-10-04 | `researchMetadata.test.ts` drops the `researchSubtitle(paper, true)` Saved-suffix case; the subtitle no longer carries Saved state               | R2; the suffix parameter is removed with its last use | user F14 |

## Verification (2026-10-04)

- Unit RED: `researchKindSymbol` missing; rows had no `symbol`/`symbolLabel`/`saved`; the schema
  rejected the new row fields. GREEN after the change; `researchRowGlyph(undefined)` gives no
  glyph for an item without a recorded kind.
- Controls smoke RED on the pre-change native binary: the glyph group failed (`rowGlyphs`
  missing). GREEN: 15/15 groups behaviour-only; that run skipped screenshots because
  `screencapture` could not image any fixture window at that time.
- Workflow smoke: without screenshots 14/14; with screenshots all 14 behaviour groups passed and
  34 images were captured; the run failed only on the known off-Space captures of windows with a
  sheet or popover. The Discover save step asserts the star, the kind glyph on every row, the
  spoken "Saved" and no Saved text in the subtitle.
- Rendered evidence: `discover-saved-feedback.png` (light) and `discover-dark.png` show the
  document, newspaper and code glyphs and the star only on saved rows. Measured star contrast before the
  review fix: 3.65:1 light, 11.8:1 dark. The leading glyph narrows titles by 24 pt; a two-line title still
  ends with an ellipsis (controls smoke), so the kill criterion is not met.
- `npm run check`: exit 0; 713 main and 122 AppKit tests; coverage at or above 80% on all axes.
- Independent diff review (fresh-context reviewer, static): no blocker.
  1. Medium: glyph tints did not follow a live Increase Contrast change. Fixed: the appearance
     update refreshes the cells' contrast state; controls smoke asserts it after switching to the
     high-contrast appearance.
  2. Low-medium: the light star (#b77900) was about 2.7:1 on the unfocused selection grey. Fixed:
     light colour #a86f00; inspection now also measures against
     `unemphasizedSelectedContentBackgroundColor`; workflow measurement 4.25:1 on the list and
     3.1:1 on the unfocused selection; controls smoke requires 3:1 for both in light and dark.
  3. Low: the repository glyph might clip in its 16 pt frame. Not changed: the screenshots show it
     whole (`NSImageView` scales proportionally down).
     Also added: glyph tint follows an emphasized (focused) selection, asserted when the fixture
     window is key (it was).
- After the review fixes: controls smoke 15/15 (behaviour-only); workflow smoke without
  screenshots 14/14; `npm run check` exit 0 (713 main, 122 AppKit tests).
- Not run: package/install smoke, VoiceOver speech (spoken label checked by inspection).
