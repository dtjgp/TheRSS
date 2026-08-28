# TheRSS Taste Decision Gates

Use this reference when an external taste recommendation would change a durable product policy. Present the issue, options, recommendation, and default-safe behavior before code.

## D1: Durable Visual Profile

- Option A: `3 / 2 / 7` - stable, restrained, dense expert tool.
- Option B: `4 / 3 / 6` - slightly more expressive spacing and motion.
- Option C: broader redesign profile chosen per surface.
- Recommendation: A for the desktop product; revisit separately for any future public website.
- Default-safe behavior: keep the current design and use A only for read-only audit language.

## D2: UI Dependencies

- Option A: no new visual dependency; native CSS and current React components.
- Option B: allow one narrowly justified animation or primitive library after a technical spike.
- Option C: adopt a full component/design system.
- Recommendation: A; B only for a demonstrated behavior the current stack cannot implement safely.
- Default-safe behavior: no package change.

## D3: Typography

- Option A: retain SF Pro/system font stack and tabular figures.
- Option B: self-host one approved display/text family.
- Recommendation: A for native desktop consistency and zero asset/dependency cost.
- Default-safe behavior: preserve current tokens.

## D4: Color Semantics

- Option A: retain system accent, per-view identity, and semantic status colors.
- Option B: collapse to one global accent plus neutral status treatment.
- Recommendation: A because colors encode real state and product location.
- Default-safe behavior: preserve current semantic roles and verify non-color equivalents.

## D5: Information Density and Layout

- Option A: preserve sidebar plus compact list-detail workspaces.
- Option B: recompose one proven-problem surface while keeping navigation and data contracts.
- Option C: broad card/grid redesign.
- Recommendation: A, with B only after a fixture prototype proves better scanning or comprehension.
- Default-safe behavior: no IA change.

## D6: Motion

- Option A: CSS-only state emphasis at intensity 2, with reduced-motion fallback.
- Option B: richer transition layer at intensity 3-4.
- Option C: Motion/GSAP scroll or physics effects.
- Recommendation: A; TheRSS is a workflow tool, not a scroll narrative.
- Default-safe behavior: no new animation beyond existing truthful feedback.

## D7: Icons

- Option A: retain Lucide and the existing standardized stroke weight.
- Option B: migrate to Phosphor or another family.
- Recommendation: A; migration has broad regression and maintenance cost without a proven user outcome.
- Default-safe behavior: keep Lucide and do not mix families.

## D8: Text and Punctuation

- Option A: preserve normal product punctuation and source-provided content.
- Option B: apply the upstream zero-em-dash rule only to newly authored marketing copy.
- Recommendation: A inside the application; B may be reconsidered for a separate website.
- Default-safe behavior: never rewrite evidence-bearing text.

## D9: Imagery

- Option A: no generated/product photography inside the desktop app.
- Option B: one approved empty-state or onboarding illustration with provenance and packaging review.
- Recommendation: A until a concrete empty-state problem is demonstrated.
- Default-safe behavior: no image generation or remote placeholder URL.

## D10: First Improvement Slice

- Option A: complete and taste-audit the active Discover three-stage run pipeline.
- Option B: audit Settings form hierarchy and status feedback.
- Option C: audit Sources scanning density and attention states.
- Option D: broad renderer redesign.
- Recommendation: A because the contract, prototype, RED/GREEN tests, and concurrent implementation already exist.
- Default-safe behavior: finish/review the active slice before starting another renderer change.
