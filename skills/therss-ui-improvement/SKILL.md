---
name: therss-ui-improvement
description: Review or improve TheRSS renderer UI using the installed design-taste-frontend skill as advisory input. Use for TheRSS UI audits, redesigns, interaction polish, visual hierarchy, responsive behavior, or accessibility-visible changes. Preserve the local-first research product, evidence states, Electron/React/native-CSS stack, and contract-driven TDD workflow. Not for marketing or landing pages.
---

# TheRSS UI Improvement

Apply external taste guidance only after translating it through TheRSS's product and engineering contracts.

## Authority

Use this order:

1. Current user decision and approved change contract.
2. Repository `AGENTS.md`, `PRODUCT.md`, `GOALS.md`, `docs/DEVELOPMENT_WORKFLOW.md`, architecture/security rules, tests, and live artifacts.
3. This project skill.
4. Installed `/Users/dtjgp/.codex/skills/taste-skill/SKILL.md` (`design-taste-frontend`) as advisory reference.

Never let an upstream aesthetic rule weaken evidence fidelity, semantic state, keyboard behavior, accessibility, security, storage/IPC boundaries, or a frozen acceptance test.

Read [project authority](references/project-authority.md) for every use. Read the [taste profile](references/taste-profile.md) before any visual recommendation or edit. Read [decision gates](references/decision-gates.md) when a proposal touches dependencies, typography, icons, motion, density, information architecture, imagery, punctuation, or color semantics.

## Default Design Read

Treat TheRSS as an existing local-first research desktop for one expert user. Use a quiet editorial/native utility language, preserve the compact list-detail workflow, and prefer targeted evolution over broad redesign.

Use the approved profile `DESIGN_VARIANCE 3 / MOTION_INTENSITY 2 / VISUAL_DENSITY 7` for the desktop product. Reopen the decision gate before changing these values or applying a separate profile to another surface.

## Workflow

1. Inspect the current Git status and preserve unrelated or concurrent work.
2. Read the nearest renderer source and tests plus the governing product/workflow files required by `AGENTS.md`.
3. State the user problem and the current design read. Do not start with an aesthetic preference.
4. Audit brand tokens, information architecture, content/state blocks, accessibility wins, failure states, and the active viewport matrix.
5. Classify every upstream rule as `adopt`, `adapt`, `reject`, or `decision-needed` using the references.
6. For a non-trivial change, create or revise the task change contract, freeze acceptance, and obtain required user decisions before code.
7. Implement the smallest approved slice with RED/GREEN TDD in the existing Electron/React/native-CSS stack.
8. Verify focused tests, architecture/full checks, relevant Electron E2E, fresh rendered states, forced colors, reduced motion, narrow/wide viewports, and diff scope in proportion to the change.

## Non-Negotiable Project Overrides

- Preserve external titles, quotations, metadata, punctuation, provenance, counts, and evidence states. Never rewrite them to satisfy an aesthetic ban.
- Never invent realistic-looking metrics, source outcomes, elapsed time, confidence, or research claims. Synthetic fixtures must be explicitly marked and deterministic.
- Retain distinct complete, partial, no-result, failed, canceled, blocked, and stale states.
- Semantic success, warning, error, saved, source, and view colors may coexist with one decorative accent.
- Dense research lists, native progress elements, tables, compact metadata, and status markers are allowed when they communicate real product structure.
- Keep React, Electron/Vite, project-native CSS, current icon ownership, and existing design tokens unless a reviewed capability contract proves a migration need.
- Do not install Tailwind, Motion, GSAP, a design system, a font, an icon family, or image assets without an explicit accepted scope and dependency/security review.
- No remote HTML, third-party tracking, or generated imagery enters the application merely because an upstream design recipe recommends it.

## Output Contract

Before implementation, report:

- observed product problem;
- design read and provisional dials;
- preserve/retire inventory;
- adopted, adapted, rejected, and decision-needed rules;
- proposed slice, verifier, rollback, and untouched boundaries.

After implementation, report changed files, RED/GREEN and full gates, rendered/accessibility evidence, residual risks, and checks not run.
