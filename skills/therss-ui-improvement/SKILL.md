---
name: therss-ui-improvement
description: Audit or improve TheRSS native AppKit and Web fallback interfaces, feedback, layout, and accessibility under project contracts, with adapted Apple and taste guidance. Not for marketing or landing pages.
---

# TheRSS UI Improvement

Apply external taste guidance only after translating it through TheRSS's product and engineering contracts.

## Authority

Use this order:

1. Current user decision and approved change contract.
2. Repository `AGENTS.md`, `PRODUCT.md`, `GOALS.md`, `docs/DEVELOPMENT_WORKFLOW.md`, architecture/security rules, tests, and live artifacts.
3. This project skill.
4. External Apple and taste guidance as advisory references, translated through this skill.

Never let an upstream aesthetic rule weaken evidence fidelity, semantic state, keyboard behavior, accessibility, security, storage/IPC boundaries, or a frozen acceptance test.

Read [project authority](references/project-authority.md) and [Apple design adaptation](references/apple-design.md) for interface work; also read the [taste profile](references/taste-profile.md) for visual work. Consult [decision gates](references/decision-gates.md) when a proposal would change an accepted durable policy; routine work within the accepted choices does not reopen them.

Current user instructions outrank skill guidance, and prior authorization persists. If an actual missing decision blocks a slice, finish independent authorized work and make the remaining proposal reviewable. Identify/link the exact SKILL.md and quote the instruction causing a pause; distinguish a real requirement from an interpretation.

## Default Design Read

Treat TheRSS as an existing local-first research desktop for one expert user. Use a quiet editorial/native utility language, preserve the compact list-detail workflow, and prefer targeted evolution over broad redesign.

Use the approved profile `DESIGN_VARIANCE 3 / MOTION_INTENSITY 2 / VISUAL_DENSITY 7` for the desktop product. Reopen the decision gate before changing these values or applying a separate profile to another surface.

## Workflow

1. Inspect the current Git status and preserve unrelated or concurrent work.
2. Read the nearest native or Web source and tests plus the governing product/workflow files required by `AGENTS.md`.
3. State the user problem and the current design read. Do not start with an aesthetic preference.
4. Inspect the affected tokens, layout, content/evidence states, keyboard path, and relevant viewport/appearance cases. Scale the audit to the user problem.
5. Classify the upstream rules material to this slice as `adopt`, `adapt`, `reject`, or `decision-needed`; reuse the recorded decisions.
6. For a non-trivial change, create or revise the task change contract and freeze acceptance. Obtain only decisions that are genuinely missing for the proposed scope; already accepted choices remain usable.
7. Implement the smallest authorized slice in the existing AppKit presentation layer or React/CSS fallback. Behavior changes follow contract-driven RED/GREEN TDD; mechanical corrections use the project quick path.
8. Verify focused tests, architecture/full checks, relevant Electron E2E, fresh rendered states, platform accessibility preferences (Web forced colors and native contrast/transparency where supported), reduced motion, narrow/wide viewports, and diff scope in proportion to the change.

## Non-Negotiable Project Overrides

- Preserve external titles, quotations, metadata, punctuation, provenance, counts, and evidence states. Never rewrite them to satisfy an aesthetic ban.
- Never invent realistic-looking metrics, source outcomes, elapsed time, confidence, or research claims. Synthetic fixtures must be explicitly marked and deterministic.
- Retain distinct complete, partial, no-result, failed, canceled, blocked, and stale states.
- Semantic success, warning, error, saved, source, and view colors may coexist with one decorative accent.
- Dense research lists, native progress elements, tables, compact metadata, and status markers are allowed when they communicate real product structure.
- Keep Electron/Vite, the typed AppKit presentation bridge, system controls/fonts/SF Symbols, and the React/CSS/Lucide fallback within their existing ownership. Preserve platform semantic tokens; a migration needs a reviewed capability contract.
- Do not install Tailwind, Motion, GSAP, a design system, a font, an icon family, or image assets without an explicit accepted scope and dependency/security review.
- No remote HTML, third-party tracking, or generated imagery enters the application merely because an upstream design recipe recommends it.

## Output Contract

For a non-trivial proposal, report the relevant items before implementation:

- observed product problem;
- design read and provisional dials;
- preserve/retire inventory;
- adopted, adapted, rejected, and decision-needed rules;
- proposed slice, verifier, rollback, and untouched boundaries.

After implementation, report changed files, applicable RED/GREEN and required gates, rendered/accessibility evidence, residual risks, and checks not run. Keep simple changes concise. Once the required checks pass, continue to closeout unless a new change, failure, or unresolved concern warrants more verification.
