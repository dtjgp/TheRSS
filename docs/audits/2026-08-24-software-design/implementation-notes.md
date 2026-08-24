# Notes: TheRSS Design Audit Slice A

## Evidence Boundaries

- Current code and current-run renderer output override the earlier audit narrative.
- No live source/provider call is required to verify these renderer changes.
- Historical verification must not be presented as current source health.

## Findings

### D1 — Minimum-width Discover

- `.discover-controls` remains a three-column grid at every width.
- Existing `@media (max-width: 920px)` rules do not target Discover controls.
- The declared native minimum window width is 820 px, where the source-count text overflows its
  available grid column.

### D2 — Source-state truth

- Catalog membership is immutable metadata; it records a previous verification gate, not current
  reachability.
- `DashboardSnapshot.sourceHealth` already exposes current `idle`, `refreshing`, `healthy`,
  `no_results`, `partial`, or `failed` state.
- `SourceContentSnapshot.status` describes whether the displayed local snapshot is cached or came
  from the latest in-app request.
- `lastIndexedAt` is the maximum item `last_seen_at`; label it as local index freshness rather than
  a request timestamp.

### D8 — Placeholder contrast

- No explicit `::placeholder` rule exists; Chromium's default dark placeholder measured 3.02:1.
- Use a dedicated semantic token with normal-text contrast in both appearances and explicit
  opacity `1`.

### D9 — Analytics time scope

- The leading summary is a lifetime total, while the table is a seven-local-day window.
- The renderer already has all daily records needed to calculate the recent-window returned-record
  total without changing persistence or IPC.

## Implementation

- Discover uses a two-row control grid at `max-width: 920px`: source selection owns the full first
  row, while runner and submit remain visible on the second row.
- Sources receives the existing dashboard health snapshot. The catalog reports configured
  membership separately from ready, attention, and not-checked counts.
- Source detail separates `Current source health` from `Local snapshot`; cached content explicitly
  says that it does not prove current reachability, and `lastIndexedAt` is labeled as the latest
  indexed item.
- Placeholder text now uses an opaque semantic token equal to the readable secondary-label role in
  both appearances.
- Analytics labels the leading metric `Lifetime returned records` and calculates the sum represented
  by the current local-day window.

## Verification Evidence

- RED: 7 intended failures across D1, D2, D8, and D9; 13 neighboring assertions remained green.
- Focused GREEN: 47/47 renderer/style/integration tests.
- Full gate: 49 files / 294 tests; 90.43% statements, 80.12% branches, 93.86% functions, and 93.33%
  lines; format, lint, typecheck, main/preload/renderer/MCP builds passed.
- Electron E2E: focused minimum-width flow 1/1 and main desktop flow 1/1 passed.
- Dark placeholder runtime assertion is at least 4.5:1; the exact chosen colors compute above the
  threshold in unit coverage.
- Fresh accepted screenshots: `13-slice-a-sources.png`, `14-slice-a-source-detail.png`,
  `15-slice-a-analytics.png`, `16-slice-a-dark-placeholder.png`, and
  `17-slice-a-820-discover.png`.

## Remaining Boundary

- No live source/provider request, llm-wiki write, package/install, commit, push, or publication was
  performed.
- Slice B and later structural recommendations remain separate work; this slice does not reduce the
  100-result Discover density or move Saved actions.
