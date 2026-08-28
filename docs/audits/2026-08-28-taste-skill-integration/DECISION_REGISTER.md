# taste-skill Integration Decision Register

## Outcome

The upstream default skill is installed and pinned. The project-local adapter validates and keeps TheRSS contracts authoritative. After the user decision, F1-F4 were implemented under the active UI contract without a package dependency, application install, commit, push, or publication.

The user accepted A1-A9 on 2026-08-28 and authorized F1-F4 as the first implementation slice. F5-F8 remain deferred for separate prototype review.

## Installed Source

- Global path: `/Users/dtjgp/.codex/skills/taste-skill/SKILL.md`
- Skill name: `design-taste-frontend`
- Commit: `ccbc15639c97057cbfcf32ecebc38ef716e4bb37`
- SHA-256: `aa194351b246b8b4799099d4ed7b033d29eab6e6e3d58d8d2172978be7b3ec89`
- Project adapter: `skills/therss-ui-improvement/SKILL.md`

## Decision Items

Approved package (`A1` through `A9`):

| ID  | Question                   | A: recommended                                                   | B/C alternatives                                               | Consequence                                                                            |
| --- | -------------------------- | ---------------------------------------------------------------- | -------------------------------------------------------------- | -------------------------------------------------------------------------------------- |
| A1  | Durable visual profile     | `Variance 3 / Motion 2 / Density 7`                              | `4/3/6`, or per-surface redesign                               | A preserves expert scan paths; alternatives add expression and verification cost.      |
| A2  | UI dependencies            | No new visual dependency                                         | One proven library after spike; full design system             | Alternatives change package/security/architecture scope.                               |
| A3  | Typography                 | Keep SF Pro/system stack                                         | Self-host Geist/Satoshi or another family                      | Alternative changes native feel, assets, layout metrics, and package QA.               |
| A4  | Colors                     | Keep system accent, per-view identity, and semantic state colors | Collapse toward one accent                                     | Alternative weakens visible source/run/state distinctions unless redesigned carefully. |
| A5  | Layout/density             | Preserve sidebar and list-detail workspaces                      | Recompose one proven-problem surface; broad card/grid redesign | B requires a prototype; C is a new product redesign.                                   |
| A6  | Motion                     | CSS-only state feedback at intensity 2                           | Richer transitions; Motion/GSAP                                | Alternatives increase dependency/performance/reduced-motion burden.                    |
| A7  | Icons                      | Keep Lucide and current stroke standard                          | Migrate to Phosphor/another family                             | Alternative is broad visual churn without a demonstrated user outcome.                 |
| A8  | Text/imagery               | Preserve punctuation/source text; no generated product imagery   | Marketing-only dash rule; approved empty-state art             | Evidence text remains non-negotiable; imagery requires provenance/package review.      |
| A9  | First implementation slice | Finish and taste-audit the active Discover run pipeline          | Settings; Sources; broad renderer redesign                     | A has an existing contract, prototype, tests, and current implementation.              |

## Original UI Findings from the Integrated Taste Audit

These findings record the evidence and rationale presented before user approval. F1-F4 are now complete; F5-F8 remain deferred.

### F1 - Completed-run status is visually duplicated at 820 px

- Evidence: the Search details row shows `Search complete`, then three additional chips for Plan, sources, and records.
- Impact: the narrow summary spends substantial horizontal/vertical space repeating completion rather than exposing the one item needing attention.
- Proposed change: keep one compact terminal summary, preserve counts and partial/canceled language, and show detail on expansion.
- Priority: implemented in the approved first slice.

### F2 - Active-run visual verification is incomplete

- Evidence: component tests cover planning/searching/canceling/terminal states, but the current screenshot set captures completed results rather than the live three-stage pipeline.
- Impact: no fresh visual proof yet for active wide/narrow/dark/forced-colors behavior or live-region announcement quality.
- Proposed change: add active planning/searching screenshots and an assistive-technology review to the existing acceptance matrix.
- Priority: implemented as the A9 verifier.

