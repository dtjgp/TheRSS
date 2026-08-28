# Task Plan: taste-skill Integration and TheRSS Improvement

## Goal

Install the upstream `design-taste-frontend` skill, integrate its useful design-review guidance with TheRSS's authoritative product and engineering contracts, expose every material conflict for user judgment, and apply only the approved improvement slice.

## Task Contract

- Objective: one verified upstream installation plus one project-local integration layer and decision register.
- Evidence to read first: current Git status/diff; `AGENTS.md`, `PRODUCT.md`, `GOALS.md`, `docs/DEVELOPMENT_WORKFLOW.md`; active external-UI audit; upstream pinned skill.
- Allowed scope before user judgment: global skill installation, task-local documentation, project-local skill/integration artifacts, validation, and read-only UI assessment.
- Frozen product scope before judgment: no dependency additions, renderer behavior changes, product copy changes, IPC/storage/network/security changes, package install, Git commit, push, or publication.
- Verifier: installed-path/hash check; project-local skill validation; conflict matrix with evidence, options, recommendation, and default-safe consequence.
- Decision gate: user chooses disputed product/design policies and the first approved UI improvement slice.
- Stop condition: stop at the decision gate before product UI edits, then resume with a reviewed change-contract revision and RED/GREEN implementation.
- Persistent writeback: this directory plus the project-local skill directory selected during integration.

## Phases

- [x] Phase 1: Inspect live state, preserve concurrent work, and freeze scope.
- [x] Phase 2: Install and verify the pinned upstream skill.
- [x] Phase 3: Build and validate the TheRSS project-local integration layer.
- [x] Phase 4: Produce the conflict and decision register.
- [x] Phase 5: Present the decision gate to the user.
- [x] Phase 6: Apply only the user-approved F1-F4 improvement with TDD and rendered verification.

## Key Questions

1. Which upstream rules are compatible with TheRSS's dense, evidence-bearing desktop UI?
2. Which rules conflict with semantic status colors, source-text fidelity, project-native CSS, accessibility, or the active Discover slice?
3. How should the project prevent the global upstream skill from becoming a second product authority?
4. Which concrete UI improvement should be implemented first after user approval?

## Decisions Made

- Keep `PRODUCT.md`, `GOALS.md`, `AGENTS.md`, the canonical development workflow, accepted change contracts, tests, and rendered evidence above the external skill.
- Install only the requested default `design-taste-frontend` skill rather than the repository's entire overlapping skill portfolio.
- Pin installation to the inspected upstream commit instead of following experimental `main` silently.
- Preserve all pre-existing and concurrently advancing UI changes.
- The user accepted A1-A9 and authorized F1-F4; F5-F8 remain deferred.

## Errors Encountered

- System `python3` could not run `quick_validate.py` because `PyYAML` was absent. Re-ran the same validator with `/Users/dtjgp/miniconda3/bin/python`, which has PyYAML 6.0.2; validation passed.
- The initializer could not create `.agents/skills` because the project `.agents` path is read-only. Used the project `skills/` canonical workflow surface and added explicit `AGENTS.md` routing instead; no permissions were changed.
- The lightweight skill-audit helper initially misparsed Markdown link labels as file paths. Simplified labels and retained `quick_validate.py` plus explicit reference existence checks as the authoritative structural verifier.

## Status

**Complete** - A1-A9 are durable policy; F1-F4 passed RED/GREEN, full, Electron, rendered, and
independent-review gates; F5-F8 remain deferred.
