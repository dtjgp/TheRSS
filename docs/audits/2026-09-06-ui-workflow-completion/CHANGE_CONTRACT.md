# Native workflow completion and delivery

## Feature Intake

- User outcome: complete all three proposed UI improvements, update the installed local application and synchronize the finished work to GitHub.
- Explicit authority: the user annotated the previous proposal (compact completed search, source grouping, real-history trends, installation and GitHub) with “完成所有的这些事情”. This authorizes implementation, reversible installation and the repository PR/merge flow. A new GitHub Release or live source/model/vault execution is outside this scope.
- Current evidence: the completed UI-craft audit and current AppKit code. Discover still leaves the editor open after results; 22 source checkboxes form an ungrouped list; Analytics already receives seven local-date points from SQLite but only shows daily table rows.
- Product fit: faster research scanning and inspectable local history, using existing native controls, service APIs and persisted evidence.
- Alternatives: retain the current UI, add a large chart dependency, or build a bounded native chart and reuse existing data. Choose existing AppKit with no dependency, schema migration or network call.
- Kill criterion: any change that hides draft/result differences, conflates counts with unique papers or live source health, drops a retained source, loses editing/selection, or bypasses a release gate.

## Capability Contract

- Compact search: restored sessions and completed/partial searches with results show a compact query summary. Edit search restores the exact draft and native focus. Done editing may hide controls without submitting; draft changes remain explicit alongside the persisted result intent. Failed, canceled and empty searches keep editable recovery. Cancel and retry remain reachable.
- Source groups: one source-owned mapping partitions all 22 retained IDs into papers, code/models, research organizations, technology/community and business/policy. Discover has group headings, exact selected counts and select/clear group actions. Sources uses the same group filter without network retrieval on filter changes.
- Trends: a native bar chart uses only existing `AnalyticsSnapshot.daily` values. Separate selectable series for Discover records, legacy Today records and deep analyses; raw daily values remain inspectable. Zero/empty history is explicit; no invented interpolation, unique-item claim, performance percentage or backfill.
- Interfaces: bounded native chart points and optional label line limit; internal focus request only. Public window services, SQLite and source adapters remain unchanged.
- Scope: the prior UI-craft changes plus affected native presenters/rendering, shared source grouping, tests, product docs, test harness and publication-ready audit evidence.
- Migration/rollback: no data migration; reversible app/database backups through existing installer. Code rollback is the exact task diff.
- Durable writeback: this contract and closeout, task plan and relevant product behavior text. Existing audit remains historical, with its later delivery status linked here.

## Uncertainty Reducer and Frozen Acceptance

- Fixture-backed native iteration proves compact header/edit focus, grouped picker at narrow/wide widths and chart geometry before final integration/release. It uses the existing isolated acceptance host and deterministic SQLite fixtures.
- RED: tests for restored/finished compact state, editing/draft truth, failed/canceled recovery, exact group partition and group selection, per-series chart values, no-activity state and raw value disclosure must fail on current code.
- Native chart: start at zero; preserve raw values; scale by the selected series; expose label/unit/date/value to accessibility; handle all-zero data without positive bars. Native screenshot/data geometry assertions supplement schema tests.
- Existing source, cancellation/retry, IME, secure drafts, native dialogs, selection, source focus vs activation, reading/provenance and save/undo tests remain intact. Tests that operate an auto-collapsed editor must explicitly reopen it; that is an accepted interaction change, not weakened behavior.
- Verifiers: focused RED/GREEN, `npm run check`, full compatibility E2E, native workflow/control gates with current screenshots, dependency audit, unsigned package and packaged/installed smoke, backup integrity and installed/package hash equality.
- Layout matrix: 1360×880, 820×720 and 820×600 at zoom 1/1.5; light/dark, increased contrast/reduced transparency; keyboard focus and scroll checks.
- Independent review: separate read-only diff review after implementation; resolve actionable findings before commit/install/push.
- Publication: inspect final diff, exact-path staging, Conventional Commit, branch/PR to protected main, wait for required CI, merge and verify local/remote equality. Publish fixture captures only; local user-data captures stay local.
- Stop condition: three features are verified, installed application and database preservation are verified, GitHub main contains the finished change and final status is clean, or a concrete external blocker is reported with all unaffected work complete.

