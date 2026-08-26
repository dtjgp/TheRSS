# Change Contract: Discover list-detail workspace

## Feature Intake

- **User outcome:** scan a large Discover session quickly, keep the selected record in context, and
  perform Save, Analyze, promotion, or native context actions without scrolling through repeated
  full-card controls.
- **Observed problem/evidence:** the current installed app shows a 100-result session as long cards;
  the first card consumes most of the result viewport. The existing Saved workspace proves that a
  list-detail hierarchy is effective for the same research-item task.
- **Reference evidence:** Saved supplies the internal task pattern. The reviewed UI/UX framework
  recommends task-first case evidence, progressive disclosure, consistent components, and explicit
  AI-system state. A generic SaaS dashboard, masonry grid, dense data table, and wholesale external
  component-library import were rejected because they weaken reading context or macOS coherence.
- **Product fit and relevant non-goal:** strengthens the explicit Discover-to-Saved critical path.
  It does not turn TheRSS into a general reader, autonomous author, or Zotero/Obsidian replacement.
- **Alternatives considered, including no change:** keeping cards preserves implementation
  simplicity but leaves scanning costly. A modal detail loses context. Reusing `SignalWorkspace`
  directly would import Saved-only lifecycle behavior. A focused Discover workspace is the narrowest
  coherent choice.
- **Cost:** one focused component plus tests/CSS; no runtime service or dependency; modest ongoing
  maintenance shared with existing visual tokens.
- **Boundary changes:** renderer presentation and local component state only. No API, IPC, SQLite,
  main/preload, adapter, planner, provider, secret, network, migration, package, or update change.
- **Kill criterion:** stop or roll back if list-detail makes filtering/actions less discoverable,
  loses provenance/evidence text, clips at 820 px/200% zoom, or requires a new data boundary.
- **Decision:** proceed through a deterministic fixture prototype and TDD.

## Capability Contract

- **Objective:** render the current visible Discover batch as an accessible resizable list-detail
  workspace with stable selection and unchanged item actions.
- **Goals:** compact rows; selected detail; Arrow-key movement; Save toggle; paper-only Analyze and
  llm-wiki promotion; native context menu; match reasons; source/kind/date/signal metadata; summary
  expansion; stable filters and progressive reveal; responsive stacking.
- **Non-goals:** cancellation/progress/retry state machine, virtualization, new keyboard action
  letters, Dismiss, read state, saved selection across app restart, new persistence, or visual theme.
- **Interfaces and public API invariants:** `TheRSSApi`, `DiscoverSnapshot`, persistence, promotion
  confirmation, and context-menu descriptors keep their current signatures and semantics.
- **Data ownership and evidence semantics:** `DiscoverView` continues to own the persisted snapshot,
  filter, batch, analysis, and mutation state. Selection is transient renderer state. Source
  metadata and model-derived reasons remain discovery evidence only.
- **Failure states:** empty session, empty filter, Save failure, analysis failure, and promotion
  terminal states keep existing wording and roles. If the selected record leaves the visible set,
  selection deterministically falls back to the first visible record.
- **Migration and rollback:** no migration. Rollback removes the focused component and restores the
  current card map/CSS.
- **Observability/diagnostics:** semantic labels, deterministic tests, fresh Electron screenshots,
  and current error/status regions; no telemetry or logging.
- **Allowed scope:** `DiscoverView`, one focused Discover result-workspace component/test, Discover
  and workspace CSS/tests, the relevant deterministic Electron assertions, and this audit folder.
- **Persistent writeback:** scoped source/tests and task evidence only.

## Uncertainty Reducer

- **Change class:** redesigned UI flow using existing product behavior.
- **Chosen artifact:** standalone deterministic interactive prototype grounded in the current Saved
  workspace and current Discover fixtures.
- **Question it must answer:** whether list density, selection, action placement, Search details, and
  narrow stacking remain understandable before production logic changes.
