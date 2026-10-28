# Native smoke per-group time limit (2026-10-27)

Scope: the user asked for a per-group timeout with diagnostics in the native smoke, after the
second CI hang. Change class: bug fix in test tooling (a hang that hides its cause). No product
code changes. The cause of the hang is not fixed here; this change makes the next occurrence
fail fast and leave evidence.

## Problem

`scripts/smoke-native-appkit.mjs` runs 16 workflow groups. Its polling loops are bounded, but a
single call into the Electron main process (`application.evaluate`) has no limit. If that call
does not return, the group waits until the CI `desktop` job reaches its 30-minute limit. The
job is then cancelled, the failure handler does not run, and no diagnostics remain.

## Evidence

- PR #68, first run: the packaged smoke stopped in group 14 ("Dirty marked-text close guard and
  native window recreation preserve data/preferences") and was cancelled after 30 minutes.
- PR #71, run 40515958626 (2026-10-27): "Complete AppKit behavior" passed all 16 groups at
  13:55:53 UTC. In "Packaged app smoke", group 13 passed at 13:57:31 UTC and group 14 never
  finished; the step was cancelled at 14:24:15 UTC.
- The same group passed on the #68 reruns and on #69, #70, #72, #73, #74 and `main`.
- Group durations: the longest local group (screenshots on) took 12.2 s; the longest CI group
  (screenshots off) took about 15 s. A 120 s limit leaves at least eight times that margin.
- Earlier, the window-recreation groups also produced the Chromium `task_policy_set ... invalid
destination port` lines (see the
  [E2E timeout notes](../2026-10-27-e2e-desktop-timeout/NOTES.md)). This is a hint, not a cause.

## Change

- `scripts/native-smoke-step.mjs`:
  - `nativeSmokeStepTimeoutMs` (default 120 s; `THERSS_NATIVE_STEP_TIMEOUT_MS` accepts only a
    positive whole number);
  - `runStepWithDeadline` (fails the group by name and collects diagnostics once);
  - `withDeadline` (bounds a cleanup call);
  - `createPendingCallTracker` (records main-process calls that have not returned).
- `smoke-native-appkit.mjs`:
  - every `application.evaluate` call is tracked; a label keeps the function source and only the
    fixture control id and action, never fixture values;
  - at the limit, `timeout.json` records the group, pending calls, the stderr tail and the window
    state if `inspect` answers within 5 s, and `/usr/bin/sample` writes
    `timeout-main-sample.txt`;
  - failure capture (15 s), fixture dialogs (5 s), dialog cleanup (15 s) and `application.close`
    (15 s) are bounded; if the app does not close, the script stops it with `SIGKILL`;
  - group 14 now says that a changed marked-text value may come from external keyboard input
    (a local run on 2026-10-27 read `bi` while the Mac was in use).
- CI already uploads `test-results` on failure, which holds both evidence directories.

## Verification

- RED: `nativeSmokeStep.test.ts` failed before the module existed. GREEN: 16 tests pass (default
  and invalid settings, success, pass-through failure, timeout, failed diagnostics, bounded
  cleanup, pending-call tracking and label bounds).
- Fault injection (temporary script, not committed), behavior-only, Apple M3 Max:
  - a first group that keeps the main process busy for 120 s, limit 5 s: the group failed by
    name at 5002 ms; `timeout.json` named the busy call; `inspect` gave up after 5 s; the sample
    showed `CrBrowserMain` in V8; failure capture and cleanup gave up; `application.close`
    gave up after 15 s and the app process was stopped. The script exited 1 after 64 s and left
    no process;
  - limit 5 s with no injection: "Native reading, Save, full analysis and search details sheet"
    (about 9 s locally) failed by name after 5 s with the same evidence files, exit 1 after 16 s.
- Normal run, default limit, behavior-only: 16 groups passed in 37 s, no timeout file.
- `npm run check`: exit 0; 786 main and 162 AppKit tests pass (the 16 new tests included);
  coverage unchanged. CI `desktop` runs the script twice (source and packaged app).
