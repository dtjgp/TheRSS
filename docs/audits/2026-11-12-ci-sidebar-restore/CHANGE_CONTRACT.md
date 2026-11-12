# CI sidebar restoration repair

## Feature Intake

- User outcome: repair the failed desktop CI job shown in the notification.
- Evidence: run 43247579948, job 131284281627, fails at the native widening assertion:
  expected 248 pt, actual 192 pt, workspace 1360 pt. Run 42812573623 has the same failure.
  Build, all nine Electron cases, and quality passed in the latest failed run.
- Product fit: preserve the user's sidebar width through narrow/wide window transitions.
- Alternatives: rerunning alone leaves the repeated defect unexplained; weakening the width
  assertion would lose the existing behavior contract.
- Cost: local engineering and disposable fixture windows; no dependencies or external service.
- Boundaries: native presentation and its acceptance harness only.
- Kill criterion: stop expansion if the fix requires unrelated product or storage changes.
- Decision: proceed with a bug fix.

## Capability Contract

- Objective: restore the saved sidebar width after narrow/zoomed layouts and repeated resizing.
- Goals: retain width preferences, native controls, collapse behavior, and existing CI gates.
- Non-goals: redesign, source adapters, credentials, vault writes, install, push, or publication.
- Invariants: widths are unscaled points; only a user divider action changes the preference.
- Data ownership: existing native-ui.json remains unchanged by automatic resize reconciliation.
- Failure states: report actual divider, target, and workspace width on assertion failure.
- Migration/rollback: no migration; revert the scoped presentation/harness changes.
- Allowed scope: native/appkit sidebar reconciliation, a focused native regression, existing
  smoke assertions only if evidence proves their timing contract incorrect, and this audit.
- Persistent writeback: this contract and a concise evidence report.

## Uncertainty Reducer

- Change class: bug fix.
- Artifact: repeated CI failure logs, then a disposable native reproduction.
- Question: does AppKit retain an obsolete constrained width, or does inspection precede layout?
- Replay a late AppKit constraints pass with a fixture-only automatic divider adjustment after
  restoration. The replay must preserve the preference and width event count.
- Limit: fixtures do not establish live research, model, or vault behavior.

## Frozen Acceptance Contract

- RED: reproduce the 248/192 mismatch or deterministically exercise the reconciliation sequence
  that loses the restored width; preserve the original widening assertion.
- Focused cases: saved width 248, narrow clamp, widening, repeated narrow/wide cycles,
  zoom changes, collapse/show, unchanged persisted preference and no automatic width events.
- E2E: existing nine Electron cases and both Complete AppKit behavior scripts.
- Rendering: capture and inspect the affected native wide/narrow state when product code changes.
- Accessibility: preserve keyboard and Reduce Motion behavior; no new controls or text.
- Security/dependencies/migration: no changes.
- Package: run affected desktop gates through unsigned packaging and package smoke if feasible.
- Full verifier: npm run check; native smoke under CI options, including legacy scroll bars.
- Stop: regression and required checks pass, diff reviewed, unrun remote checks stated.

## Implementation Slices

1. Reproduce and inspect native split geometry and reconciliation state.
2. Add a focused native regression; implement the smallest verified repair.
3. Run focused and full gates, inspect rendering, and review the final diff.

## UI adaptation

- Keep the accepted 3/2/7 design and all existing controls.
- Adopt spatial consistency and native layout; adapt verification to disposable AppKit windows.
- Reject new styling, animation, dependencies, and relaxed width assertions.
- No new taste or product decision is needed.

## Acceptance-change log

The timing replay strengthens the existing restoration requirement; no assertion is relaxed.

During the full E2E run, the new test read the initial 224 pt preference before the user's
248 pt write completed. The presenter deliberately schedules persistence in persistSoon().
Wait for that initial write before testing that automatic resizes preserve it. Keep every
post-resize persistence assertion unchanged. This corrects the test's ordering assumption.

## Independent Review

- Separate final diff pass completed in the main session.
- Product fit: preserve the existing sidebar width contract and native layout.
- Complexity: clear the completed reconciliation record; keep unresolved-target retry suppression.
- Tests: automatic adjustment replay is fixture-only; all previous assertions remain unchanged.
- Boundaries: no SQLite, IPC, secret, dependency, network, or product API changes.
- Local focus limitation: preserve the canonical smoke; use an ignored local runner for the
  keyboard-focus precondition. Record its result separately from the canonical invocation.
- No critical or high findings remain in the scoped diff.

## Evidence Closeout

- Focused RED: both scroller modes retained 184 pt instead of restoring 248 pt after automatic adjustment.
- Focused GREEN: both cases pass; the final full Electron suite passes 11/11.
- Full check: exit 0, 883 main tests and 194 overlapping AppKit tests; all coverage thresholds pass.
- Native: the original runner passed the affected layout group, then failed at an unrelated
  keyboard-focus precondition. With explicit local window activation, all 17 groups pass.
- Controls: 20 native groups pass with legacy scroll bars.
- Rendering: inspect wide dark and minimum-width light screenshots; geometry confirms 248/184 pt.
- Package: unsigned arm64 build passes; packaged preload and 17 native groups pass with the same local focus precondition.
- Security/migration: no boundary or schema changes; fixture replay remains gated by fixture mode.
- Rollback: revert the scoped native and E2E files; no data rollback is required.
- Git/install/publication: uncommitted local changes; no push, PR, install, or release.
- Remote CI remains unverified until an authorized push. See [REPORT.md](REPORT.md) for commands and limitations.
