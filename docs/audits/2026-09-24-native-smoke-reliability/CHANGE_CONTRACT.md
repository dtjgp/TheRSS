# Change Contract: native smoke reliability

Scope authority: on 2026-09-24 the user asked to commit the title removal and "开始修测试可靠性"
after the [UX audit](../2026-09-23-apple-native-ux/REPORT.md) follow-up analysis.

## Feature Intake

- User outcome: `npm run smoke:appkit` gives a trustworthy pass/fail on this machine, with and
  without screenshots, including the Sources step.
- Observed problems (2026-09-23/24 runs):
  1. Sources step always fails: the configured-source fixture is dated 2026-08-14, outside the
     rolling 30-day window computed from the real clock.
  2. Intermittent: personal prompt read `''` after window recreation (1 of 3 runs).
  3. Intermittent: query value gained a trailing space (1 of 5 runs).
  4. The controls smoke failed to capture its window with screenshots enabled (S0 run 1).
- Root causes (from code, before changes):
  1. `getSourceContentSnapshot(source, now = new Date())` vs a fixed fixture date.
  2. `navigate()` renders Settings before its async `load()`; the smoke waited for the node to
     exist, not for the loaded (editable) state. Product behaviour is correct (field disabled).
  3. `capture()` steals application focus; on becoming key the host's `ensureNativeFocus` puts
     the caret in `discover-query`, so any real keystroke on the shared desktop lands in the
     fixture. Mechanism confirmed in code; the keystroke itself is not provable.
  4. Not yet reproduced; verify first.
- Product fit: verification infrastructure only; no product behaviour change.
- Kill criterion: stop if a fix requires weakening an assertion or changing product behaviour.

## Capability Contract

- R1: in E2E fixture mode only, the configured-source refresh fixture is published relative to
  the run clock (inside the 30-day window). Shared fixture objects and Discover fixtures keep
  their fixed dates.
- R2: smoke waits for Settings fields to be editable before reading or filling them after a
  fresh Settings screen.
- R3: `capture()` verifies the window is focused before capturing, parks first-responder focus
  away from text inputs during the capture, restores the previous focus owner afterwards, and
  fails with an explicit "external keyboard input reached the fixture" error if any text-input
  value changed during the capture.
- R4: controls smoke screenshots work with screenshots enabled.
- R5: fixture `click`/`key` on a disabled control fail with "Fixture control is disabled"
  instead of being silently ignored; smoke presses retry only that precondition.
- Non-goals: changing screenshot defaults, CI configuration, product focus behaviour.
- Allowed scope: `src/main/e2eFixtures.ts`, `src/main/index.ts` (fixture wiring only), a unit
  test for the fixture helper, `native/appkit/bridge.mm` (fixture-only action), the AppKit smoke
  scripts, this directory.

## Frozen Acceptance Contract

- RED: unit test for the relative fixture date; the unmodified Sources smoke step failing today
  (already observed).
- Verifier: `npm run check`; workflow smoke with **all** steps (no disabled step) passing 3
  consecutive runs with screenshots and 2 without; controls smoke passing with screenshots.
- Stop condition: verifier passes and no assertion was weakened.

### Acceptance-change log

| Date       | Contract change                                                                                                                                         | Evidence/reason                                                                                                                                 | Reviewer              |
| ---------- | ------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------- | --------------------- |
| 2026-09-24 | R3 revised: `capture()` no longer activates the app (showInactive + moveTop); it records `keyWindow`/`appActive` per capture instead of requiring focus | First verifier: 3/3 screenshot runs failed the focus requirement (sheets are key; macOS 14+ cooperative activation refuses to steal activation) | user reliability task |
| 2026-09-24 | R5 added: press helpers retry on explicit disabled-control errors                                                                                       | First verifier plain-2: update button press ignored while an async candidate reload disabled it                                                 | user reliability task |

## Verifier log

1. First verifier (R1-R3 as initially designed): screenshot runs 0/3 (focus requirement),
   plain runs 1/2 (plain-2 failed at `saved-source-update-status`: press ignored while the
   update button was disabled by an asynchronous reload).
2. Second verifier (R3 revised, R5 added): 4 of 5 runs passed all 14 groups. `shots-1` failed at
   `saved-source-update-status` with the button enabled and `firstResponder` empty: the space
   key went to another responder because the button was not first responder. The fixture `key`
   action now fails with a diagnostic when its target does not take keyboard focus.
3. Third verifier: 0 of 3; every run stopped at the new diagnostic on an `NSTextField` (step 9),
   whose focus is held by its field editor. Defect in the diagnostic itself, corrected.
4. Final verifier (current build): screenshot runs 3/3 and plain runs 2/2, each 14/14 groups with
   no disabled step; controls smoke with screenshots 9/9; `npm run check` exit 0 (694 main,
   107 AppKit tests). Evidence: git-ignored `test-results/2026-09-24-reliability-v4`.

## Independent Review

- Assertions: none weakened. Settings waits require the loaded state; press helpers retry only
  on the explicit disabled-control error; every other fixture error still fails the run.
- Scope amendment: `native/appkit/host.mm` gained inspection-only `keyWindow`/`appActive` fields
  used by `capture()` (not in the original allowed scope; diagnostic only, no product path).
- Product behaviour: unchanged. Fixture-only bridge actions remain refused outside
  `THERSS_E2E_FIXTURES=1` hosts; the relative fixture date is used only in fixture mode.
- Residual limits:
  1. The v2 focus refusal (button not first responder) did not recur in 8 later runs; its cause
     is not established. It now fails with a diagnostic instead of silently.
  2. Screenshots no longer activate the app, so they may show inactive window chrome; each
     capture JSON records `keyWindow`/`appActive`. Screenshots are layout evidence, not evidence
     of active-state appearance.
  3. The launched fixture app can still receive keystrokes if it is the active app when the user
     types; `capture()` detects changes only in fields exposed during a capture.
  4. Product observation (not changed): the Saved update button is briefly disabled whenever
     its candidate check reloads.

## Evidence Closeout

- Changed files: `src/main/e2eFixtures.ts`, `src/main/e2eFixtures.test.ts` (new),
  `src/main/index.ts` (fixture wiring), `native/appkit/bridge.mm`, `native/appkit/host.mm`,
  `scripts/smoke-native-appkit.mjs`.
- RED/GREEN: fixture-date unit tests failed (`e2eRecentConfiguredArticle is not a function`) and
  pass; the Sources smoke step failed on every earlier run and passes in all 5 final runs.
- Not run: package/install, CI, live providers/sources.
- Rollback: revert the reliability commit.
- Git/install/push: uncommitted; installed app not updated.
