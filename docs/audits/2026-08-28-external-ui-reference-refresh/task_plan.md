# Task Plan: External UI Reference Refresh

## Goal

Evaluate the UI references named in X post `2092937412490260513`, adopt only patterns that improve
TheRSS's Discover-centered research workflow, and finish with tested, rendered, reviewer-safe UI
changes or a documented no-change decision.

## Task Contract

- Objective: improve the current renderer without changing evidence, storage, IPC, or source
  semantics.
- Evidence to read first: the X post and its referenced sites; current `PRODUCT.md` and `GOALS.md`;
  the current renderer source/tests; fresh wide and narrow screenshots.
- Allowed scope: renderer layout, styling, and accessibility tests directly justified by the
  reference audit; task-local documentation and evidence.
- Verifier: focused RED/GREEN tests, architecture check, full `npm run check`, relevant Electron
  E2E, and fresh rendered evidence across the frozen viewport/appearance matrix.
- Stop condition: the accepted UI slice is implemented and all required gates pass, or the audit
  proves that adopting the references would conflict with TheRSS product constraints.
- Persistent writeback: this directory's plan, notes, change contract, audit report, and evidence.

## Phases

- [x] Phase 1: Read governing workflow and establish durable task artifacts.
- [x] Phase 2: Retrieve the X post and inspect every referenced UI site.
- [x] Phase 3: Audit the current TheRSS renderer and capture baseline evidence.
- [x] Phase 4: Freeze the capability and acceptance contract.
- [x] Phase 5: Build a fixture-backed prototype and review the interaction hierarchy.
- [x] Phase 6: Implement the accepted slice with RED/GREEN TDD.
- [x] Phase 7: Run automated, Electron, visual, accessibility, and diff verification.
- [x] Phase 8: Record independent review and evidence closeout.
- [x] Phase 9: Execute the user-approved taste hardening F1-F4 with RED/GREEN TDD.
- [x] Phase 10: Re-run full, Electron, visual, accessibility, and independent-review gates.

## Key Questions

1. Which referenced patterns solve a real TheRSS scanning, hierarchy, or provenance problem?
2. Which patterns are merely decorative, web-first, or incompatible with a local desktop tool?
3. Can the accepted direction preserve keyboard navigation, narrow layouts, system accent, reduced
   motion, and existing Discover/Saved/Sources behavior?

## Decisions Made

- Keep the task renderer-only unless the audit exposes a separately reviewed need; no SQLite, IPC,
  source-adapter, provider, packaging, or external-write scope is authorized.
- Treat visual references as inspiration, never as evidence that a copied pattern is usable or
  accessible in TheRSS.
- Do not publish, push, install, or mutate any third-party service in this task.
- Adopt a bounded Discover run-pipeline treatment: three truthful stages (plan, search selected
  sources, assemble the persisted session), a native progress bar, latest completed-source context,
  and a compact terminal run summary.
- Re-derive the pattern in existing React/CSS. Do not install Tailwind, Motion, shadcn, a registry
  component, or a third-party transition skill.
- Keep the existing query form, list-detail workspace, result filters, search-details disclosure,
  and all data/IPC semantics intact.
- Use `Recorded Discover run stages`, not `Completed`, for the terminal list label so partial and
  canceled persisted sessions are not semantically upgraded.
- Adopt the durable TheRSS taste profile `Variance 3 / Motion 2 / Density 7`, preserve the current
  stack/tokens/IA, execute F1-F4 now, and defer F5-F8 to separate prototype decisions.

## Errors Encountered

- The first baseline Electron E2E run failed because the restricted sandbox could not launch or
  terminate Electron (`EPERM`). The same current checkout passed 2/2 when rerun with desktop launch
  permission; this is an environment boundary, not a product failure.
- First post-GREEN static gates found only scoped mechanical issues: Prettier reported five new task
  files; lint rejected reading `activeRunId.current` during render; TypeScript required non-null
  assertions after the test had already proved a three-item array. The renderer fallback now relies
  on the synchronously set progress state, test indexing is explicit, and scoped formatting is being
  applied.
- The first post-fix targeted Electron rerun still read `white-space: normal` because direct
  `playwright test` uses the existing built renderer; rebuilding before the same verifier produced
  the updated CSS and the test passed. Final verification uses the canonical build-first scripts.
- The F1-F4 first GREEN run reduced seven expected failures to one test-harness error: a Vitest DOM
  query used Playwright's `toHaveCount` matcher. Replacing it with the equivalent
  `not.toBeInTheDocument()` preserves the frozen no-list contract.
- The first delayed Electron run passed the new active-state matrix but exposed a stale terminal
  wait in the later personalized search: the old snapshot already contained `Search complete`.
  The E2E now waits for the second pipeline to appear and disappear before reading its new terminal
  provenance.
- The corrected personalized-search wait initially used Playwright's 5-second default while the
  intentionally delayed 22-source fixture has a roughly 5.25-second upper bound. Only that fixture
  completion assertion now uses a 10-second timeout; production behavior and the global test timeout
  are unchanged.

## Status

**Complete after the approved F1-F4 extension** — focused/full/Electron/rendered/accessibility gates
pass; F5-F8 remain deferred for separate prototype review.
