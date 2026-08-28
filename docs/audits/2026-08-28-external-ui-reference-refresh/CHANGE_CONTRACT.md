# TheRSS Change Contract: External UI Reference Refresh

## Feature Intake

- User outcome: a clearer, more polished TheRSS interface informed by current high-quality UI
  references without weakening the research workflow.
- Observed problem/evidence: the user supplied an X post containing UI references; the exact
  relevance and current TheRSS gaps remain to be established by the audit.
- Product fit and relevant non-goal: supports the single-user Discover/Saved research workflow;
  must not turn TheRSS into a generic news reader, marketing site, or opaque AI dashboard.
- Alternatives considered, including no change: retain the current UI; adopt only token-level
  refinements; adopt one bounded interaction pattern; broader redesign only if evidence proves it
  necessary.
- Cost: bounded renderer/test/documentation work; no new runtime service or external-service cost;
  maintenance cost must remain within existing CSS/component conventions.
- Boundary changes: renderer-only is allowed; architecture, SQLite, IPC, security, network, and
  package behavior are frozen unless this contract is explicitly revised before code changes.
- Kill criterion: stop or choose no change if the references are inaccessible, purely decorative,
  conflict with TheRSS information density/evidence semantics, or cannot pass the frozen
  accessibility/viewport matrix without disproportionate complexity.
- Decision: proceed through the deterministic run-pipeline prototype, then the frozen RED/GREEN
  slice below.

## Capability Contract

- Objective: replace the one-line active Discover progress treatment with a truthful three-stage
  run pipeline and add the same compact stage model to the terminal Search details summary.
- Goals: clearer planning/search/assembly hierarchy; native progress semantics; latest completed
  source context; terminal source/result counts; coherent native-desktop polish.
- Non-goals: new data, source, model, account, sync, storage, IPC, packaging, or autonomous-analysis
  capability; copying reference branding or content.
- Interfaces and public API invariants: existing preload/IPC contracts, navigation destinations,
  persisted layouts, Discover actions, Saved semantics, and keyboard behavior remain stable.
- Data ownership and evidence semantics: SQLite remains the operational source of truth; renderer
  changes do not alter complete/partial/empty/failed/canceled or source/model provenance states.
- Failure states: narrow viewport overflow, lost keyboard focus, illegible status/provenance,
  reduced-motion violations, or broken scroll ownership fail acceptance.
- Migration and rollback: no migration; rollback is the scoped renderer/test/CSS diff.
- Observability/diagnostics: existing test IDs and accessible names remain stable unless a reviewed
  user-visible contract change requires otherwise.
- Allowed scope: task-local evidence; one focused renderer component and test; `DiscoverView` wiring;
  Discover CSS/style assertions; affected deterministic Electron assertions/screenshots; and one
  bounded main-process E2E fixture delay that is disabled outside explicit fixture runs.
- Persistent writeback: this contract, task plan, notes, audit report, screenshots, and verifier
  results.

## Uncertainty Reducer

- Change class: new or redesigned UI flow.
- Chosen artifact: deterministic fixture-backed interactive prototype and rendered comparison.
- Question it must answer: whether three truthful stages improve understanding without crowding the
  form/results or implying source/result facts that the current progress event does not contain.
- What it does not prove: live-source correctness, provider behavior, SQLite/IPC correctness,
  package installation, or real-user preference.

## Frozen Acceptance Contract

- RED verifier and expected failure: a focused component test requires a labelled three-stage list,
  native progress-bar semantics, latest completed source/outcome copy, cancel state, and terminal
  counts; the current one-line progress block has none of those contracts.
- Focused unit/integration cases: planning marks only Plan query current; searching marks Plan query
  complete and Search sources current; progressbar exposes 3/22; the latest arXiv healthy outcome is
  rendered as `arXiv complete · 2 results`; cancel-requested disables the existing Cancel action;
  terminal completed/partial/no-results/canceled snapshots map to truthful stage labels and counts.
- Migration/rollback cases: no migration; scoped revert restores prior renderer behavior.
- E2E/manual path: launch fixture Electron app, start Discover, observe the pipeline, complete the
  run, inspect compact terminal stages, cancel/retry regression, then exercise existing result
  keyboard/filter/save/analyze/promotion paths.
- Screenshot/viewport/accessibility matrix: 1360x880 light, 820x700 light, 1360x880 dark, 200% zoom,
  forced colors, and reduced-motion computed-state inspection; no horizontal overflow or lost focus.
