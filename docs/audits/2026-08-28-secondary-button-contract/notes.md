# Notes: Secondary Button Contract

## Baseline Evidence

- Four `.secondary-button` usages exist.
- Zero `.secondary-button` CSS definitions exist.
- Current screenshots show browser/platform-default Cancel geometry, especially ambiguous in dark mode.

## RED/GREEN Evidence

- RED: `styles.test.ts` failed 1/22 because `.secondary-button` was undefined; 21 existing tests
  remained green.
- GREEN: the same focused file passed 22/22 after adding the scoped semantic CSS rule family.
- No component caller or event behavior changed.

## Verification Evidence

- `npm run check`: passed 61 files / 410 tests with 90.29% statements, 80.15% branches,
  93.64% functions, and 93.20% lines; formatting, lint, types, architecture, coverage, and builds
  passed.
- Build-first Electron E2E: 2/2 passed.
- Computed Electron contract: active Cancel is visible, enabled, 7px radius, pointer cursor, and
  opacity 1.
- Fresh light/dark/forced-colors screenshots show a coherent secondary action; Settings Test
  connection inherits the same geometry and the global focus-visible outline.
- `git diff --check` and scoped secret/debug/HTML scan passed.
- No package, dependency, data, storage, IPC, source, provider, app install, commit, push, or
  publication change.
