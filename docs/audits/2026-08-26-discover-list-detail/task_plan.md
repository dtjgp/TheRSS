# Task Plan: Discover list-detail workspace

## Goal

Replace the high-volume Discover result-card stream with the existing Saved-style list-detail
workspace while preserving source filtering, result pagination, Saved state, paper analysis,
llm-wiki promotion, native context menus, provenance, and evidence boundaries.

## Task contract

- Objective: make a 100-result Discover session fast to scan without changing retrieval, ranking,
  persistence, or evidence semantics.
- Evidence to read first: `AGENTS.md`, `PRODUCT.md`, `GOALS.md`,
  `docs/DEVELOPMENT_WORKFLOW.md`, current Discover/Saved renderer source and tests, current-run
  installed-app screenshots, and the prior Apple-native audit.
- Allowed scope: Discover renderer composition, a focused result-workspace component, renderer
  styles/tests, deterministic Electron acceptance, and task-local audit evidence.
- Verifier: accepted fixture prototype; focused RED/GREEN tests; architecture gate; full check;
  Electron E2E at wide and 820 px; fresh screenshots; diff/security review.
- Stop condition: filtered Discover results use one accessible resizable list-detail workspace;
  selection and actions remain correct; Search details and evidence text remain visible; all gates
  pass or a documented blocker is proven.
- Persistent writeback: this audit directory plus scoped source/tests only. No commit, install,
  push, publication, live provider/source request, or llm-wiki write is authorized.

## Phases

- [x] Phase 1: Freeze scope, reference evidence, prototype, and acceptance contract
- [x] Phase 2: Add focused failing renderer acceptance
- [x] Phase 3: Implement the result workspace in small TDD slices
- [x] Phase 4: Run focused/full verification and inspect fresh desktop screenshots
- [x] Phase 5: Independent diff review and evidence closeout

## Key questions

1. Can Discover reuse Saved's scan-efficient list-detail hierarchy without inheriting Saved-only
   triage semantics such as Dismiss or read-on-selection?
2. Can selection remain stable when filters change, results are revealed, or Saved state changes?
3. Can the workspace retain paper-only Analyze/promotion actions and generic-source context menus?
4. Does the layout reflow at 820 px and 200% zoom without a third competing horizontal pane?

## Decisions made

- Use the current Saved workspace as the primary product reference; do not import a new component
  library or visual language.
- Discover selection is navigational only. It must not mark an item viewed, save it, or dismiss it.
- Keep the existing 24-result progressive reveal and filters. The list contains only the currently
  visible filtered batch.
- Preserve the collapsed Search details inspector below the result workspace.
- At narrow widths, stack list above detail rather than forcing two compressed columns.

## Errors encountered

- The bundled `playwright-cli` wrapper did not return a usable session in this environment. The
  repository-local Playwright 1.62.1 CLI was used for deterministic screenshots instead.
- The first prototype screenshot failed inside the restricted macOS sandbox with Chromium
  `MachPortRendezvousServer ... Permission denied`; the policy-compliant elevated rerun succeeded.
- The first full `npm run check` stopped at lint: the initial selection-fallback effect synchronously
  set React state, and `DiscoverView` retained one removed type import. Selection fallback was made a
  pure derived value and the unused import was removed; no acceptance behavior changed.
- The first elevated Electron E2E run passed sidebar resizing but the new ArrowDown assertion chose
  the last repository row and incorrectly expected the preceding article. The failure screenshot
  proved selection stayed truthfully on the last row; the path now starts on the first paper and
  moves one row down to the article in the actual E2E fixture order.
- The first forced-colors Discover check used programmatic focus and correctly received no
  `:focus-visible` outline. The verifier now uses the actual Tab sequence from the result region
  through four filters to the selected row before asserting keyboard focus.
- The first accepted-image pass found the result header still shared one horizontal row at 820 px
  and 200% zoom, leaving the filter group visibly clipped even though document overflow stayed zero.
  A focused responsive contract now requires the result title and four-filter grid to stack below
  920 px before the images can be accepted.
- The first compact-filter pass still placed four 68 px columns in one row. At 200% zoom on the
  Retina runner those columns exceed the effective content width, so the narrow contract now uses a
  two-by-two filter grid while wide layouts keep one four-button row.
- The two-column zoom image proved the shell's still-expanded sidebar can make the Discover content
  narrower than the overall viewport breakpoint predicts. The result shell now needs an inline-size
  container query: four columns wide, two below 920 px, and one when the actual result container is
  520 px or narrower.
- The final 200% screenshot keeps all filter controls in a one-column container-query layout, but
  the pre-existing shell does not collapse the sidebar when Electron page zoom changes. The main
  surface therefore shows a magnified crop of the result title even though document/main horizontal
  overflow stays zero. Fixing zoom-driven shell state is outside this renderer-only contract and is
  retained as the next accessibility gate.
- The final full-check rerun stopped immediately because the last responsive test edit had not yet
  been passed through Prettier. The scoped test/task files were formatted before rerunning the gate;
  no behavior changed.

## Status

**Complete** - Discover list-detail behavior, tests, current-run rendered evidence, and independent
review are closed. No commit/install/push occurred; the pre-existing zoom-driven sidebar-collapse
gap is the explicit next Shell accessibility gate.
