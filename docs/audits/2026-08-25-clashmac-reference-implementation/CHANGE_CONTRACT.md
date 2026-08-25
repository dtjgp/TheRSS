# Change Contract: Contextual status hierarchy and verified mainline release

## Feature Intake

- **User outcome:** TheRSS should gain the useful interaction hierarchy identified in the ClashMac
  comparison, remain honest about local evidence, ship as a verified local beta, and leave GitHub
  `main` as the single clean branch.
- **Observed problem/evidence:** The top bar currently shows only the active view and date while the
  same dashboard snapshot already contains saved counts and source state. Analytics hides the recent
  window result total inside Lifetime-card detail instead of exposing it as a peer summary. The
  Apple-native work is already committed both locally and remotely through different but
  content-identical histories. Branch state was audited live before integration or deletion.
- **Product fit and relevant non-goal:** Fits the local-first research desk and Apple-native shell.
  Non-goals are a monitoring-style Discover redesign, empty Settings categories, background refresh,
  a tray/status-item surface, new analytics history, new storage, cloud sync, or live providers.
- **Alternatives considered, including no change:** No change leaves useful state hidden and the
  current Apple-native work unfinished. A ClashMac visual clone would damage research readability.
  New top-bar APIs/callbacks would add unnecessary state ownership. Chosen approach derives compact
  status only from state already owned by `App`, plus one honest recent-window Analytics card.
- **Cost:** small renderer/component/test/CSS work; no continuous runtime work; low maintenance; no
  new dependency or external service.
- **Boundary changes:** renderer composition and presentation only. No SQLite, IPC, preload, source,
  provider, secret, network, migration, or updater boundary changes. Packaging/install and Git refs
  are verified operational steps, not product architecture changes.
- **Kill criterion:** remove the contextual strip if it duplicates primary controls, obscures the
  title at 820 px/200% zoom, relies on color alone, or requires a new data boundary.
- **Decision:** proceed with an interactive fixture prototype and TDD implementation.

## Capability Contract

- **Objective:** expose one compact, accessible, view-specific status cluster in the existing top
  bar and promote the honest recent Analytics window to a first-class summary without changing the
  research workflow or evidence semantics.
- **Goals:** view-specific text status; explicit source-attention wording; saved counts; local-only
  Analytics cue; responsive/keyboard/high-contrast behavior; four honest Analytics summaries.
- **Non-goals:** top-bar search/actions, new persistence, new time windows, menu-bar app surface,
  theme override, source weighting, background work, or decorative motion.
- **Interfaces and public API invariants:** `TheRSSApi`, IPC, SQLite schemas, source adapters, and
  Discover/Saved actions keep their signatures and semantics.
- **Data ownership and evidence semantics:** shell status derives from current `DashboardSnapshot`;
  missing dashboard data remains an opening/idle state. Analytics continues to label returned
  records as non-unique and uses only the persisted window returned by `getAnalytics()`.
- **Failure states:** opening index, source attention, refreshing, partial/pending, local-only utility,
  zero saved items, and unsaved Settings state remain text-labelled.
- **Migration and rollback:** no migration. Rollback is removal of the extracted top-bar component
  and fourth summary card; current navigation and data remain intact.
- **Observability/diagnostics:** no logs or telemetry. Accessible labels and current-run screenshots
  provide inspection evidence.
- **Allowed scope:** `src/renderer/src/App.tsx`, a focused extracted top-bar component/test,
  `DataAnalyticsView.tsx`/tests, renderer CSS/tests, E2E screenshot assertions, README, and task docs.
- **Persistent writeback:** source/tests/docs, scoped commits, local installed beta, Git refs.

### Live Git baseline

