# macOS 27 visual alignment and branch consolidation

## Feature Intake

- User outcome: all existing branches consolidated into main; current desktop follows Apple's macOS 27 conventions across Discover, Saved, Settings, Analytics, Sources, dialogs and local search.
- Observed evidence: fresh main Electron captures in output/playwright/macos27/before; 2/2 baseline E2E pass. Main retains oversized headings, boxed ambient status, inconsistent content density, and an opaque root that masks native sidebar vibrancy. Apple branch already remedies part of this.
- Product fit: compact single-user research desktop. Preserve local operational data and source/analysis evidence. No marketing site or research automation.
- Alternatives: retain current style (fails request); SwiftUI rewrite (changes architecture beyond this visual scope); native-CSS alignment on existing Electron shell (chosen).
- Cost: existing CSS/React only, no new visual dependencies or services. Integrate already-requested dependency branches and compatible audit fixes.
- Boundaries: no SQLite/preload/IPC/provider/source changes; existing native titlebar/menu/vibrancy remain OS-owned. Electron dependency update requires package smoke.
- Kill criterion: do not merge if evidence semantics, keyboard interaction, coverage, desktop startup or package verification regress.

## Capability Contract

- Objective: one verified macOS 27-aligned desktop on main, with every existing branch's unique changes preserved.
- Goals: edge-aligned translucent sidebar, semibold selection, uniform opaque title toolbar, system typography, compact consistent content, concentric control/group radii, native menus, focus/inactive/appearance/accessibility states.
- Non-goals: exact AppKit Liquid Glass/refraction, installing SF Symbols, SwiftUI migration, replacing the installed app, publishing a release, changing real research data.
- Interfaces: retain all existing data APIs and user actions; source/analysis text remains unchanged.
- Data/evidence: preserve complete/partial/no-results/failed/canceled/blocked/stale distinctions and confirmation-gated promotion.
- Rollback: git revert the integration change; original branch histories also in output/branch-backups/2026-09-05-before-consolidation.bundle (verified complete bundle). No migration.
- Observability: DOM/computed-style assertions, deterministic screenshots, current test/audit/package logs.
- Allowed scope: existing Apple branch; three Dependabot branches and transitive audit remediation; renderer styles/entry and LocalSearchPanel/SourceCatalogView keyboard behavior; focused appearance E2E; task audit artifacts and generated-output ignore rules.
- Persistent writeback: this directory, selected before/after screenshots, branch preservation inventory and final verification report.

## Uncertainty Reducer

- Class: cross-cutting visual refresh plus dependency/branch integration.
- Artifact: deterministic existing Electron fixture app with candidate CSS injected before production import; interactive source selector, navigation, list selection and local search remain real controls.
- Question: does the selected macOS 27 direction improve hierarchy and remain usable at 820/1360 widths and both appearances?
- Does not prove: pixel equality with native AppKit, actual macOS 27 compositor behavior, live providers or actual user acceptance.

## Frozen Acceptance Contract

- RED: new Electron appearance test must fail on current semibold sidebar selection, hard-edge opaque toolbar, transparent window root, compact detail typography, and complete reduced-transparency overlay fallback.
- Focused tests: existing renderer/source/style tests plus computed appearance/interaction checks. Do not assert unsupported official pixel values; sizes are TheRSS implementation choices.
- E2E: existing Discover/search/select/save/promote-fixture/settings/source/analytics/zoom/sidebar contract remains intact. Add local-search Escape/focus return, active/inactive material, sidebar geometry, toolbar readability and content material assertions.
- Matrix: 1360x880 and 820x700, 200% zoom through existing tests, light/dark, forced colors, increased contrast, reduced motion, reduced transparency. Screenshots mark fixture data in report.
- Dependencies: retain all direct versions requested by three branches; no --force audit upgrade or relaxed check threshold.
- Package: Electron 44/native SQLite rebuild, package:mac and smoke:package. No installed-app replacement or live sources.
- Full verifier: npm run check; npm run test:e2e; npm audit --audit-level=high; npm run smoke:native; npm run package:mac; npm run smoke:package; independent diff review; protected PR quality+desktop success.
- Stop condition: gates pass, UI evidence inspected, all unique branch changes preserved, only local/remote main, exact main/remote SHA equality, clean checkout.

### Acceptance-change log

| Date       | Contract change                                                                                                               | Evidence/reason                                                                    | Reviewer                             |
| ---------- | ----------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------- | ------------------------------------ |
| 2026-09-05 | Supersede historical exact font-size/style checks only where intentionally revised, retain semantic and responsive assertions | User explicitly selects macOS 27; official WWDC26 updates plus current screenshots | Main agent; independent final review |

## Implementation Slices

1. Integrate previously reviewed Apple branch and all dependency patches; repair audit without lowering gates.
2. Inject candidate theme into fixture app, capture prototype, then run RED without injection.
3. Apply theme in production and verify GREEN; preserve all existing flow assertions.
4. Independent review and full release checks, then protected-main integration and cleanup.

## Independent Review

Fresh reviewer requested changes: Electron44 clipboard smoke used removed APIs (P1); primary button contrast fell below4.5 (P2); Sources lacked a bounded scrolling pane (P2) and listbox keyboard behavior (P2). Resolutions implemented: clipboard sink interception without OS mutation, contrast-safe control fill/foreground roles, bounded Sources workspace with content-start alignment, roving focus plus explicit activation. Final re-review approved all findings;433 tests,4 desktop tests, native smoke and package smoke passed. The final zoom repair also passed independent review.

### Reviewed acceptance additions (2026-09-05)

- Explicit local-search Tab loop/close focus restoration and Sources Arrow/Home/End focus-only plus Enter/Space activation; none may implicitly call a source while moving focus.
- Sources list must overflow independently, last-row activation must preserve main scroll and visible detail header, narrow/zoom layouts may stack and use page scrolling.
- Primary button foreground/background contrast >=4.5 for all9 system accents in both appearances. Historical raw-accent fill assertion replaced by contrast-safe control roles, while OS accent and navigation tint remain unchanged.
- Native smoke on Electron44 verifies clipboard and external-open handler payloads through stubs. It must not read or overwrite the real clipboard; it does not claim an OS clipboard roundtrip.

## Evidence Closeout

Implementation and local gates complete; see audit.md for current evidence. Protected-main publication and branch cleanup are the remaining remote step. Renderer material remains a CSS approximation of native Liquid Glass.
