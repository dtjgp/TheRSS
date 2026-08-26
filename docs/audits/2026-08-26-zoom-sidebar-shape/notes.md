# Notes: Zoom-aware sidebar and unified selection shape

## User evidence

- At Electron page zoom 200%, the full sidebar remains expanded and consumes most of the visible
  renderer width; Discover content becomes a magnified crop.
- The active Discover navigation item is visibly rounded while the active `All` result filter is
  square.

## Current implementation evidence

- `App` listens to renderer `resize` and stores `window.innerWidth` as `viewportWidth`.
- Sidebar width is capped against `viewportWidth`, but the only collapsed state is a user-toggle
  boolean; there is no effective constrained state.
- Existing width persistence correctly separates preferred width from viewport-capped width and must
  remain unchanged.
- `AppTopbar` owns the accessible sidebar toggle label.
- `.nav-item` has `border-radius: 7px`; `.discover-result-filters button` has no radius.

## Framework evidence

- Electron exposes a page zoom factor and its zoom changes alter renderer presentation. This slice
  relies on the already observed renderer resize/inner-width behavior rather than adding an IPC
  mirror of `webContents.getZoomFactor()`.

## Verification notes

- Focused RED: `npm test -- src/renderer/src/App.shell.test.tsx src/renderer/src/styles.test.ts`.
- Result: 39 existing tests passed; the new shell test failed because 700 px remained expanded, and
  the new style test failed because no shared `--selection-radius` token exists.
- Focused GREEN: App shell, topbar, and style tests passed 3 files / 43 tests.
- Implementation derives effective collapse below 760 px, preserves the manual boolean and stored
  preferred width, disables the constrained topbar toggle, hides the resizer, and restores the prior
  manual state on widening.
- Navigation and Discover result-filter buttons now consume `--selection-radius: 7px`.
- Full check passed 57 files / 385 tests with 90.42% statements, 80.80% branches, 93.49%
  functions, and 93.29% lines; formatting, lint, typecheck, architecture, coverage, and all builds
  passed.
- Electron E2E passed 2/2 outside the restricted macOS sandbox. The 200% path asserts effective
  collapse, 84 px sidebar, disabled constrained toggle, hidden resizer, zero horizontal overflow,
  fully contained result heading, and restoration after zoom reset.
- Computed E2E radii for the active Discover navigation button and active `All` result filter are
  both exactly `7px`.
- Accepted screenshots: `02-discover-results.png` (normal), `02a-discover-results-820.png` (normal
  narrow state remains expandable), and `02c-discover-results-200-percent.png` (automatic compact
  sidebar plus matching rounded selections).
- No shared/main/preload/IPC/core/package diff, dependency, secret, network, install, commit, push, or
  live-provider action.