- **What it does not prove:** API correctness, Saved mutation, promotion confirmation, real source
  data, accessibility compliance, package behavior, or performance under unbounded data.

## Frozen Acceptance Contract

- **RED verifier and expected failure:** focused renderer tests expect a labelled Discover result
  list, selected-detail region, Arrow-key selection, action relocation, filter fallback, and a
  resizable divider; current card output lacks these semantics.
- **Focused unit/integration cases:** first visible item selected; click and Arrow navigation;
  selection fallback after filter; Save toggles only selected item; Analyze/promotion paper-only;
  repository/article actions remain bounded; context menu targets selected/right-clicked item;
  progressive reveal updates the list count.
- **Migration/rollback cases:** none; diff review proves no shared/main/storage/API changes.
- **E2E/manual path:** fixture Discover search; inspect list/detail; move selection; Save paper;
  Analyze paper; filter Other and back; open Search details; verify Saved still works.
- **Screenshot/viewport/accessibility matrix:** wide light, 820 px light, 200% zoom, dark, and forced
  colors; list/detail or stacked reading order; visible focus; no horizontal overflow; no color-only
  selection.
- **Security/dependency impact:** no dependency, HTML injection, credential, network, or IPC change;
  continue rendering untrusted metadata as React text and bounded external links.
- **Package/install/live opt-in impact:** build and Electron fixture verification only. No install,
  package replacement, live provider/source, commit, push, or publication.
- **Full verifier:** focused RED/GREEN; `npm run check:architecture`; `npm run check`;
  `npm run test:e2e`; current-run screenshot inspection; `git diff --check`; scoped secret/debug and
  independent diff review.
- **Stop condition:** all semantics/actions/layout gates pass and no critical/high review finding
  remains, or a concrete blocker is recorded.

### Acceptance-change log

| Date       | Contract change                                                                                                                      | Evidence/reason                                                                                                                                                                                                                                                                                                       | Reviewer |
| ---------- | ------------------------------------------------------------------------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------- |
| 2026-08-26 | Replace card-count, heading-per-card, and stagger-delay assertions with list/detail selection and single-detail hierarchy assertions | The reviewed product contract intentionally removes repeated full cards. Preserving card-only DOM and animation details would prevent the accepted task-level redesign while adding no retrieval, evidence, or accessibility protection. Progressive 24-item reveal remains required at the result-row level.         | Codex    |
| 2026-08-26 | Move scrolling from the outer Discover result region to the bounded result list and selected-detail panes                            | A fixed list-detail workspace needs independent list/detail reading positions. Keeping the outer card-stream scroller and sticky pagination creates nested scroll containers and an incorrect sticky boundary. The result shell remains height-bounded and overflow-hidden; list and detail retain explicit overflow. | Codex    |
| 2026-08-26 | Use the E2E fixture's actual paper-to-article ArrowDown path                                                                         | The first Electron run showed the deployed fixture order is paper, article, repository. The attempted repository-to-article ArrowDown assertion contradicted that order and correctly left selection on the last repository. The acceptance remains one-step keyboard movement; only the fixture path is corrected.   | Codex    |
| 2026-08-26 | Enter the forced-colors result row through the real Tab order                                                                        | Chromium does not apply `:focus-visible` to a programmatic `.focus()` call. The forced-colors acceptance is specifically a keyboard-focus contract, so the verifier starts at the result region and traverses the four filters to the selected row with Tab before asserting the visible outline.                     | Codex    |

## Implementation Slices

1. **RED:** prototype plus focused user-visible list/detail tests.
2. **Minimal GREEN:** row/detail component, transient selection, existing action callbacks.
3. **Refactor:** keyboard/context-menu handling, responsive CSS, source-size headroom.
4. **Next slice gate:** full renderer green and accepted wide/820 screenshots before closeout.

## Independent Review

- **Product/contract fit:** the result workspace strengthens the explicit Discover-to-Saved task and
  retains evidence/provenance boundaries. It adds no general reader, account, sync, authoring, or
  autonomous behavior.