## Execution and Closeout

Implementation, verification, installation and GitHub evidence will be recorded here as each gate completes.

- Initial RED: five focused behavior tests failed for absent compact state, group controls, trend points and empty-history state. Minimal GREEN: seven affected tests passed; the group-partition test covers all 22 IDs.
- Existing tests now explicitly reopen auto-collapsed query controls, preserving all previous cancellation, retry and input assertions.
- Native iteration: the first complete 12-group fixture run passed. Captures confirmed compact reading space, five source sections, real daily bars and visible raw values. Native focus returns to the query after Edit search and to the results after completion.
- A fixed-height table was previously treated as flexible because Objective-C treated the stored numeric zero as present. Layout now treats only positive flex values as flexible. Actual raw-table height is asserted, so values cannot silently occupy zero height.
- Initial full check: 562 main tests and 68 native tests passed with all four coverage dimensions above 80%; architecture, formatting, lint, types and builds passed. Dependency audit: zero vulnerabilities.
- Final native geometry tests additionally check zero-bar height, proportional 10/20 bars and complete accessible text behind compact labels. Fixture appearance is set locally for deterministic light/dark captures, without changing system preferences.
- Independent read-only diff review completed. Chart fill now resolves contrast against the actual panel background; native theme tests are process-local and assert effective appearance. No unresolved actionable findings remain.
- Final full check passed: 83 files / 562 main tests and 16 files / 68 native tests, architecture/format/lint/types/coverage/build all passed. Full desktop E2E: 6/6. Native workflows: 12/12. Native controls including proportional-chart and label checks: 6/6.
- Unsigned packaging and packaged default-native/compatibility smoke passed. The application was installed with a completed receipt at 2026-09-06T18:57:27.998Z, retaining the previous app and online database backup. Installed smoke passed, including the same 12 native workflow groups.
- Installation integrity: package/installed app.asar and both native-module SHA-256 values match; backup and live databases pass integrity checks and retain equal record counts. Public evidence is in `install-verification.json`; personal-data captures stay local and are ignored by Git.
- [Delivery summary and fixture screenshots](DELIVERY.md) records the result. GitHub synchronization proceeds through `codex/native-ui-workflow`, with required `quality` and `desktop` checks and final main equality verified by the coordinating task.

### CI diagnostic classification correction

PR #48's first desktop run passed all 12 packaged native workflow groups, then failed the final
stderr assertion on two Chromium macOS process-priority diagnostics: `TASK_CATEGORY_POLICY` and
`TASK_SUPPRESSION_POLICY`, both reporting kernel invalid argument (4) during window recreation.
The [upstream implementation](https://raw.githubusercontent.com/chromium/chromium/main/base/process/process_mac.cc)
locates these in process-priority/App Nap handling, separately from application actions. This is
not proof that arbitrary stderr is harmless.

Accepted verifier correction: classify only these exact source/message/error-code combinations
as retained platform diagnostics, alongside the already recognized input-method wake-up message.
Assemble stderr chunks before splitting lines so an unrelated error in the same chunk still fails.
Tests must reject unknown messages, other kernel codes and mixed application failures. Keep all
original stderr in the receipt and fail on every unclassified line; no behavioral assertion is removed.

Correction verification: four focused tests passed after RED, the full check passed 84 main test
files / 566 tests plus 68 native tests, and the installed package passed all 12 native workflow
groups in CI-style no-screenshot mode. A separate reviewer checked exact anchoring, split chunks,
mixed fatal lines and unknown variants with no remaining finding. Application binaries are unchanged.
