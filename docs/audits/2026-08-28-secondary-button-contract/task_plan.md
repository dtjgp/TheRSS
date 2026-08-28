# Task Plan: Secondary Button Contract

## Goal

Replace the browser-default rendering behind the four existing `secondary-button` usages with one project-native, accessible, tested state contract.

## Task Contract

- Objective: define and verify enabled, hover, active, focus-visible, disabled, dark, and forced-colors secondary actions.
- Evidence to read first: `AGENTS.md`, UI workflow/contract, gpt-taste audit, button usages, global semantic tokens, style tests, and current Electron screenshots.
- Allowed scope: global renderer CSS, CSS contract test, existing Electron assertions/screenshots, and task-local documentation.
- Frozen scope: action labels/handlers, React component structure, dependencies, navigation/layout, F6-F8/F5, storage, IPC, package/install, commit, push, and publication.
- Verifier: focused RED/GREEN style test; full `npm run check`; build-first Electron E2E; light/dark/forced-colors visual review; diff/security scan.
- Stop condition: all four usages inherit the same visible state contract with no behavior or boundary change.
- Persistent writeback: this directory and the scoped source/test changes.

## Phases

- [x] Phase 1: Inspect the live button gap and freeze scope.
- [x] Phase 2: Add the failing CSS/Electron acceptance contract.
- [x] Phase 3: Implement the smallest semantic CSS behavior.
- [x] Phase 4: Run full, Electron, visual, and independent-review gates.

## Decisions Made

- Use existing Apple semantic tokens and `--selection-radius`; do not add a component library.
- Keep Motion 2: hover/active transitions only; no GSAP, scale physics, or layout motion.
- Keep the global focus-visible outline as the canonical focus treatment.
- F6-F8/F5 remain deferred and untouched.

## Errors Encountered

- None.

## Status

**Complete** - focused/full/Electron/rendered/security/diff gates pass; F6-F8/F5 remain deferred.