### F3 - Pipeline microcopy uses 9-10 px text

- Evidence: `.discover-run-stage__value`, summary chips, header support copy, and stage descriptions use 9-10 px sizes.
- Impact: compact but at risk of weak normal-scale readability; 200% zoom alone does not prove comfortable baseline scanning.
- Options: raise auxiliary text to 11-12 px, or keep current density after fresh rendered comparison.
- Recommendation: accepted and implemented at an 11 px auxiliary-text floor.

### F4 - Live region contains an interactive Cancel control

- Evidence: the `role="status"` section wraps the complete pipeline and its Cancel button.
- Impact: changing source progress may produce noisy or inconsistent assistive-technology announcements; tests currently verify roles/content, not announcement behavior.
- Proposed change: evaluate whether the live status text should be separated from the persistent Cancel control.
- Priority: implemented after the focused semantics contract reproduced the old structure.

### F5 - Result detail typography is visually dominant

- Evidence: the selected result title occupies a very large share of the wide and dark detail pane.
- Impact: strong hierarchy, but it reduces visible evidence/actions and conflicts with the approved density-7 expert-tool profile.
- Options: keep current editorial scale, or cap the detail title and reclaim one viewport band.
- Recommendation: defer until the Discover run pipeline closes; then prototype as a separate slice.

### F6 - Settings uses landing-page scale and excess top whitespace

- Evidence: `APPLICATION SETTINGS` plus a very large `Settings` heading sits above a single focused form, leaving a large non-interactive band.
- Impact: polished but lower information efficiency than other desktop surfaces.
- Options: preserve editorial identity; compact the page header and raise the form; or redesign Settings navigation.
- Recommendation: candidate second slice after A9, using the current stack and keyboard behavior.

### F7 - Sources repeats a generic metric-card pattern

- Evidence: four equal summary cards precede filters and a two-column card catalog with many pill tags.
- Impact: the data is truthful, but the repeated card/pill grammar increases scroll and resembles the generic dashboard pattern the upstream skill warns about.
- Options: retain; compress the four metrics into a ledger row; reduce visible tag density; or redesign one source row after prototype comparison.
- Recommendation: candidate third slice; do not remove evidence-boundary copy or health distinctions.

### F8 - Analytics renders repeated zero rows and empty tracks

- Evidence: six zero-activity days display identical numeric rows and empty progress tracks before the one active day.
- Impact: truthful but visually repetitive; the meaningful change is harder to scan.
- Options: retain the complete seven-day ledger; group zero days; or keep rows but reduce empty-track prominence.
- Recommendation: preserve exact values and test a lower-emphasis zero state in a later bounded slice.

## Approved Improvement Slice

- Approved now: F1 terminal-summary simplification, F2 deterministic active-state visual evidence, F3 11-12 px microcopy comparison/implementation, and F4 separation of the live status from Cancel.
- Deferred: F5 result-title scale, F6 Settings density, F7 Sources card/pill density, and F8 Analytics zero-state emphasis.
- Implementation authority: the approved F1-F4 extension in the external-UI Change Contract plus RED/GREEN tests.

## Implementation Result

- F1 complete: the terminal stage chips are replaced by one unboxed group showing plan, searched-source count, record count, and attention/stopped language when applicable.
- F2 complete: the double-gated E2E fixture captures planning plus wide, 820 px, dark, and forced-colors searching states; active reduced-motion and horizontal-overflow checks pass.
- F3 complete: support copy, stage descriptions/values, and terminal summary compute to at least 11 px; the focused CSS contract prevents regression.
- F4 complete: `Discover run pipeline` is the stable region, `Discover run progress` is the non-interactive polite live status, and Cancel sits outside that live subtree.
- Verification: focused RED failed 7/45 as expected, focused GREEN passed 45/45, `npm run check` passed 61 files / 409 tests, and build-first Electron E2E passed 2/2.
- Deferred unchanged: F5-F8 require separate user-visible prototypes and acceptance revisions.
