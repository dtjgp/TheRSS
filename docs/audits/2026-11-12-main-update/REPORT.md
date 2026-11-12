# Consolidated delivery verification

2026-11-12. The user authorized merging the completed work into main and updating the local app.
The source baseline is origin/main f79e7c9. All earlier feature reports are historical evidence;
this directory owns the combined delivery results.

## Included work

- I2 Daily Papers local empty-state explanations and refresh semantics.
- I1 native local-search wording; I4 SQL-level local-search scopes and truthful truncation.
- My sources defaults and per-search drafts, Native and Web persistence/focus/save guards,
  and cancel-on-background for the native per-search popover.
- Failure-only Web sidebar diagnostics, cross-reload timing, correlation-checked trace retention,
  and Node-only reporter regression. Historical Web sidebar intermittency is still unexplained.
- Native sidebar restoration after later automatic layout adjustments, with two scroller-mode
  regressions. This is a separate native defect from the historical Web intermittency.
- Manager proposals, implementation reviews and cancellation records. Both sidebar contracts are
  retained. VoiceOver-specific additions remain removed, and no VoiceOver test was run.
- Upstream NCPSD issue-number/no-results status repair already merged in origin/main.

## Current checks

| Check                        | Result                                                                            |
| ---------------------------- | --------------------------------------------------------------------------------- |
| Combined npm run check       | Exit 0; 957 main tests and 228 overlapping AppKit tests                           |
| Main coverage                | Statements 92.11%, branches 83.99%, functions 95.37%, lines 94.61%                |
| AppKit coverage              | Statements 90.31%, branches 85.07%, functions 87.72%, lines 92.59%                |
| Full Electron E2E            | Exit 0; 11/11, including both native sidebar cases                                |
| Node reporter probe          | Exit 0; 2/2                                                                       |
| Native AppKit acceptance     | Exit 0; 17 workflow groups, with current screenshots                              |
| Native component acceptance  | Exit 0; 20 groups                                                                 |
| npm audit --audit-level=high | Exit 0; 0 high/critical, 16 moderate and 1 low                                    |
| Unsigned arm64 package       | Exit 0; signing discovery explicitly disabled                                     |
| Packaged smoke               | In progress at this source commit; delivery addendum records final state          |
| Diff/secret review           | No critical/high finding; diff whitespace clean; scoped secret-pattern scan clean |

The initial combined check stopped at formatting in five old proposal files. Prettier corrected
only their layout, and the full check then passed. The native popover comment now matches the
accepted background-cancel behavior. No assertion, tolerance, retry, or CI job was weakened.
Native builds retain two pre-existing shadow-variable warnings in host.mm.

## Delivery and rollback

Remote CI, merge, installation and installed-app checks follow this source commit. No release
is published. The installer retains the previous application and makes an online SQLite backup,
then validates complete bundle fingerprints and database integrity. Restore that exact app/database
pair together if rollback is required.

The existing database passed integrity_check before replacement. Its aggregate table counts were
captured under ignored test-results/main-update/ for the post-start comparison. No user content,
credentials, real-vault mutation or live research request is included in delivery evidence.

Command logs are /tmp/therss-main-update-{combined-check,e2e,reporter,appkit,package,package-smoke}.log
and /tmp/therss-main-update-audit.json. Native screenshots are in ignored test-results/appkit-native/.
