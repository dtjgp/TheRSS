# TheRSS Taste Profile

## Translation Boundary

The upstream skill explicitly treats dashboards, dense product UI, data tables, and multi-step product UI as out of scope. TheRSS belongs to that class. Use only its redesign/audit, state, accessibility, dependency, and restraint guidance; do not apply its marketing-page pre-flight matrix wholesale.

## Approved Design Read

`Existing local-first research desktop for one expert user; quiet editorial/native utility; targeted evolution; project-native semantic CSS; high information density with restrained feedback motion.`

Approved desktop-product dials:

- `DESIGN_VARIANCE: 3` - stable geometry and predictable scanning paths.
- `MOTION_INTENSITY: 2` - hover, pressed, focus, and truthful state transitions only.
- `VISUAL_DENSITY: 7` - compact expert workflow without cockpit clutter.

The user accepted these values on 2026-08-28. Reopen the decision gate before changing them or applying a separate profile.

## Adopt

- Infer product context and audience before proposing aesthetics.
- Audit before redesign; preserve information architecture, brand tokens, keyboard paths, accessibility wins, and analytics/test identifiers.
- Prefer targeted evolution and stop when the demonstrated problem is solved.
- Verify dependencies before imports and keep one coherent component/design system.
- Design truthful loading, empty, error, canceling, partial, stopped, and terminal states.
- Use semantic HTML, visible focus, tabular numerals for counts, explicit narrow behavior, and restrained card/elevation usage.
- Animate transform/opacity only when animation communicates hierarchy, feedback, or state; respect reduced motion and clean up effects.
- Re-read visible product copy and reject invented precision or decorative pseudo-data.

## Adapt

| Upstream rule                     | TheRSS translation                                                                                                                                         |
| --------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------- |
| One accent color                  | One decorative/view accent may coexist with semantic success, warning, error, saved, and source colors.                                                    |
| Long lists need another component | Dense research lists remain valid; improve grouping, selection, truncation, and detail disclosure without converting them to marketing cards or carousels. |
| No progress bars with tracks      | Native progress is correct when it truthfully represents completed sources; the ban applies only to decorative comparison graphics.                        |
| Avoid status dots                 | Keep markers only when they encode real source/run state and have non-color text/ARIA equivalents.                                                         |
| No pure black/white               | Existing platform-semantic dark/light tokens remain authoritative; review contrast instead of banning values.                                              |
| One theme per page                | Keep coherent system light/dark rendering and per-view identity within the same semantic token system.                                                     |
| Use real imagery                  | Product UI does not require imagery. Add only an approved brand or empty-state asset with source, license, alt text, and package review.                   |

## Reject

- Landing-page hero, logo-wall, testimonial, pricing, CTA, AIDA, bento, marquee, scroll-hijack, and social-proof mandates.
- Automatic Tailwind, Motion, GSAP, Three.js, shadcn, Fluent, Carbon, Radix, font, or icon installation.
- Global em-dash/en-dash rewriting or any mutation of source-provided text.
- Synthetic "organic" names, avatars, metrics, counts, source outcomes, or timing presented as real.
- Mandatory generated photography or external placeholder images inside the desktop application.
- Replacing the accessible sidebar or list-detail workspace because a different layout looks more novel.
- Treating visual variety as higher priority than provenance, scan speed, failure recovery, or keyboard consistency.

## Installed Upstream Pin

- Path: `/Users/dtjgp/.codex/skills/taste-skill/SKILL.md`
- Frontmatter name: `design-taste-frontend`
- Source commit: `ccbc15639c97057cbfcf32ecebc38ef716e4bb37`
- SHA-256: `aa194351b246b8b4799099d4ed7b033d29eab6e6e3d58d8d2172978be7b3ec89`

Do not silently update the pin. Re-audit upstream changes before replacement.
