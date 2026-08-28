# TheRSS Change Contract: Settings Density Prototype

## Feature Intake

- User outcome: Settings exposes useful controls sooner while retaining native clarity and trust.
- Observed problem/evidence: large top padding/H1 plus repeated meta-labels consume the first viewport before the form.
- Product fit and relevant non-goal: improves a local expert workflow; does not turn Settings into a dashboard, marketing page, or new information architecture.
- Alternatives considered, including no change: retain current; compact page/panel hierarchy; remove the page header entirely. Compare current with the bounded compact option first.
- Cost: one static interactive prototype and screenshot matrix; zero runtime/dependency cost.
- Boundary changes: none; production code remains frozen.
- Kill criterion: reject compact mode if orientation, privacy guidance, tab clarity, keyboard path, narrow layout, or contrast regresses.
- Decision: prototype before implementation.

## Capability Contract

- Objective: test whether a smaller page-title band and removal of generic duplicate eyebrows improve first-viewport density.
- Goals: earlier workspace start, preserved hierarchy, unchanged fields/actions/copy, responsive tabs, and system appearances.
- Non-goals: production edits, field reordering, copy rewrite, provider behavior, new navigation, imagery, motion library, or F7/F8/F5.
- Interfaces and public API invariants: all Settings roles, names, field order, actions, and dirty-state semantics are represented unchanged.
- Data ownership and evidence semantics: fixture copy mirrors current product text; no network/data operation exists.
- Failure states: orientation loss, hidden privacy copy, button overflow, inaccessible tabs, horizontal overflow, or poor forced-colors boundaries.
- Migration and rollback: delete the task artifacts; no product rollback exists.
- Observability/diagnostics: mode switch, measured workspace-start readout, screenshots, snapshots, and overflow/focus checks.
- Allowed scope: task directory and `output/playwright/settings-density-prototype/`.
- Persistent writeback: prototype, plan, notes, review, and rendered artifacts.

## Uncertainty Reducer

- Change class: redesigned UI hierarchy.
- Chosen artifact: fixture-backed interactive HTML prototype.
- Question it must answer: whether compact hierarchy improves useful viewport occupancy without losing Settings context or accessibility.
- What it does not prove: production code correctness, user preference beyond this comparison, or F7/F8/F5 value.

## Frozen Acceptance Contract

- RED verifier and expected failure: no Current/Compact prototype or measurement exists before this task.
- Focused cases: mode buttons are keyboard-operable and expose `aria-pressed`; Personal/Provider tabs preserve tab semantics; form labels and actions remain visible.
- Measurement: prototype reports the live top position of `.settings-layout`; Compact must begin materially earlier than Current at 1360x880 without hiding content.
- Screenshot/viewport/accessibility matrix: 1360x880 Current/Compact, 820x700 Compact, dark Compact, forced-colors Compact, focus outline, and document/body overflow <=1px.
- Security/dependency impact: no external image, font, script, network call, or package.
- Package/install/live opt-in impact: none.
- Full verifier: Playwright CLI snapshots/screenshots, computed measurement, format/diff/security review.
- Stop condition: matrix passes and the user receives a clear comparison; production stays unchanged.

### Acceptance-change log

| Date       | Contract change                          | Evidence/reason                                                                                | Reviewer |
| ---------- | ---------------------------------------- | ---------------------------------------------------------------------------------------------- | -------- |
| 2026-08-28 | Approve Compact for production RED/GREEN | The user selected the verified Compact prototype; F7/F8/F5 remain frozen for later prototypes. | User     |

## Approved Production Extension

- JSX contract: remove only `APPLICATION SETTINGS`, `PERSONAL CONTEXT`, and `MODEL PROVIDER`
  duplicate eyebrows. Retain the H1/H2s, tabs, field labels, descriptions, privacy text, statuses,
  errors, and actions.
- Wide CSS contract: Settings width <=1100px; padding `30px 40px 48px`; heading uses
  `auto minmax(0, 1fr)`, 18px gap, end alignment, and 18px bottom margin; H1 is 40px; layout uses
  176px tabs and 20px gap; forms use 16px gap/20px padding; panel H2 is 28px.