- Security/dependency impact: no remote HTML, dependency, credential, IPC, or network change.
- Package/install/live opt-in impact: package/install and live providers are out of scope unless a
  later contract revision proves they are required.
- Full verifier: focused tests, `npm run check:architecture`, `npm run check`, relevant Electron E2E,
  fresh rendered evidence, scoped secret/debug scan, and diff review.
- Stop condition: the pipeline and terminal summary pass focused/full/Electron/rendered gates with
  no critical/high finding and no change outside the frozen renderer boundary.

### Acceptance-change log

| Date       | Contract change                                                                                                           | Evidence/reason                                                                                                                                                                                                                                           | Reviewer |
| ---------- | ------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------- |
| 2026-08-28 | Replace the one-line `Discover search progress` status label with the accepted `Discover run pipeline` component contract | The frozen UI slice intentionally expands one aggregate status into three labelled stages plus native progress semantics. The existing count/cancel assertions remain and are strengthened with stage-list and progressbar checks.                        | Codex    |
| 2026-08-28 | Keep the terminal status badge on one line at 820 px and require the stage summary to remain visible                      | Fresh Electron review showed the new summary reduced available space enough for `Search complete` to wrap into a tall two-line pill. This regression was caused by the accepted slice, so a CSS invariant and E2E assertion are required before closeout. | Codex    |
| 2026-08-28 | Rename the terminal stage-list label from `Completed` to `Recorded`                                                       | Independent review proved `Completed Discover run stages` was semantically incorrect for partial and canceled persisted snapshots. `Recorded` describes the durable summary without upgrading those evidence states.                                      | Codex    |
| 2026-08-28 | Reopen the closed slice for approved taste hardening F1-F4                                                                | The user accepted A1-A9 and explicitly authorized terminal-summary simplification, active-state visual evidence, an 11-12 px microcopy floor, and live-region/control separation. F5-F8 remain deferred.                                                  | User     |

## Approved Taste Hardening Extension: F1-F4

### Frozen Acceptance

- F1 terminal summary: replace the three boxed stage chips with one compact unboxed group. It must
  retain `Plan ready`, searched-source count, record count, and explicit `needs attention` or
  `stopped` language for partial/failed or canceled snapshots.
- F2 active evidence: an explicitly delayed E2E fixture must expose planning and searching long
  enough to capture fresh planning plus wide/narrow/dark/forced-colors searching screenshots. The
  delay must require both E2E fixture mode and its dedicated environment flag.
- F3 microcopy: header support copy, stage descriptions, stage values, and the terminal summary must
  compute to at least 11 px. Marker glyphs may remain compact if their accessible state is textual.
- F4 live region: `Discover run pipeline` becomes the stable outer region; only the non-interactive
  progress body owns `role="status"` / polite live semantics under `Discover run progress`; Cancel
  remains inside the region but outside the live status.
- Focused RED verifier: component semantics/summary tests plus the stylesheet contract must fail on
  the pre-extension implementation.
- Electron verifier: the active region/status/control contract, computed microcopy sizes, zero
  horizontal overflow, reduced-motion behavior, and active screenshot matrix must pass before the
  existing terminal/result path continues.
- Rollback: revert the F1-F4 component/CSS/test/E2E-fixture diff without touching persisted data or
  the original three-stage behavior.

## Implementation Slices

1. RED: focused `DiscoverRunStatus` planning/searching/cancel/terminal semantics and integration
   assertions.
2. Minimal GREEN: pure presentation component driven only by existing progress/snapshot data.
3. Refactor: responsive styling, reduced-motion-safe state emphasis, and terminal summary reuse.
4. Next slice gate: no second slice without returning to Feature Intake.
5. Approved extension RED: freeze F1-F4 component, CSS, and active Electron contracts.
6. Approved extension GREEN: implement the smallest component/CSS/E2E-fixture changes.
7. Approved extension closeout: rerun the full gates and update rendered evidence/review.

## Independent Review

- Product/contract fit: the implementation makes the existing Discover lifecycle legible without
  adding a chat, generic dashboard, source, data, provider, or autonomous-analysis surface.
