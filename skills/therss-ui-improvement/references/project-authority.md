# TheRSS UI Authority and Verification

## Required Authority Order

1. Current user decision and approved scope.
2. `AGENTS.md`.
3. `PRODUCT.md` and `GOALS.md` for product/user-visible behavior.
4. `docs/DEVELOPMENT_WORKFLOW.md` and the task's `CHANGE_CONTRACT.md`.
5. `docs/DESIGN.md`, `docs/ENGINEERING_PRACTICES.md`, relevant ADRs, typed contracts, tests, and current rendered evidence.
6. `skills/therss-ui-improvement/SKILL.md`.
7. Installed upstream taste guidance.

When sources disagree, prefer executable behavior, typed state, tests, current screenshots, and the higher authority. Record any contract change before editing acceptance tests.

## Product Invariants

- TheRSS is a single-user, local-first academic discovery desktop application.
- Discover, Saved, Settings, Data Analytics, Sources, and local search are product surfaces, not marketing sections.
- Compact list-detail scanning, per-source outcomes, provenance, cancellation, retry, and confirmation-gated writes are intentional.
- SQLite owns operational state. Renderer code receives typed preload data and no filesystem, process, database, or secret access.
- Source and model content is untrusted and evidence-bounded.

## UI Change Gate

For every non-trivial or user-visible change:

- record Feature Intake and product fit;
- build a deterministic prototype when interaction uncertainty exists;
- freeze RED tests, keyboard path, viewport/appearance matrix, rollback, and stop condition;
- implement the smallest slice with existing patterns;
- verify focused tests, `npm run check:architecture`, `npm run check`, relevant Electron E2E, and fresh rendered evidence;
- separately review accessibility, privacy, dependencies, diff scope, and evidence semantics.

## Current Stack

- Electron + Vite + React + TypeScript.
- Project-native CSS variables and component CSS.
- Apple-style semantic tokens, system accent support, per-view identity colors, semantic status colors, light/dark mode, increased contrast, forced colors, and reduced motion.
- Lucide is the existing icon family.

Treat a new design system, animation library, font, icon family, or styling framework as a dependency and architecture decision, not as visual polish.
