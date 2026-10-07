# Change Contract: S0 native polish

Scope authority: the user requested the S0 quick fixes from the 2026-09-23 Apple-native UX audit
([report](REPORT.md)) on 2026-09-23. S1-S4 (toolbar, source-list sidebar, keyboard/undo,
toolbar search, Settings window) are out of scope.

## Feature Intake

- User outcome: native list, row and command details behave like standard macOS applications.
- Observed problem/evidence: installed-app screenshots on 2026-09-23 show (1) two-line result titles
  cut without an ellipsis, (2) the Discover status label about 8 px above the adjacent pop-up
  button, (3) Saved's "Open Settings" button stretched across the reader, (4) the raw enum
  `partial` as result status; the View menu has shortcuts only for Discover and Saved.
- Product fit: PRODUCT.md native presentation and the project UI skill (familiarity, hierarchy,
  feedback). No non-goal is touched.
- Alternatives: no change (visible defects remain); per-call-site fixes (the alignment and
  button-width defects are generic layout rules and would recur).
- Cost: small native layout and presenter edits; no dependency, runtime or service cost.
- Boundary changes: one additive `AppCommand` pair (`show-analytics`, `show-sources`) through the
  existing validated command channel. No SQLite, security, network or package change.
- Kill criterion: revert any item whose native smoke evidence shows a layout regression that cannot
  be fixed inside the same generic rule.
- Decision: proceed.

## Capability Contract

- Objective: close the five S0 findings without changing information architecture.
- Goals:
  1. Truncated two-line research-row titles end with an ellipsis; full title stays in tooltip/AX.
  2. In a non-wrapped native row, a label shorter than the row is vertically centered.
  3. In a native column, a standard/primary/quiet button without explicit width uses its intrinsic
     width, leading-aligned. Navigation buttons keep full width.
  4. Discover result status reads as human text with completed/searched source counts, e.g.
     `Partial results · 20 of 22 sources complete · 2026-09-07`. The ISO date is retained.
  5. View menu: Data Analytics `Command-3`, Sources `Command-4`, in native and Web fallback.
- Non-goals: toolbar, sidebar, Settings window, date localization, pagination, progress indicator.
- Interfaces: `APP_COMMANDS` gains two members; the presentation schema is unchanged.
- Evidence semantics: status counts derive only from persisted `sourceOutcomes`; `healthy` and
  `no_results` count as complete; `not_searched` sources are excluded. Titles are never rewritten.
- Failure states: unchanged.
- Migration and rollback: no data migration; revert the commit.
- Allowed scope: `native/appkit/node.mm`, `src/main/appkit/discover.ts`, `src/shared/ipc.ts`,
  `src/main/applicationMenu.ts`, `src/main/appkit/presenter.ts`, `src/renderer/src/App.tsx`,
  their tests, the two AppKit smoke scripts, and this audit directory.
- Persistent writeback: this contract and the report.

## Uncertainty Reducer

- Change class: bug fix (1-4) plus a small menu capability (5).
- Artifact: failing unit tests for TS behavior; failing native smoke assertions for AppKit layout.
- What it does not prove: VoiceOver speech, every screen's visual balance, dark-mode screenshots
  beyond the existing smoke captures.

## Frozen Acceptance Contract

- RED: `applicationMenu.test.ts` (Command-3/4 items), `presenter.commands.test.ts` (native routing),
  `App.shell.test.tsx` (Web routing), `discover.test.ts` (status text), and new
  `smoke-appkit-controls.mjs` assertions (`titleTruncates`, label centering, column button width)
  fail before implementation.
- Full verifier: `npm run check`, `npm run smoke:appkit`.
- Stop condition: all of the above pass and the diff is limited to the allowed scope.

### Acceptance-change log

| Date       | Contract change                                                                                     | Evidence/reason                                 | Reviewer |
| ---------- | --------------------------------------------------------------------------------------------------- | ----------------------------------------------- | -------- |
| 2026-09-23 | `smoke-native-appkit.mjs` status assertion `/completed/` becomes `/^Complete · \d+ of \d+ sources/` | Goal 4 intentionally replaces the raw enum text | user S0  |

## Independent Review

- Product/contract fit: five findings closed; navigation, data and evidence contracts unchanged.
- Accidental scope: none. Pre-existing `AGENTS.md` and `CLAUDE.md` edits were left untouched.
- Test weakening: none; the one replaced assertion is stricter than the old substring match.
- Boundaries: two additive commands pass the existing `isAppCommand` allowlist; no secret,
  SQLite, network or package change.
- Layout rule risk: button widths now follow intrinsic size in every native column (only
  `navigation` buttons span). All 13 runnable workflow groups, including narrow layout and zoom,
  passed with the rule.

## Evidence Closeout

- Changed files: `native/appkit/node.mm`, `src/main/appkit/discover.ts`, `src/main/appkit/presenter.ts`,
  `src/main/applicationMenu.ts`, `src/renderer/src/App.tsx`, `src/shared/ipc.ts`, their tests,
  `scripts/smoke-appkit-controls.mjs`, `scripts/smoke-native-appkit.mjs`.
- Focused RED/GREEN: five RED failures recorded in [verification.json](verification.json); all GREEN.
- `npm run check`: exit 0; 690 main and 105 AppKit tests; coverage above 80% on all axes.
- Native smoke: controls 9/9 groups. Workflow run stopped at step 8 on a pre-existing aged fixture
  (published 2026-08-14, outside the 2026-08-24..2026-09-23 window); with only that step
  disabled in a disposable copy, 13/13 groups passed. The fixture fix is a separate task.
- Rendered evidence: native `inspect` frames only. Window screenshots were unavailable because the
  display was in a full-screen Space.
- Not run: package/install, VoiceOver, live providers/sources.
- Rollback: revert the S0 commit; no data migration.
- Git/install/push: uncommitted working-tree changes; installed app not updated.
