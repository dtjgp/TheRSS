# Notes: taste-skill Integration

## Evidence Status

- Current worktree inspected before writes.
- Existing external-UI audit and renderer/E2E changes are user-owned concurrent work.
- Upstream default skill was inspected in the prior evaluation at commit `ccbc15639c97057cbfcf32ecebc38ef716e4bb37`.

## Installation Evidence

- Installed path: `/Users/dtjgp/.codex/skills/taste-skill/SKILL.md`.
- Installed frontmatter name: `design-taste-frontend`.
- Pinned source commit: `ccbc15639c97057cbfcf32ecebc38ef716e4bb37`.
- Installed SHA-256: `aa194351b246b8b4799099d4ed7b033d29eab6e6e3d58d8d2172978be7b3ec89`.
- The installed file exactly matches the pinned raw source snapshot.
- `quick_validate.py` result: `Skill is valid!` using `/Users/dtjgp/miniconda3/bin/python` with PyYAML 6.0.2.
- Availability boundary: the installer reports that the new global skill becomes available for automatic discovery on the next turn.

## Integration Evidence

- Project adapter: `skills/therss-ui-improvement/SKILL.md`.
- Progressive-disclosure references: `project-authority.md`, `taste-profile.md`, and `decision-gates.md`.
- `AGENTS.md` now routes upstream taste use through the project adapter and states project authority.
- `quick_validate.py`: passed.
- Project adapter word count: 627 words before final formatting; the upstream 12.8k-word monolith is not copied into the repository.
- The first skill-audit helper scan reported false missing references because the Markdown link labels repeated the target path. Link labels were simplified; a manual file-existence check and rerun are required.

## Conflict Findings

- Upstream one-accent rule conflicts with TheRSS semantic state and per-view colors.
- Upstream long-list/progress bans are marketing-specific; TheRSS lists and native progress communicate real workflow state.
- Upstream Tailwind/Motion/GSAP/font/icon defaults conflict with the existing Electron/Vite/native-CSS/Lucide stack.
- Upstream punctuation and synthetic-data guidance cannot modify evidence-bearing source text or counts.
- Upstream generated-image mandate is not applicable to the desktop product.
- Upstream redesign protocol, dependency checks, state completeness, reduced-motion, contrast, and targeted-evolution guidance are compatible after adaptation.
- Current renderer review found eight candidate issues; see `DECISION_REGISTER.md`.

## Validation Evidence

- Upstream installed file matches the pinned SHA-256.
- Project-local `quick_validate.py`: `Skill is valid!`.
- Lightweight audit: `word_count=622`, `missing_refs=0`.
- Scoped Prettier check: all files matched.
- `git diff --check -- AGENTS.md`: passed.
- Before approval, existing wide, 820 px, dark, and forced-colors screenshots were inspected
  read-only. After approval, the F1-F4 task generated new active-state screenshots and completed the
  full verifier below.

## Approved F1-F4 Evidence

- Focused RED: 7 failed / 38 passed across the component, App integration, and CSS contracts.
- Focused GREEN: 3 files / 45 tests passed.
- Full gate: 61 files / 409 tests passed; 90.29% statements, 80.15% branches, 93.64% functions,
  93.20% lines; format, lint, types, architecture, coverage, and builds passed.
- Electron: build-first 2/2 passed after the E2E fixture helper refactor.
- Fresh evidence: `01b-discover-planning.png`, `01c-discover-searching.png`,
  `01d-discover-searching-820.png`, `01e-discover-searching-dark.png`,
  `01f-discover-searching-forced-colors.png`, and the simplified terminal summary in
  `02a-discover-results-820.png`.
- Accessibility: live status contains no button; outer region retains Cancel; reduced motion forces
  one animation iteration; forced-colors output preserves textual state and control boundaries.
- Scope: no dependency, package, storage, IPC, source, provider, vault, installed-app, or publication
  change.
