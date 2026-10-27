# Web E2E time budget and phase steps (2026-10-27)

Scope: the user asked to give `e2e/desktop.spec.ts` its own 90 s limit and to mark its phases
with `test.step` (options A and B of the 2026-10-27 timing analysis). Change class: bug fix
(intermittent CI timeout) plus a mechanical test refactor. No product code changes.

## Problem

On PR #64, CI `desktop` failed once: `Discover-first search across every deployed source` hit the
45 s Playwright limit (run 40347208346, attempt 1). The rerun passed in 44.5 s.

## Evidence

- Same dependencies, different CI runs: `1dd9b07` 34.5 s, `6a02013` 37.3 s, `08b2559` 45.0 s
  (timeout) and 44.5 s, `main` `6b4b480` 23.7 s. Earlier runs with the older React took
  26.7-38.2 s. The duration depends on the runner, not on the #64 dependency update.
- Local, Apple M3 Max, three runs each: `148ede4` (before #64) 22.1/19.7/19.5 s; `6b4b480`
  (after #64) 21.8/19.5/19.6 s. A per-line trace comparison found no step slower by more than
  64 ms.
- The CI failure trace against the local traces: the 28 screenshots took 11.5 s instead of
  2.2 s, and the Electron launch plus the first window took 6.6 s instead of 0.8 s. The fixed
  Discover fixture waits (lines 268 and 669 before this change) took about the same time in both.
- The earlier `desktop.spec.ts:715` failures on old Dependabot branches (2026-10-10, 10-17,
  10-24) had a different cause: fixed fixture dates aged out of the Sources 30-day window. PR #58
  dates the fixtures from the run clock.

## Change

- `test.setTimeout(90_000)` for this test only, with the observed CI range in a comment. Every
  assertion keeps its own 5-10 s timeout, so a hang still fails at the assertion that waits.
- Eleven `test.step` phases, so the HTML/JSON report shows each phase's duration.
- Ten locators that more than one phase uses are declared once before the first step.
  Playwright locators query the page only when used, so the order of declaration does not
  change behaviour.
- Invariant check: `git diff -w` shows only the timeout, the moved declarations, the step
  wrappers and Prettier line breaks. Counts before and after are equal: 186 `expect(`,
  3 `expect.poll(`, 38 `.click(`, 23 `toHaveCount(`, 12 `waitForTimeout(`, 28 screenshots.

## Verification

- `tsc --noEmit`, `eslint` and `prettier --check` on the spec: exit 0.
- Local, Apple M3 Max, after `npm run build`: three runs of `e2e/desktop.spec.ts` passed in
  22.1, 19.4 and 19.6 s with `timeout=90000`. The JSON report lists the eleven steps. The two
  slowest are the phases that wait for a fixture Discover run: results/promotion/analysis
  (5.6-5.8 s) and personalized Discover (6.0-6.1 s).
- `npm run check`: 769 main and 162 AppKit tests pass; coverage unchanged.
- CI `desktop` on the PR is the authoritative runner check.

## Follow-up: packaged native smoke stderr (Auto-fix, run 40486411381)

- On this PR, CI `desktop` passed the Web flow in 42.0 s and all 16 packaged native workflow
  groups, then `smoke-native-appkit.mjs:1631` failed: stderr held three Chromium lines
  `task_policy_set TASK_(CATEGORY|SUPPRESSION)_POLICY: (ipc/send) invalid destination port
(0x10000003)`.
- `scripts/native-smoke-diagnostics.mjs` already classified the same process-priority call with
  `(os/kern) invalid argument (4)` as a platform diagnostic observed during window recreation.
  The new lines have the dead-port result and their timestamps fall in the Settings-window and
  window-recreation groups.
- Fix: the classifier also accepts this one exact dead-port text. A RED/GREEN test uses the CI
  lines; a different port code, a different kernel error, a spoofed prefix or an added suffix
  still count as application errors.

## Not changed

- The global `timeout: 45_000` in `playwright.config.ts` and every other spec.
- The number and content of the screenshots (option D was not chosen).
- Splitting the test into separate tests (option C) remains a possible later change.
