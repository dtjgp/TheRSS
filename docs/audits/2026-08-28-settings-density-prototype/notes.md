# Notes: Settings Density Prototype

## Current Evidence

- Current page padding reaches 82px and H1 reaches 64px.
- `APPLICATION SETTINGS` duplicates `Settings`.
- Personal pane repeats `PERSONAL CONTEXT`, `Personal Discover prompt`, and the field label.
- Existing tab roles, field order, privacy text, status/error behavior, and button system are verified and frozen.

## Prototype Evidence

- Interactive Current/Compact mode switch is keyboard-operable and exposes `aria-pressed`.
- 1360x880 measurement: Current workspace begins at 278px; Compact begins at 145px; Compact moves
  useful controls 133px earlier.
- 820x700 Compact workspace begins at 154px.
- Document/body horizontal overflow: 0px at 1360 and 820.
- Accessibility snapshot retains H1, H2, Settings tablist/tabs, Personal tabpanel, textarea label,
  privacy copy, character status, and save action.
- Keyboard Tab focus on Model provider exposes a solid 3px focus outline and preserves
  `aria-selected="false"` until activation.
- Dark and forced-colors screenshots preserve boundaries and readable hierarchy.
- Clean browser session: zero console errors or warnings.
- Artifacts: `output/playwright/settings-density-prototype/`.

## Decision

User decision: Compact approved for a production RED/GREEN slice. Current remains the comparison
baseline; F7/F8/F5 remain deferred.

## Production RED/GREEN

- RED: two files / 29 tests ran; 27 existing tests passed and the two new contracts failed because
  duplicate eyebrows and old geometry remained.
- GREEN: the same two files passed 29/29 after removing only the three duplicate eyebrows and
  translating the approved Compact CSS values.
- No field, tab, action, validation, dirty-state, API, or IPC behavior changed.

## Production Verification

- Full `npm run check`: pass; architecture, format, lint, types, 61 test files / 411 tests,
  coverage, and both builds are green.
- Coverage: 90.29% statements, 80.15% branches, 93.64% functions, and 93.20% lines.
- Electron `npm run test:e2e`: pass 2/2 after correcting one over-broad test selector that matched
  the intentionally preserved Personal context tab.
- Production appearance evidence: wide light, dark, 820px, 200% zoom, forced colors, keyboard
  focus, and horizontal-overflow checks passed.
- Independent diff/security review: no dependency, remote asset, credential handling, logging,
  database, preload, IPC, package, or update change; all inspected owned files remain <=800 lines.
- No commit, push, package/app install, or publication was performed.
