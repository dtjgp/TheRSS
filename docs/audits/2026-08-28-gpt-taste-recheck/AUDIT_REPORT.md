# gpt-taste Audit Report for TheRSS

## Takeaway

The F1-F4 Discover hardening remains sound; this recheck found no critical regression in its wide,
narrow, dark, forced-colors, reduced-motion, or terminal states. The aggressive gpt-taste lens does
surface one new high-confidence implementation gap and sharpens the deferred F5-F8 backlog:

1. **New P1 finding F9:** `secondary-button` is used four times but has no CSS rule, so Cancel and
   other secondary actions fall back to browser-native rendering.
2. **Confirmed P1 candidate F6:** Settings uses marketing-page header scale and redundant labels,
   reducing expert-workflow density.
3. **Confirmed P2 candidates F7/F8/F5:** Sources card/tag density, Analytics zero-row repetition,
   and Discover detail-title scale deserve separate prototypes in that order.

No product code was changed by this audit.

## Audit Lens

gpt-taste was used as an adversarial critic, not as project authority. Its rules were translated
through the approved `Variance 3 / Motion 2 / Density 7` profile and TheRSS evidence/accessibility
contracts.

| gpt-taste directive                     | Classification | TheRSS decision                                                                      |
| --------------------------------------- | -------------- | ------------------------------------------------------------------------------------ |
| Two-to-three-line headline discipline   | Adopt          | Continue testing title wrapping and viewport occupancy.                              |
| Button contrast and visible interaction | Adopt          | Apply to the missing secondary-button contract.                                      |
| Avoid redundant meta-labels             | Adapt          | Remove only labels that duplicate the adjacent heading; retain evidence-tier labels. |
| Card restraint                          | Adapt          | Reduce repeated containers/tags only when scan speed improves.                       |
| Horizontal overflow prevention          | Adapt          | Keep real overflow assertions; reject blanket `overflow-x-hidden` masking.           |
| Python RNG layout selection             | Reject         | Randomness is not product reasoning or evidence.                                     |
| AIDA/hero/bento/footer structure        | Reject         | TheRSS is a desktop workflow, not a marketing funnel.                                |
| Mandatory GSAP and static-UI ban        | Reject         | Conflicts with Motion 2, reduced motion, performance, and dependency policy.         |
| Satoshi/Geist font replacement          | Reject         | A3 preserves the native SF Pro/system stack.                                         |
| Picsum imagery, marquees, inline images | Reject         | Conflicts with provenance, packaging, density, and product scope.                    |
| Massive section spacing                 | Reject         | Worsens the already identified Settings/Sources density issues.                      |

## Prioritized Findings

### F9 - Missing secondary-button component contract (P1, new)

**Evidence**

- Four usages exist: Discover retry, Settings connection actions, and Discover Cancel.
- No `.secondary-button` selector exists in the renderer stylesheets.
- Current light/dark screenshots show Cancel using platform/browser default geometry; in dark mode it
  visually resembles a disabled action even while enabled.

**Why it matters**

- Enabled, hover, pressed, focus-visible, busy, and disabled states are not consistently owned.
- Appearance can drift across Chromium/Electron/platform versions.
- The class name promises a design-system component that does not exist.

**Recommended next slice**

- Define one project-native secondary action style using existing semantic tokens and 7px selection
  geometry.
- Freeze enabled/hover/active/focus/disabled/dark/forced-colors states with CSS and Electron tests.
- Do not add a dependency or change action labels/behavior.

### F6 - Settings header and label density (P1 prototype candidate, confirmed)

**Evidence**

- Page padding reaches 82px; the H1 reaches 64px.
- `APPLICATION SETTINGS` duplicates the adjacent `Settings` heading.
- The same panel repeats `PERSONAL CONTEXT`, `Personal Discover prompt`, and the field label.

**Recommended prototype**

- Remove or demote the generic page eyebrow, reduce the H1 band, and bring the tab/form workspace
  into the first viewport.
- Preserve Personal/Provider tabs, field order, privacy copy, dirty-state behavior, and keyboard path.

### F7 - Sources card and tag density (P2 prototype candidate, confirmed)

**Evidence**

- Four equal metric cards precede a boundary callout, filter card, and two-column source-card grid.
- Source cards repeat multiple pill tags; priority/acquisition/axis metadata uses 9px, and metric
  labels use 10px.
- `RESEARCH SOURCE DIRECTORY` partially duplicates the source-count H1.

**Recommended prototype**

- Compare the current layout with a compact summary ledger and progressive axis disclosure.
- Preserve all 22-source membership, dated verification, health, attention, and evidence-boundary
  distinctions.

### F8 - Analytics zero-state emphasis (P2 prototype candidate, confirmed)

**Evidence**

- Six zero-activity days render identical rows and empty bar tracks before the active day.
- Table headers use 9px and the secondary `Latest 50 runs` label uses 10px.

**Recommended prototype**

- Preserve the complete seven-day ledger but reduce empty-track prominence or group consecutive
  zero days behind an accessible disclosure.
- Never omit, aggregate, or invent counts without clearly preserving exact dates and values.

### F5 - Discover detail-title scale (P2 prototype candidate, confirmed but lowest priority)

**Evidence**

- The selected result title scales to 48px in the detail pane and remains visually dominant in dark
  and zoomed evidence.
- Current overflow and keyboard tests pass, so this is an efficiency preference rather than a
  correctness defect.

**Recommended prototype**

- Compare the current 48px cap with a 36-40px cap while measuring visible evidence/action area and
  long-title wrapping. Preserve source titles verbatim.

### F10 - Cross-surface eyebrow policy (P2, new cross-cutting audit)

**Evidence**

- Sixteen renderer occurrences use the shared `eyebrow` pattern.
- Some are generic duplicates (`APPLICATION SETTINGS`, `DISCOVER RESULTS`,
  `RESEARCH SOURCE DIRECTORY`); others carry evidence meaning (`PROVENANCE LEDGER`, `EXPANDED PLAN`,
  `L1 PAPER ANALYSIS`).

**Recommendation**

- Do not apply gpt-taste's blanket meta-label ban.
- During F6/F7 prototypes, remove generic duplicates and preserve evidence-tier labels.

## Areas That Already Pass the Adversarial Review

- Discover active/terminal status remains truthful and non-chat-like.
- F1 unboxed terminal summary is compact and readable at 820px.
- F3 11px status microcopy is legible in light/dark evidence.
- F4 keeps Cancel outside the polite live-status subtree.
- Actual horizontal overflow is tested rather than hidden with CSS.
- System fonts, semantic colors, list-detail ownership, reduced motion, forced colors, and Lucide
  remain coherent with A1-A9.

## Recommended Order

1. F6 Settings compact-header prototype.
2. F7 Sources summary/tag-density prototype.
3. F8 Analytics zero-state prototype.
4. F5 Discover detail-title prototype.

F10 should be evaluated inside F6/F7 rather than launched as a broad global rewrite.

## Follow-up Status

- F9 completed under `docs/audits/2026-08-28-secondary-button-contract/`.
- All four existing usages now inherit one semantic enabled/hover/pressed/focus/disabled system.
- Full gate passed 61 files / 410 tests; Electron E2E passed 2/2; light/dark/forced-colors review
  passed.
- F6 completed under `docs/audits/2026-08-28-settings-density-prototype/`: the user-approved Compact
  option is implemented, with focused 29/29, full 61 files / 411 tests, and Electron E2E 2/2 green.
- F7/F8/F5 remain intentionally unmodified and require separate prototypes.
