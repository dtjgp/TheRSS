# Notes: TheRSS Post-Slice-A Product Audit

## Evidence Policy

- Current-run screenshots only for visual claims.
- Current source/tests may support implementation-level findings.
- Prior audit and memory are context, not current visual evidence.
- Screenshot evidence cannot establish full WCAG conformance.

## Findings

### Confirmed Slice A health

- The 820 px Discover layout keeps the complete source count on its own row; runner and submit are
  visible below it.
- Sources distinguishes configured membership, recorded health, and local cache state.
- Analytics explicitly labels lifetime volume and the seven-local-day count.
- The explicit placeholder token remains readable in the current compiled renderer.

### New high-priority finding — cross-view scroll carry-over

- After scrolling Models & Agents, navigating to Analytics retained `main.scrollTop = 405.5`.
- The Analytics header began at viewport y = `-311.5`, hiding the title and summary cards.
- Navigating onward to Sources retained the same scroll context and hid the directory heading and
  health metrics.
- `App.navigate` changes only `activeView` and toast state; it does not reset or restore main scroll.

### Remaining high-priority findings

- A 100-result Discover fixture produced 100 articles, 204 buttons, 101 `h2` elements, 2,169 DOM
  descendants, and a 30,647 px result scroll area with no pagination.
- Saved detail had a 593 px visible pane, a 502 px summary, and actions below the initial viewport;
  the decision controls were not initially visible.

### Remaining product and accessibility findings

- Models & Agents remains a primary destination rather than a Settings surface.
- Provider setup still lacks Test Connection, explicit credential clear/replace, field-level error
  association, and unsaved-change protection.
- `Ready now` has no displayed observation timestamp; only the health value is passed into Sources.
- The sidebar attention indicator is a non-interactive `div`, so it cannot take the user to the
  affected sources.
- Discover uses the same `h2` level for its section heading and all 100 card headings.
- Source cards visually expose `ACTIVE ADAPTER`, `Folo 1543`, and research-axis abbreviations; the
  accessible names are better than the visual copy, but the visual language remains mixed.
- No `prefers-contrast`, forced-colors, field-level `aria-invalid`, or complete VoiceOver/200% zoom
  evidence exists.
- Current sizes are `App.tsx` 965 lines, `DiscoverView.tsx` 600, `SourceCatalogView.tsx` 544, and
  `styles.css` 3,610. `PRODUCT.md` still uses undated `live-verified` wording while the UI now uses
  `configured` plus dated verification.
