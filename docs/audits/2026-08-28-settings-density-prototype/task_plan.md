# Task Plan: Settings Density Prototype

## Goal

Compare the current Settings hierarchy with one compact, project-native alternative, obtain a user
decision, and translate the approved Compact option into production with bounded verification.

## Task Contract

- Objective: deterministic Current/Compact Settings prototype with measurable first-viewport density.
- Evidence to read first: live Settings source/tests/CSS, current wide/dark/forced-color screenshots, approved 3/2/7 taste profile, and F6 audit.
- Allowed scope: this task directory, Playwright prototype artifacts, Settings JSX/CSS, and focused
  Settings/style/Electron acceptance tests.
- Frozen scope: field/tab/action behavior, safety/privacy copy, dependencies, data/storage/IPC,
  F7/F8/F5, package/install, commit, push, and publication.
- Verifier: interactive mode switch; actual workspace-start measurement; 1360x880 current/compact, 820x700 compact, dark, forced-colors, keyboard, and overflow checks.
- Decision gate: user chooses Current, Compact, or requests a bounded revision.
- Stop condition: the approved Compact slice passes focused, full, Electron, rendered,
  accessibility, architecture, and independent-review gates.
- Persistent writeback: this directory plus `output/playwright/settings-density-prototype/`.

## Phases

- [x] Phase 1: Inspect current Settings evidence and freeze invariants.
- [x] Phase 2: Build the deterministic comparison prototype.
- [x] Phase 3: Render and verify the appearance/accessibility matrix.
- [x] Phase 4: Present the user decision gate.
- [x] Phase 5: Implement the approved Compact production slice with RED/GREEN TDD.
- [x] Phase 6: Run full, Electron, rendered, accessibility, and independent-review gates.

## Key Questions

1. Does removing generic duplicate eyebrows improve density without weakening orientation?
2. Does the compact page header move meaningful controls into the first viewport?
3. Do narrow, dark, forced-color, focus, and privacy-copy contracts remain intact?

## Decisions Made

- Recommended direction: refined native research utility, not AIDA/GSAP/marketing.
- Preserve SF Pro/system fonts, purple Settings identity, tabs, form fields, privacy copy, actions, and dirty-state semantics.
- Compare only Current and one targeted Compact option; avoid a menu of speculative redesigns.
- F7/F8/F5 remain deferred.
- The user approved Compact for production implementation; Current remains historical prototype
  evidence only.

## Errors Encountered

- Playwright CLI initially failed with npm `ENOTFOUND` in the restricted network environment; the
  authorized rerun fetched the CLI package successfully.
- The first local URL was unquoted, so zsh treated `?mode=compact` as a glob. Quoting the URL fixed
  the launch without changing the prototype.
- The first `run-code` used a statement instead of the required `(page) => {}` function form; the
  corrected function form enabled media emulation.
- The initial session logged a favicon 404. An inline empty favicon removed the error; the clean
  session opened with zero console errors.
- The first production Electron run used case-insensitive text matching for `PERSONAL CONTEXT`,
  which also matched the preserved `Personal context` tab. The corrected assertion targets absent
  heading eyebrow elements directly and keeps the tab contract intact.

## Status

**Complete** - Compact is implemented; focused, full, Electron, rendered, accessibility,
architecture, security-boundary, and independent-review gates passed. F7/F8/F5 remain deferred.
