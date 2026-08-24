# Notes: TheRSS Post-Audit Slice B

## Evidence Boundaries

- Current code and current-run after-state screenshots determine completion.
- Figma is a collaboration artifact; Electron source/tests remain implementation truth.
- No new dependency is justified for the first progressive-rendering slice.

## Findings

### Figma writeback

- Added section `TheRSS Post-Slice-A Audit · New Findings` to the existing board.
- Included Analytics/Sources scroll carry-over, Discover 100-result pressure, Saved buried actions,
  and the healthy 820 px control screenshot.
- Recorded B1/B2 implementation order and reserved after-state follow-up.

### Focused implementation contracts

- `App.navigate` currently changes only view and toast state; the main scroll container has no ref
  or navigation contract.
- Discover maps every filtered item and renders card titles at `h2`, the same level as the result
  section heading.
- Saved renders the full summary before paper analysis, reasons, and actions.
- Current aesthetic direction is restrained native/editorial: Apple system typography, grouped
  surfaces, calm semantic accents, and controlled density. The improvement should reduce visual
  monotony and interaction distance, not replace the established identity.

## Implementation

- Primary navigation now resets both axes of the shared `main` scroll container before changing
  views.
- Discover initially renders 24 filtered results, exposes an honest count, and reveals up to 24
  more per action without changing the persisted snapshot.
- Discover card titles are `h3` under the `Ranked source records` `h2`; summaries retain the existing
  three-line visual clamp through an explicit class.
- Saved action controls now follow the title and remain sticky while the detail pane scrolls.
- Saved summaries longer than 420 characters collapse to six lines with an explicit accessible
  `Show full summary` / `Collapse summary` control; selection changes reset the disclosure.

## Verification

- Corrected RED: 4 intended failures across R1–R4.
- Focused GREEN: 40/40 App/style tests.
- Full gate: 49 files / 298 tests; 90.43% statements, 80.12% branches, 93.86% functions, and 93.33%
  lines. Formatting, lint, TypeScript, main/preload/renderer/MCP builds passed.
- Electron desktop + minimum-width E2E: 2/2 passed.
- Fresh inspected after-states: `13-after-discover-progressive.png`,
  `14-after-saved-actions.png`, and `15-after-navigation-reset.png`.
- Figma section `TheRSS Post-Slice-A Audit · New Findings` contains before evidence, implementation
  order, after evidence, and verification closure.

## UI / UE Aesthetic Assessment

### What is already visually strong

- The refined macOS research-desk direction is coherent: Apple system typography, restrained
  grouped backgrounds, thin separators, modest radii, and view-specific semantic accents.
- The layout uses hierarchy rather than decoration; provenance and evidence-boundary copy remain
  visible without creating a warning-heavy product.
- Progressive results and the Saved action relocation reduce visual monotony and decision distance
  without replacing the established identity.

### Remaining aesthetic opportunities

- The Saved display title remains intentionally editorial but can occupy four lines; after the
  sticky-action fix it is usable, so any further size reduction is polish rather than correctness.
- The llm-wiki receipt can still make the action area two lines. A later structural change should
  render action buttons in one row and the receipt as a separate status line or toast.
- Repeated 9–10 px uppercase micro-labels are visually elegant but demanding; increase critical
  labels to 11–12 px and reduce tracking where scan speed matters.
- Sources mixes English UI chrome, Chinese metadata, adapter names, and Folo provenance. This harms
  visual calm more than the palette does; locale and terminology cleanup is higher value than new
  colors.
- Analytics and Sources use many similarly bordered cards. A later pass can reduce one card layer
  and use spacing/section rhythm for hierarchy, avoiding a dashboard-of-boxes feel.
- The sidebar health footer is visually quiet but disconnected from the information it summarizes;
  making it an actionable source-status entry would improve both beauty and utility.

## Remaining Boundary

- Provider Test Connection, credential lifecycle, Settings restructuring, source terminology,
  high-contrast/forced-colors, list/detail divider, window restoration, code decomposition, and
  dated-verification documentation remain later slices.
- No live source/provider call, llm-wiki write, install, commit, push, or publication was performed.
