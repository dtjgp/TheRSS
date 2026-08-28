# Notes: gpt-taste Recheck

## Installation Evidence

- Installed path: `/Users/dtjgp/.codex/skills/gpt-tasteskill/SKILL.md`.
- Frontmatter name: `gpt-taste`.
- Pinned commit: `ccbc15639c97057cbfcf32ecebc38ef716e4bb37`.
- SHA-256: `2e64c269953f2656c21bf5a0fa6b4568e82fe0c72b36e8f84758e090349966a5`.
- Installed file matches the pinned repository snapshot exactly.
- `quick_validate.py`: `Skill is valid!`.
- Availability: automatically discoverable from the next turn; loaded directly for this audit.

## Renderer Evidence

- Current screenshots reviewed: active Discover wide/dark, terminal 820px, Discover 200% zoom,
  Settings, Analytics, and Sources.
- Current source reviewed: global buttons/tokens, Settings layout, Sources summary/cards/tags,
  Analytics table/bars, Discover/workspace typography, and all eyebrow usages.
- F1-F4 remain verified; no new critical/high regression was found in that slice.
- Exact counts: 16 `className="eyebrow"` usages; four `secondary-button` usages; zero
  `.secondary-button` style definitions.

## Classified Findings

- Adopt: headline wrapping, button distinguishability, card restraint, real overflow checks.
- Adapt: meta-label reduction, source card/tag density, zero-state presentation.
- Reject: simulated RNG, AIDA, mandatory GSAP, massive spacing, Tailwind/bento requirements,
  external imagery, font migration, and blanket overflow hiding.
- New findings: F9 missing secondary-button contract; F10 semantic eyebrow policy.
- Confirmed backlog: F6, F7, F8, then F5.
