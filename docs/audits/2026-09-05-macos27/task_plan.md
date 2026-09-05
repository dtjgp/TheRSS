# macOS 27 UI and branch consolidation

## Objective

Integrate every existing branch safely, align every current desktop surface with Apple's macOS 27 design guidance, verify the result, and leave local/remote main as the only branches.

## Scope and authorization

The 2026-09-05 user request authorizes source changes, branch integration, publishing the integrated changes to main, and deleting branches after preservation is verified. No installed-app replacement, GitHub Release, live provider calls, vault writes, or account changes are implied.

## Phases

- [x] Inventory branch preservation and current UI; verify official Apple sources and relevant frontend skills.
- [x] Freeze acceptance and review deterministic visual prototype.
- [x] Integrate branch changes and implement the UI with regression tests.
- [x] Run full checks, desktop/accessibility/visual and package verification; independent review.
- [ ] Publish via protected-main PR gates, verify all branch tips preserved, remove obsolete branches.

## Verifier / stop condition

Full check and Electron E2E pass; light/dark, 820/1360 widths, high zoom, keyboard, reduced transparency/motion, contrast/forced colors verified. Only main remains locally/remotely; local main equals remote SHA. Residual native rendering limits explicitly documented.

## Initial evidence

Clean main f0c3b968; required strict quality + desktop CI, linear history, no force pushes. Official Apple macOS 27 resources confirmed by web search; direct official inspection follows.

## Errors encountered

Sandbox denied .git/FETCH_HEAD write; authorized elevated fetch succeeded.

## Status

Implementation, independent review, current screenshots,433 tests,4 desktop checks, native and packaged smoke completed. Only protected-main publication and verified branch removal remain. Concurrent user changes in AGENTS.md and two project skill files are preserved outside this UI commit.
