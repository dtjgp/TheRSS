# Engineer change contract: sidebar diagnosis (controlled phase)

Authority: Manager `docs/audits/2026-11-12-sidebar-voiceover/CHANGE_CONTRACT.md` (the canonical contract in this directory) and the dispatch of 2026-11-12 after the first VoiceOver phase released the desktop.
All earlier uncommitted I2/I1/I4/My sources changes are kept ([BASELINE_STATUS.txt](BASELINE_STATUS.txt)).

## Scope of this phase

- A cross-reload event recorder and diagnosis harness under `harness/` (not part of the normal
  E2E, whose `testDir` is `e2e/`).
- In-process mechanism checks for H-A, H-B1 and H-B2, with no System Events, osascript or
  system-wide input and no activation of another app.
- At most five quit+sidebar runs, plus a bounded full-order run for the evidence gap.
- A product or test change only after evidence for the historical trigger. Original width and
  persistence assertions, timeouts and retries stay unchanged.

## Decision

The historical trigger was not observed: 5 recorded quit+sidebar runs and 2 recorded full-order
runs all passed with identical event sequences. The mechanism checks falsified H-A as stated
(window blur does not cancel a drag) and showed that H-B2 produces a different signature from
the 304 failure. H-B1 is mechanically possible, but its source was not observed. Without
evidence, no product or test code was changed.

## Rollback

This phase adds only files under this task directory. Delete them to roll back.

## Failure-diagnostics phase (2026-11-12)

Authorized by the updated Manager contract (failure diagnostics in the real sidebar spec, no
new user approval needed). Scope: `e2e/support/sidebarDiagnostics.ts`, the real spec, and a
controlled failure probe in `e2e/probes/` that is outside the suite's test match. No product,
assertion, expectation, tolerance, retry or order change. Rollback: remove the support module,
the probe directory, and the diagnostics lines in the spec (`git diff e2e/sidebar-resize.spec.ts`).

## Review round 1 closeout (2026-11-12, task_8908ea649508)

Authority: the Manager dispatch for `REVIEW.md` items 1–3. A minimal Playwright config change and a
custom reporter are allowed. No product, assertion, expectation, tolerance, retry or order change.
No new dependency or CI change.

- Trace retention: `e2e/support/sidebarTraceArchiveReporter.ts` is registered in
  `playwright.config.ts` and in the probe config. In `onTestEnd`, it copies the actual `trace`
  attachment of a result that has a `sidebar-diagnostics` attachment into
  `test-results/sidebar-diagnostics/<stamp>-<id8>/trace.zip`. The match uses the record's
  `correlationId`. The reporter writes `trace-archive.json` with the copy status. It does not
  overwrite files, does not throw and does not change a result.
- Observer start: the recorder has a stop flag and clears its 50 ms retry timer. `dispose` also
  removes the init script and the binding.
- Timing and identity: renderer events carry `event.timeStamp` (or `performance.now`) and the
  document `performance.timeOrigin`, separate from the Node receive time. `code.files` holds
  SHA-256 content hashes of the sidebar code, the spec, the helpers, the config and
  `package-lock.json`. Error stack paths are made relative.
- Verifier: RED with the fix disabled, then 3 GREEN probe runs (exit 1 from the intentional
  failure only). `harness/verify-trace-archive.mjs` checks correlation, the copy hash and zip
  readability. Earlier files must not change. Then `npm run check` and one full E2E.
- Rollback: remove the reporter, its two config entries and the probe changes. Restore the
  previous `e2e/support/sidebarDiagnostics.ts`.

## Review round 2 increment (2026-11-12, task_5e69a1da2875)

- Gap: the archive reporter continued to copy when the target record had a different
  `correlationId`. It wrote a trace and a wrong-ID status into another test's record directory,
  and those no-overwrite files then blocked the correct archive.
- Change: on a mismatch, the reporter returns before it writes any file. It prints one rejection
  line to stderr. Results and the exit code do not change.
- Verifier: `e2e/probes/sidebarTraceArchiveReporter.probe.ts`, Node only (no Electron, browser or
  GUI). It is RED with the previous reporter and GREEN twice with the fix. The checks
  `format:check`, `lint`, `typecheck` and `check:architecture` must pass. The full GUI gates wait
  until the VoiceOver session ends.