- Accidental scope or complexity: one 207-line presentation component and 135-line focused test;
  `DiscoverView` shrank from 685 to 658 lines. The F2 delay/fetch helpers live in the existing
  116-line `e2eFixtures.ts`, keeping `main/index.ts` at 753 lines. No registry, Tailwind, Motion,
  shadcn, transition skill, or other dependency was added.
- Test weakening: none. The old aggregate progress assertion was replaced only after the acceptance
  log changed; it now retains count/cancel coverage and adds three-stage plus progressbar semantics.
  Visual review added a failing 820px no-wrap assertion before the CSS fix.
- Input/secret/untrusted-content boundaries: source display names and outcomes continue to render as
  React text. No remote HTML, new URL, command, clipboard, credential, logging, or network path was
  added. Scoped secret/debug/HTML scans were empty.
- SQLite/IPC/migration/rollback: package/shared/core/main/preload boundary diff is empty. There is no
  schema, storage, IPC, adapter, provider, source, migration, or installed-app change.
- Diagnostics/package/update impact: semantic roles, deterministic fixtures, screenshots, and the
  task-local audit are the diagnostics. No telemetry, package replacement, update, or install change.
- Findings and resolutions: static gates caught render-time ref access and explicit test indexing;
  rendered review caught a two-line 820px terminal status pill; semantic review caught the incorrect
  `Completed` list label for partial/canceled sessions. All were fixed with RED/GREEN evidence. No
  critical/high scoped finding remains.
- F1-F4 findings and resolutions: seven focused RED failures closed on the intended summary/live/CSS
  contracts. The delayed Electron run exposed one stale terminal wait and one 5-second fixture timing
  boundary; both were corrected with explicit pipeline lifecycle waiting and one local 10-second
  assertion. The test-only delay was moved from `main/index.ts` into `e2eFixtures.ts` during refactor.

## Evidence Closeout

- Changed files: `PRODUCT.md`; `DiscoverRunStatus.tsx` and its focused test; `DiscoverView.tsx`;
  Discover CSS and style contract; `App.test.tsx`; Electron `desktop.spec.ts`; the double-gated
  `e2eFixtures.ts`/main fixture wiring; and this task-local contract, plan, notes, reference audit,
  and prototype.
- Deliberately untouched files: package manifests/dependencies, shared types/API, core services,
  storage/SQLite/migrations, main/preload/IPC, sources/adapters, providers/agents, llm-wiki writer,
  packaging/updater, installed app, and all unrelated user files.
- Focused RED/GREEN: initial RED failed because `DiscoverRunStatus` did not exist; component GREEN
  passed 6/6. For F1-F4, the new component/App/CSS contract failed 7/45 on the pre-extension
  implementation, then passed 45/45 after the minimal implementation and one proven matcher fix.
- `npm run check:architecture`: passed; all owned TypeScript/TSX files remain <=800 lines.
- `npm run check`: passed 61 files / 409 tests; 90.29% statements, 80.15% branches, 93.64%
  functions, and 93.20% lines; format, lint, types, coverage, and all builds passed.
- Electron E2E/rendered evidence: final build-first E2E passed 2/2. Fresh active screenshots cover
  planning; searching wide light; 820x700 light; dark; and forced colors. Reduced motion forces one
  iteration, active 820px horizontal overflow is <=1px, and the terminal screenshot shows the
  unboxed summary. The existing 200% and prototype 520px evidence also remain green.
- Security/dependency/migration/package evidence: `git diff --check` passed; scoped secret/debug/HTML
  scan and package/shared/core/main/preload boundary diff were empty. No dependency, migration,
  package, or installer gate was introduced.
- Live opt-in checks not run: live application model/provider/source calls, real llm-wiki writes,
  package/install smoke, release/signing, and publication. External reference websites and the
  user-supplied X post were read-only research inputs.
- Residual risks/blockers: the intentional delay exists only when both `THERSS_E2E_FIXTURES=1` and
  `THERSS_E2E_DISCOVER_DELAY=1`; production and ordinary fixture behavior remain unchanged. Real
  provider latency remains an opt-in observation. F5-F8 are deferred, not blockers.
- Rollback path: remove the focused component/test, restore the prior one-line progress block and
  Discover CSS, remove the terminal summary and new E2E assertions, and revert the scoped product/audit
  docs. No data or installed-app recovery is required.
- Git/install/push/publication state: scoped changes are uncommitted on local `main`; no commit,
  branch, push, PR, merge, install, package replacement, release, or third-party mutation occurred.