- Local `main`: `81b3d5a` (three Apple-native commits plus merge).
- Remote `origin/main`: `9b645b6` (PR #29 squash).
- Content identity: both resolve to tree `31c12ad18ab085d82841b30685b2fd203d0b08d5`.
- Branch inventory: no non-main local branches and no non-main remote heads.
- Integration rule: preserve both histories with a normal merge; do not reset, force-push, or recreate
  already-deleted branches.

## Uncertainty Reducer

- **Change class:** new UI shell status layer plus Analytics presentation refinement; packaging and
  Git integration operations.
- **Chosen artifact:** deterministic standalone interactive prototype using current semantic tokens,
  followed by a component invariant matrix and failing user-visible tests.
- **Question it must answer:** can one compact cluster expose useful state without duplicating view
  controls or breaking the shell at wide/narrow layouts and high zoom?
- **What it does not prove:** real SQLite correctness, VoiceOver completeness, live source/provider
  behavior, package identity, or branch safety; those have separate gates.

## Frozen Acceptance Contract

- **RED verifier and expected failure:** renderer tests fail because no view-specific top-bar context
  labels exist and Analytics has no first-class recent-window summary.
- **Focused unit/integration cases:** Discover source count/readiness; Saved counts; Analytics local
  boundary; Sources attention; Settings unsaved state; missing dashboard fallback; recent-window
  Analytics value; four-card responsive class/semantics.
- **Migration/rollback cases:** none; diff review proves no shared/storage/API changes.
- **E2E/manual path:** fixture Electron navigation across Discover, Saved, Analytics, Sources, and
  Settings; context text updates with each view; core Discover/Saved actions remain intact.
- **Screenshot/viewport/accessibility matrix:** 820/1024/1440 px, light/dark, 200% zoom,
  `prefers-contrast: more`, forced colors; no clipping or color-only meaning; accepted fresh images.
- **Security/dependency impact:** no new dependency, input, secret, HTML, network, IPC, or credential
  flow; run production dependency audit and added-line secret/debug scans before commit/push.
- **Package/install/live opt-in impact:** build macOS directory package, smoke it, back up and install
  local beta, verify installed/release `app.asar` hashes and SQLite integrity. No live provider/source.
- **Full verifier:** focused tests, `npm run check`, `npm run test:e2e`, rendered inspection,
  `npm audit --audit-level=high`, `npm run install:local`, and installed `npm run smoke:package`.
- **Stop condition:** all checks pass, installed package matches, branch integration is proven,
  obsolete refs are deleted, README is current, and `origin/main` matches the final verified commit.

### Acceptance-change log

| Date       | Contract change                                                                                        | Evidence/reason                                                                                                                                                                                                                                                                           | Reviewer |
| ---------- | ------------------------------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------- |
| 2026-08-25 | View context uses a labelled `group` with polite live updates, not `role=status`                       | Broad App tests proved a persistent global status region collides with transient save/triage status announcements and makes their accessible query/announcement channel ambiguous. The context remains labelled and live without taking the semantic role reserved for terminal feedback. | Codex    |
| 2026-08-25 | Only the existing unsaved-change text remains a live `status`; the enclosing context group is not live | The follow-up integration run showed the historical Settings contract intentionally exposes `Unsaved changes` as a status. Making the entire persistent group live is unnecessary because view navigation already changes headings and risks duplicate announcements.                     | Codex    |
| 2026-08-25 | Electron Sources assertion expects `22 not checked`, not an attention state                            | The deterministic E2E fixture has no recorded source runs at the directory step. Expecting attention contradicted the fixture and the product rule that missing current state is not a failure. Component tests continue to cover partial/failed attention.                               | Codex    |

## Implementation Slices

1. **RED:** prototype review plus focused top-bar and Analytics tests.
2. **Minimal GREEN:** extracted top bar, view-status derivation, fourth Analytics summary.
3. **Refactor:** responsive/accessibility CSS and source-size headroom.
4. **Next slice gate:** focused green and rendered prototype acceptance before README/release work.

## Independent Review

- **Product/contract fit:** contextual status uses existing local state and preserves Discover/Saved
  editorial workflows. Analytics promotes only a persisted existing window. Gated Settings/tray work
  remains deferred.
- **Accidental scope or complexity:** no callback bus, new endpoint, background worker, setting,
  dependency, or generic dashboard framework was added. Extracting `AppTopbar` reduced `App.tsx` to
  753 lines and kept the component at 175 lines.
- **Test weakening:** none. RED tests were added first. Two acceptance corrections strengthened
  semantic accuracy: persistent context stopped competing with transient statuses, and E2E now
  asserts the exact `not checked` fixture state instead of assuming failure.
- **Input/secret/untrusted-content boundaries:** no new input, HTML, URL, credential, clipboard,
  network, or external-content rendering. Added-line/new-file secret and debug scans were clean.
- **SQLite/IPC/migration/rollback:** no shared type, API, IPC, preload, main, schema, migration, or
  adapter change. Analytics reads only its existing `AnalyticsSnapshot`.
- **Diagnostics/package/update impact:** README and hero screenshot are current; package/install was
  rehearsed with backup, hash, SQLite integrity, package smoke, and installed-binary E2E.
- **Findings and resolutions:** status-role collision and fixture health assumption were found by
  broader verification, documented before acceptance/test edits, and resolved. No critical/high
  residual code finding remains.

## Evidence Closeout

- **Changed files:** `README.md`, `docs/images/therss-discover.png`, `e2e/desktop.spec.ts`,
  `src/renderer/src/{App,AppTopbar,DataAnalyticsView}.tsx` plus focused tests, renderer
  style/accessibility files, and this task's prototype/evidence directory.
- **Deliberately untouched files:** shared API/types, main/preload/IPC, SQLite/storage, adapters,
  providers/agents, llm-wiki logic, package metadata/dependencies, updater behavior, Settings
  categories, and background/tray work.
- **Focused RED/GREEN:** expected missing component/card/style failures; then 3 files / 24 tests
  green; final six-file renderer integration 6 files / 71 tests green.
- **`npm run check:architecture`:** passed; every owned file <= 800 lines.
- **`npm run check`:** passed 57 files / 382 tests; statements 90.42%, branches 80.80%, functions
  93.49%, lines 93.29%; formatting, lint, types, coverage, Electron/main/preload/renderer/MCP builds
  all passed.
- **Electron E2E/rendered evidence:** source build 2/2; installed binary 1/1; accepted wide, 820 px,
  dark, forced-colors, 200% zoom, Analytics, Sources, and installed-app screenshots.
- **Security/dependency/migration/package evidence:** `npm audit --audit-level=high` found 0
  vulnerabilities; no dependency/migration; native smoke passed in blue, purple, and restored blue;
  package smoke, matching app.asar hash, current/backup SQLite integrity, and installed metadata
  passed.
- **Live opt-in checks not run:** live providers, live sources, and external llm-wiki writes.
- **Residual risks/blockers:** personal beta remains unsigned/unnotarized. The top-bar secondary text
  intentionally hides at <=920 px but remains available in wide layouts and the underlying view
  state remains visible in its destination surface.
- **Rollback path:** revert GitHub squash commit
  `e227b14134282d5a683489a89ea9a90eb0499aa7`; restore the retained previous app and SQLite backup
  listed in `notes.md`.
- **Git/install/push/publication state:** app installed and verified; PR #30 passed both required CI
  jobs and squash-merged; GitHub removed the temporary remote branch; the proven-equivalent local
  branch was deleted; product closeout had only main with local, tracking, and live remote SHA all
  equal to `e227b14134282d5a683489a89ea9a90eb0499aa7`.