- **Accidental scope or complexity:** the new component is 330 lines and reduces `DiscoverView` from
  659 to 530 lines. No component library, dependency, shared type, endpoint, callback bus, or
  persistence was added.
- **Test weakening:** card-only count/heading/stagger assertions were replaced only after the
  reviewed acceptance log changed. Progressive reveal, result identity, filter behavior, Saved,
  Analyze, promotion, context menu, evidence order, and responsive/accessibility behavior are more
  directly asserted than before.
- **Input/secret/untrusted-content boundaries:** production metadata remains React text; external
  URLs remain bounded links and typed context-menu fields. No HTML rendering, credential, clipboard,
  command, or new network flow was introduced. The static prototype's `innerHTML` never receives
  application/user/external data.
- **SQLite/IPC/migration/rollback:** no shared, core, main, preload, IPC, database, migration,
  adapter, planner, provider, or package diff. Rollback is renderer/test/CSS/doc removal only.
- **Diagnostics/package/update impact:** semantic labels and fresh screenshots are the diagnostics.
  No logging, telemetry, package replacement, update, or install behavior changed.
- **Findings and resolutions:** lint rejected effect-driven fallback, E2E corrected the real fixture
  order and keyboard-focus path, and screenshot review drove independent scroll ownership plus
  4/2/1-column filter reflow. No critical/high scoped-code finding remains. The broader 200%-zoom
  sidebar-collapse gap is retained explicitly for the next Shell accessibility slice.

## Evidence Closeout

- **Changed files:** `DiscoverResultWorkspace.tsx`, `DiscoverView.tsx`, renderer styles/tests,
  `App.test.tsx`, `e2e/desktop.spec.ts`, `PRODUCT.md`, `docs/APPLE_NATIVE_PRODUCT_AUDIT.md`, and this
  task-local contract/prototype/evidence directory.
- **Deliberately untouched files:** shared types/API, core discovery/ranking, main/preload/IPC,
  SQLite/storage/migrations, adapters, providers/agents, llm-wiki confirmation logic, package
  metadata/dependencies, updater, and installed app.
- **Focused RED/GREEN:** RED was 15 pass / 2 expected failures; final focused integration was 5
  files / 63 tests green.
- **`npm run check:architecture`:** passed; `App.tsx` 753, `DiscoverView.tsx` 530,
  `DiscoverResultWorkspace.tsx` 330, and all owned TypeScript/TSX files remain <=800 lines.
- **`npm run check`:** passed 57 files / 382 tests; 90.42% statements, 80.80% branches, 93.49%
  functions, 93.29% lines; formatting, lint, types, coverage, and all builds passed.
- **Electron E2E/rendered evidence:** 2/2 passed outside the restricted sandbox; accepted wide,
  820 px, dark, forced-colors, Other-filter, Saved-toggle, and Saved-regression screenshots. The
  200% screenshot records the named Shell residual and still passes zero-horizontal-overflow checks.
- **Security/dependency/migration/package evidence:** no new dependency/input/secret/network/IPC/
  migration/package boundary; scoped secret/debug scan and `git diff --check` passed. No network
  audit or package/install smoke was required because those surfaces were untouched.
- **Live opt-in checks not run:** live providers, live sources, real llm-wiki writes, and external
  publication.
- **Residual risks/blockers:** 200% Electron page zoom does not notify the existing Shell sidebar
  state source, so the sidebar remains expanded and the main surface is a magnified crop. Result
  controls reflow through container queries, but full zoom-driven shell collapse is deferred.
- **Rollback path:** remove `DiscoverResultWorkspace`, restore the prior card map and scroll CSS,
  revert the scoped tests/docs; no data migration or installed-app recovery is needed.
- **Git/install/push/publication state:** working tree intentionally contains uncommitted scoped
  changes. No commit, install, push, release, or third-party mutation was performed.
