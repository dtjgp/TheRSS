# Change Contract: Zoom-aware sidebar and unified selection shape

## Feature Intake

- **User outcome:** zoom to 200% without the sidebar crowding Discover, and see one consistent rounded
  selected-control shape across sidebar navigation and result filters.
- **Observed problem/evidence:** the supplied screenshot shows the expanded sidebar occupying most of
  the zoomed window and a rounded Discover navigation state beside a square `All` filter state.
- **Product fit and non-goal:** improves the local desktop shell and accessibility. It does not change
  retrieval, evidence, sources, accounts, sync, analysis, storage, or product scope.
- **Alternatives:** CSS-only sidebar hiding would desynchronize accessible labels/state. Adding zoom
  IPC duplicates renderer capacity evidence. Forcing manual collapse burdens keyboard/zoom users.
  Chosen approach derives effective collapse from the existing viewport state.
- **Cost:** small renderer/topbar/style/test change; no dependency, service, migration, or runtime
  background work.
- **Boundary changes:** renderer state/presentation only. No shared API, IPC, preload, main, SQLite,
  network, credential, package, or update boundary.
- **Kill criterion:** stop if the fix overwrites the stored width/manual preference, prevents normal
  820 px expansion, offers an enabled no-op toggle, or changes unrelated control geometry.
- **Decision:** proceed with TDD.

## Capability Contract

- **Objective:** separate manual sidebar preference from effective constrained presentation and use
  one selection-radius token for the two annotated controls.
- **Goals:** auto compact at <=760 renderer pixels; restore manual state above threshold; preserve
  preferred width; hide/disable resizer while constrained; explicit disabled topbar label; identical
  7 px selected-control radius.
- **Non-goals:** page-zoom settings, IPC zoom telemetry, changing minimum window size, persisting auto
  collapse, redesigning all control radii, or installing the app.
- **Interfaces/invariants:** `TheRSSApi`, IPC, storage key, width clamp, pointer/keyboard resize, menu
  commands, and navigation semantics remain unchanged.
- **Failure states:** if viewport evidence is absent, initial `window.innerWidth` remains the current
  fallback. Manual collapsed preference remains authoritative after space returns.
- **Migration/rollback:** no migration. Rollback removes the derived constraint and shared token.
- **Observability:** shell class/data attributes, accessible toggle label, semantic tests, and current
  Electron screenshots; no logs or telemetry.
- **Allowed scope:** `App`, `AppTopbar`, existing focused tests, shell/discover CSS, E2E zoom assertions,
  and this audit directory.
- **Persistent writeback:** scoped source/tests/docs only.

## Frozen Acceptance Contract

- **RED:** renderer test expects automatic constrained class/resizer/toggle at 700 px and restoration
  at 1360 px; style test expects one radius token on nav and result filters; current code fails both.
- **Focused cases:** normal 820 remains manually expandable; constrained state does not alter local
  storage; manual collapse survives shrink/widen; zoom reset restores expanded state when preferred;
  topbar constrained toggle is disabled and explicitly labelled.
- **E2E/manual path:** search Discover; zoom 200%; assert compact shell, hidden resizer, visible result
  title/filter group, consistent computed radii; reset zoom and assert expanded restoration.
- **Screenshot matrix:** 100%, 200%, reset; light mode plus existing dark/forced-colors regression.
- **Security/dependency:** no new input, HTML, secret, IPC, dependency, or network flow.
- **Full verifier:** focused tests, `npm run check`, Electron E2E, screenshot inspection,
  `git diff --check`, boundary/security review.
- **Stop condition:** all scoped behavior/visual gates pass with no critical/high review finding.

### Acceptance-change log

| Date | Contract change | Evidence/reason | Reviewer |
| ---- | --------------- | --------------- | -------- |

## Independent Review

- **Product/contract fit:** fixes the annotated shell/accessibility behavior without changing
  discovery, evidence, storage, or product scope.
- **Accidental scope/complexity:** one viewport threshold, two derived booleans, one topbar prop, and
  one CSS token; no zoom IPC, observer service, dependency, or persistence.
- **Test weakening:** none. Existing width/drag/manual toggle tests remain green; new tests add normal
  820, constrained 700, manual round-trip, computed radius, and Electron zoom/reset coverage.
- **Input/secret/untrusted-content:** no input, HTML, credential, URL, network, or external-content
  path added.
- **SQLite/IPC/migration/package:** no diff in shared/core/main/preload/package surfaces; no migration
  or installed-app mutation.
- **Findings:** screenshot review required the existing very-narrow result heading to reduce from 20
  to 18 px so its full text remains contained after the sidebar compacts. No critical/high finding
  remains.

## Evidence Closeout

- **Changed files:** `App.tsx`, `AppTopbar.tsx` and focused tests, renderer/discover styles and style
  tests, Electron E2E assertions, prior audit residual wording, and this task evidence directory.
- **Deliberately untouched:** shared API/types, IPC, preload, main, SQLite/storage/migrations,
  discovery/ranking/adapters/providers, dependencies, package/install/update logic.
- **RED/GREEN:** focused RED failed exactly the constrained-shell and radius contracts; focused GREEN
  passed 3 files / 43 tests.
- **Full verifier:** `npm run check` passed 57 files / 385 tests; architecture, formatting, lint,
  typecheck, coverage, renderer/main/preload/MCP builds passed.
- **Electron/rendered:** 2/2 E2E passed; normal 820 remains expandable; 200% auto compacts to 84 px,
  keeps heading/filters contained, and reset restores expansion. Both annotated radii compute to 7 px.
- **Security/boundary:** `git diff --check`, scoped debug/secret scan, and empty shared/core/main/preload/
  package diff passed.
- **Live/external checks:** no live provider/source, real llm-wiki write, install, commit, push, or
  publication.
- **Rollback:** remove the constrained derived state/topbar prop and selection token, restore literal
  navigation radius and filter style; no data recovery needed.
- **Git state:** scoped changes remain intentionally uncommitted in the existing dirty worktree.
