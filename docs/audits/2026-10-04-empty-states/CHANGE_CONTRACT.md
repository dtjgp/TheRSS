# Change Contract: native empty states

Scope authority: on 2026-10-04 the user asked "继续做 F13 的空状态改进" (the empty-state part of
audit finding F13 in the [UX audit](../2026-09-23-apple-native-ux/REPORT.md)). System text styles
(the other F13 part) wait for the user's reading-size decision and are not changed here.

## Feature Intake

- User outcome: an empty workspace explains itself at a glance, like Mail, Notes or Finder: a
  large secondary symbol, a short title, one explanatory sentence and, where useful, the action
  that recovers from it.
- Current behaviour (code, 2026-10-04): every empty state is one top-aligned label, sometimes
  followed by a button: Discover (no session; no result in this view), Saved (nothing saved;
  nothing from the filtered source), local search (no query; no match), Sources detail (no
  matching source) and the reading pane (nothing selected).
- Product fit: PRODUCT.md states are unchanged; wording keeps the distinct states (no session,
  filtered-out results, empty search) and points to Search details for source outcomes; UI skill
  rows Feedback and Visual hierarchy; D9 rejects illustrations, so the symbol is an SF Symbol.
  Profile 3/2/7 unchanged.
- Alternatives: keep labels (status quo); a custom illustration (rejected, D9).
- Boundary changes: one bounded `symbol` node kind (SF Symbol from the allowlist, 16-48 pt) and
  `align: 'center'` on columns and labels in the typed presentation contract. No IPC, SQLite,
  network or package change.
- Kill criterion: stop if a centered empty state clips its text or action at the minimum window
  size (820 x 600) or at zoom 1.5.

## Capability Contract

- E1: `symbol` node: `symbol` required (allowlist), `title` (accessibility description, decorative
  image not exposed separately), `size` 16-48 pt, tertiary label tint (secondary under Increase
  Contrast).
- E2: `align: 'center'` column: the non-flex stack is centered vertically; each child keeps its
  intrinsic or `maxWidth` width and is centered horizontally (rows by their content width);
  centered labels center their text. `align` is valid only on columns and labels.
- E3: shared `emptyState(id, symbol, title, message, actions)` builder: `<id>-symbol`,
  `<id>-title` (17 pt bold, the macOS Title 2 size), `<id>-message` (secondary, max 420 pt),
  `<id>-actions` row.
- E4: workspaces use it:
  - Discover, no session: `sparkle.magnifyingglass`, "Start a research search", existing message.
  - Discover, session with no result in the chosen kind: "No <kind> in this session", message
    keeps "No results match this view ... Search details", action "Show all results" (resets the
    filter); with kind All: "No results", same message, no action.
  - Saved, nothing saved: `star`, "No saved research", existing message, "Open Discover".
  - Saved, filtered source empty: `star`, "No items from <source>", message starts with the
    existing "No saved items from this source.", "Show all Saved".
  - Local search, no match: `magnifyingglass`, "No results for “<query>”", existing message plus
    where the search looked.
  - Sources detail, no match: `square.stack`, "No matching sources", existing message.
  - Reading pane, nothing selected: `doc.text`, "No selection", existing hint.
- Non-goals: text styles elsewhere, Analytics chart empty line, source-picker empty line (inside
  the popover list), Web fallback.
- Allowed scope: `src/main/appkit/{presentation,common,discover,saved,localSearch,sources,
reading}.ts` and tests, `native/appkit/node.mm`, AppKit smoke scripts, this directory, the UX
  audit report.

## Frozen Acceptance Contract

- RED (unit): schema accepts a `symbol` node and centered columns/labels and rejects a missing
  symbol, an out-of-range size and `align` on other kinds; Discover, Saved and local search
  render the E4 titles, symbols and actions; "Show all results" restores the list.
- RED (native): controls smoke group: `symbol` renders an `NSImageView`; a centered column
  centers the stack vertically and its children horizontally; centered labels report centered
  alignment; the action row is centered; nothing clips at zoom 1.5 in a 600 pt high column.
- Full verifier: `npm run check`; controls smoke; workflow smoke 14/14 with and without
  screenshots, with one empty state asserted in the native window.
- Stop condition: E1-E4 verified; no existing assertion weakened.

### Acceptance-change log

| Date       | Contract change                                                                                                                                                                                                                             | Evidence/reason                                                                                                                          | Reviewer |
| ---------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------- | -------- |
| 2026-10-04 | E4 Discover empty session with kind All: title follows the outcome ("Search failed", "Search canceled", otherwise "No results") instead of always "No results"                                                                              | Independent review: a failed or canceled session titled "No results" merges distinct states (AGENTS.md evidence boundary); new unit test | user F13 |
| 2026-10-04 | E4 Sources detail message "Use Clear filters in the list to see every source." instead of repeating "No sources match these filters."; `sources.test.ts` reads the list's sentence from `sources-filter-empty` and the detail title/message | Review: VoiceOver read the same sentence twice; the list keeps the original sentence and its Clear filters action                        | user F13 |
| 2026-10-04 | E1 symbol size 16-48 pt (was 16-64)                                                                                                                                                                                                         | The base node schema already caps `size` at 48                                                                                           | user F13 |

Existing `*-empty-message` texts keep the asserted wording except the logged Sources detail change.

## Verification (2026-10-04)

- Unit RED: the schema rejected `symbol`/`align`; Discover, Saved and local search rendered
  single labels without titles, symbols or the "Show all results" action. GREEN after the change
  (new `emptyState.test.ts`, four tests).
- Controls smoke RED on the pre-change native binary: the title was not centered. GREEN 16/16
  groups (behaviour-only): centered on both axes at zoom 1 and 1.5 in a 600 pt column, no overlap,
  title within 420 pt, centered text, decorative symbol not exposed to VoiceOver, action clickable.
- Workflow smoke: without screenshots 14/14 with the Saved step filtering to a source without
  saved items (centered title, symbol, centered recovery action, reset restores the list); with
  screenshots all 14 behaviour groups passed and 35 images were captured; the run failed only on
  the known off-Space captures of windows with a sheet or popover.
- Rendered evidence: `saved-empty-filter.png` shows the star, "No items from WIRED", the
  explanation and "Show all Saved" centered in the content area.
- `npm run check`: exit 0; 717 main and 126 AppKit tests; coverage at or above 80% on all axes.
- Independent diff review (fresh-context reviewer, static): no blocker.
  1. Medium: failed/canceled sessions were titled "No results". Fixed (log above, unit test).
  2. Medium (latent): the new row `preferredWidth` branch changed every row's preferred width;
     no current row is nested in a row. Fixed: centered columns use a separate
     `naturalRowWidth`, other rows keep their previous width.
  3. Low: a stack taller than its column starts at the top and is not clipped by the column; the
     panes give at least their minimum height. Not changed; recorded as a residual risk.
  4. Low: the 64 pt bound could never apply. Fixed (16-48, lower bound tested).
  5. Low: duplicate Sources sentence for VoiceOver. Fixed (log above).
- After the review fixes: unit 127 AppKit tests; controls smoke 16/16 (one earlier run failed in
  the existing IME group with "ya" typed into the field, which matches real desktop keystrokes
  reaching the key fixture window; the rerun passed); workflow smoke without screenshots 14/14 in
  two consecutive runs after one run failed in the existing Save step (reading pane 40 pt wider
  between two reads of the same step, not reproduced); `npm run check` exit 0 (718 main,
  127 AppKit tests).
- Not run: package/install smoke, VoiceOver speech.