- Narrow CSS contract: <=920px uses `26px 24px 48px`, vertical heading, 34px H1, one-column
  workspace, two-column tabs, and existing one-column form. <=620px retains stacked tabs/actions.
- Behavior contract: no field/tab/action order, accessible name, dirty state, validation, main-call,
  or IPC change.
- Electron contract: wide H1 computes to 40px; no generic duplicate labels; workspace begins before
  180px; 820px, dark, 200%, forced colors, focus, and overflow remain green.
- Rollback: restore the three eyebrow elements and previous Settings geometry only.

## Implementation Slices

1. Prototype baseline with current geometry and copy.
2. Add compact mode using the same semantic tokens and DOM order.
3. Verify wide/narrow/dark/forced/focus/overflow and measure workspace start.
4. Stop at user decision gate.
5. Production RED: freeze JSX absence and exact wide/narrow CSS geometry.
6. Minimal GREEN: translate the approved prototype into Settings JSX/CSS.
7. Production closeout: focused/full/Electron/rendered/accessibility/diff review.

## Independent Review

- Product/contract fit: pass; the production Compact slice improves expert-tool density while
  preserving the Settings information architecture and all safety/privacy text.
- Accidental scope or complexity: none in F6; production changes are three duplicate-label removals
  plus measured Settings geometry and focused/full/Electron contracts. No framework or dependency
  was added.
- Test weakening: none; RED failed on the old DOM/geometry, GREEN passed on the approved contract,
  and the existing suite remains green.
- Input/secret/untrusted-content boundaries: unchanged. Existing credential inputs and safety copy
  remain intact; no request, storage, credential-flow, log, remote-image, or external-script change.
- SQLite/preload/IPC/migration/rollback: unchanged; rollback is limited to restoring the three
  labels and previous Settings CSS geometry.
- Diagnostics/package/update impact: none; screenshots and computed Electron geometry are evidence
  artifacts only.
- Findings and resolutions: the first Electron assertion matched the preserved Personal context
  tab case-insensitively; targeting the removed eyebrow elements corrected the test without
  weakening product semantics.
- Residual review: Compact intentionally removes only generic duplicate eyebrows; evidence-bearing
  labels elsewhere are outside F6. F7/F8/F5 remain frozen.

## Evidence Closeout

- Changed files for F6: this task directory, `output/playwright/settings-density-prototype/`,
  `SettingsView.tsx`, `SettingsView.test.tsx`, `styles/settings.css`, `styles.test.ts`, and the
  bounded Settings assertions in `e2e/desktop.spec.ts`.
- Deliberately untouched by F6: package files, dependencies, data/storage/preload/IPC, F7/F8/F5,
  installed app, and Git remote. The working tree contains other previously authorized slices,
  which are not claimed as F6 changes.
- Prototype modes: Current and Compact interactive toggle passed.
- Measurement: 1360 Current 278px, Compact 145px, 133px earlier; 820 Compact 154px.
- Rendered matrix: 1360 Current/Compact; 820 Compact; dark; forced colors; all reviewed.
- Accessibility: semantic snapshot, tabs/tabpanel/field labels, keyboard 3px focus-visible, and
  privacy/action content passed.
- Overflow/console: document/body 0px horizontal overflow; clean session zero errors/warnings.
- Production RED/GREEN: expected RED was 27/29; focused GREEN passed 29/29.
- Full verification: `npm run check` passed architecture, format, lint, types, 61 files / 411 tests,
  > =80% coverage, and both builds; Electron E2E passed 2/2.
- Production rendered matrix: wide light, dark, 820px, 200% zoom, forced colors, keyboard focus,
  and horizontal overflow passed. The compact workspace begins before 180px in Electron.
- Security/dependency/package evidence: no external asset/script/request, dependency, credential
  flow, log, storage, IPC, package, or update change; scoped format, diff, and secret scans passed.
- Residual risks/blockers: none for F6. F7/F8/F5 require their own prototype decisions.
- Rollback path: restore the three eyebrow elements and previous Settings geometry; remove prototype
  task/output artifacts only if the historical comparison is no longer needed.
- Git/install/push/publication state: no commit, push, package/app install, or publication.
