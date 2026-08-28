# Task Plan: gpt-taste Recheck

## Goal

Install the pinned `gpt-taste` skill and use it as an adversarial visual reviewer of the current TheRSS renderer, while keeping the approved TheRSS profile and product contracts authoritative.

## Task Contract

- Objective: one verified skill installation plus one evidence-backed read-only audit.
- Evidence to read first: installed skill, project taste adapter, current source/tests, latest wide/narrow/dark/forced-color screenshots, and current Git state.
- Allowed scope: global skill installation and task-local audit documentation.
- Frozen scope: no renderer, dependency, product, test, package, Git publication, or installed-app change.
- Verifier: installed hash/validator; screenshot-backed adopt/adapt/reject matrix; prioritized findings with evidence boundary.
- Stop condition: every relevant gpt-taste finding is classified against A1-A9 and only credible TheRSS improvements remain.
- Persistent writeback: this task directory.

## Phases

- [x] Phase 1: Freeze read-only scope and preserve the current worktree.
- [x] Phase 2: Install and validate pinned gpt-taste.
- [x] Phase 3: Audit current renderer evidence with gpt-taste.
- [x] Phase 4: Filter findings through TheRSS authority and deliver the report.

## Key Questions

1. Which gpt-taste criticisms identify a real expert-workflow problem?
2. Which recommendations are marketing/Awwwards defaults that A1-A9 already reject?
3. Do F5-F8 remain the right backlog, and what should be prioritized next?

## Decisions Made

- Install only `skills/gpt-tasteskill`, not the whole upstream portfolio.
- Pin to the same inspected upstream commit as `design-taste-frontend`.
- Treat simulated RNG, AIDA, mandatory GSAP, massive spacing, imagery, and static-UI bans as adversarial prompts, not project requirements.

## Errors Encountered

- A broad Prettier check reported style differences in the pinned upstream `gpt-taste/SKILL.md`.
  The upstream file was deliberately left byte-identical; the scoped local audit files passed
  Prettier.

## Status

**Complete** - the read-only adversarial audit is classified and documented; no product file was
changed.
