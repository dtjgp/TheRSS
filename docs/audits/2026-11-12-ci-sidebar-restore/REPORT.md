# Desktop CI sidebar restoration

The local repair restores the saved sidebar width after later automatic layout adjustments.
GitHub CI has not yet run this repair.

## Failure and cause

The notification matches [run 43247579948](https://github.com/dtjgp/TheRSS/actions/runs/43247579948).
The desktop job failed in `Complete AppKit behavior`. Its widening assertion expected 248 pt
but measured 192 pt in a 1360 pt workspace. Run 42812573623 records the same failure.

`reconcileWindowSplit` retained its last attempt after successfully restoring the width.
A later automatic adjustment could therefore suppress restoration at the same width and target.
The controller does not always issue another layout callback after a successful divider move.

A fixture-only automatic adjustment reproduces this mechanism on the local Mac.
Both scroller modes remained at 184 pt for the five-second assertion budget before the repair.
The exact event ordering on the GitHub runner was not captured.

## Change

- `native/appkit/node.mm`: clear the attempt when the target is reached, including after applying the deferred move.
- `native/appkit/bridge.mm`: add a fixture-only automatic divider adjustment without a user preference event.
- `e2e/native-sidebar-resize.spec.ts`: exercise three narrow/wide cycles and a late adjustment in both scroller modes.
- Preserve the saved 248 pt preference and width event count throughout automatic adjustments.

The regression first waits for the presenter's debounced user preference write.
It then checks persistence after every resize and after the automatic adjustment.
The existing native smoke and CI workflow remain unchanged.

## Verification

Environment: macOS 27.3, arm64, Node 26.13.1, Electron 45.2.3.
Desktop CI uses Node 24; that remote environment still needs verification after delivery.

| Check                                    | Result                                                                                    |
| ---------------------------------------- | ----------------------------------------------------------------------------------------- |
| Focused RED                              | Both scroller modes fail: expected 248, received 184                                      |
| Focused GREEN                            | 2/2 pass                                                                                  |
| `npm run check`                          | Exit 0; architecture, format, lint, types, coverage, AppKit tests, and build pass         |
| Main test coverage                       | 883 tests; 91.93% statements, 83.74% branches, 95.22% functions, 94.50% lines             |
| AppKit coverage                          | 194 overlapping tests; 89.85% statements, 84.59% branches, 87.16% functions, 92.27% lines |
| `npx playwright test`                    | Exit 0; 11/11 pass                                                                        |
| Final E2E formatting and lint            | Exit 0                                                                                    |
| Canonical native smoke with captures     | Affected layout group passes; later keyboard test stops because the app is inactive       |
| Native smoke with explicit local focus   | Exit 0; 17/17 groups pass, legacy scroll bars                                             |
| Native controls smoke                    | Exit 0; 20/20 groups pass, legacy scroll bars                                             |
| Unsigned macOS directory package         | Exit 0 with `CSC_IDENTITY_AUTO_DISCOVERY=false`                                           |
| Packaged smoke with explicit local focus | Exit 0; preload checks and 17/17 native groups pass                                       |
| Final diff review                        | No critical/high findings; `git diff --check` passes                                      |

The initial full E2E run exposed an ordering error in the new test's preference read.
The corrected test waits for the accepted user write before checking preservation.
The subsequent full run passes; no production persistence behavior changed.

## Local focus and rendering evidence

The canonical native runner stops later at `saved-update-source` with `appActive=0` and `keyWindow=false`.
This failure also occurred before the sidebar repair. The affected widening assertion passes.

Ignored local runners add only explicit window activation before that keyboard action.
They preserve the complete assertion set and do not change the shipped smoke scripts.
Their paths are `test-results/ci-sidebar-local-focus.mjs` and `test-results/ci-sidebar-package-focused.mjs`.
These passes do not establish an unmodified full native smoke pass on this shared desktop.

Actual AppKit screenshots were inspected:

- `test-results/ci-sidebar-native/discover-narrow.png`: visible sidebar and compact results, 184 pt divider.
- `test-results/ci-sidebar-native/discover-narrow-zoomed.json`: sidebar remains visible at zoom 1.5, 184 pt divider.
- `test-results/ci-sidebar-native/discover-dark.png`: wide layout restores the divider to 248 pt.

Structured results are in `test-results/ci-sidebar-native-focused/result.json`,
`test-results/ci-sidebar-controls/result.json`, and `test-results/appkit-package/result.json`.
All content and promotion receipts in these runs are fixtures.

The built and packaged `therss-ui.node` files share SHA-256:
`dc76d7ceae1f19c994358b33e726caf4879a441daa6f2f87421d15cbb89f3964`.

Command logs are `/tmp/therss-ci-sidebar-check.log`, `/tmp/therss-ci-sidebar-e2e.log`,
`/tmp/therss-sidebar-focused-red.log`, `/tmp/therss-sidebar-focused-green.log`,
`/tmp/therss-ci-sidebar-native.log`, `/tmp/therss-ci-sidebar-native-focused.log`,
`/tmp/therss-ci-sidebar-controls.log`, `/tmp/therss-ci-sidebar-package.log`,
and `/tmp/therss-ci-sidebar-package-smoke.log`.

## Scope and delivery

The initial checkout was clean at `fa589b8` on `fix/ncpssd-issue-number-status`.
The repair changes only native layout, its fixture action, regression tests, and this audit.
The database, credentials, source adapters, vault, dependencies, installed app, and CI checks remain unchanged.

No commit, push, PR, install, or release occurred. Remote CI needs an authorized delivery.
Rollback requires reverting the scoped files; no migration or data rollback is needed.
