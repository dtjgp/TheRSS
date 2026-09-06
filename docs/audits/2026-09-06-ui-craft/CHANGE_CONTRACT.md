# TheRSS native UI craft

## Feature Intake

- User outcome: assess the current UI and improve the application's overall design quality.
- Current-run evidence: installed AppKit Discover, Saved, Settings and Sources captures in `screenshots/`. Flat, centered sidebar buttons compete with ordinary commands; search has no primary emphasis; source-list gray fills dominate; long titles are clipped; reading and form sections have weak visual grouping.
- Product fit: a compact, quiet macOS research desk. Preserve five routes, native editing and list-detail workflow. No marketing, new discovery capability or external calls.
- Alternatives: leave default controls unchanged; replace the design system; or refine existing native primitives. Choose the last option: zero dependencies and common improvements across routes.
- Cost: bounded native presentation work, no services, no assets or runtime animation.
- Boundaries: optional validated visual properties in the internal native scene; no public service, IPC, SQLite, security, network or packaging changes.
- Kill criterion: revert a treatment that breaks control semantics, content fidelity, contrast, scrolling or accessible focus.
- Decision: proceed with restrained native refinement under the existing 3/2/7 profile. The optional user preference question remains open; default is the established native direction.

## Capability Contract

- Objective: establish clear navigation, action and reading hierarchy in the default AppKit interface.
- Goals: leading-aligned navigation with visible selection, restrained system accent on primary actions, two-line research titles, quieter list backgrounds, consistent panel grouping and text sizing.
- Non-goals: redesign routes, change search/analysis behavior, migrate away from AppKit, change web compatibility styling, install or publish.
- Interfaces: stable control IDs/actions, enabled states, labels, keyboard and secure callbacks remain intact. New visual properties are bounded enums; native SF Symbols are operating-system resources, with text labels retained. No third-party icon family is installed.
- Ownership/evidence: all counts, titles, source outcomes, saved state and provenance remain supplied by current presenters. Do not infer healthy or verified status from color.
- Failure states: existing disabled, empty, failed, partial, canceled, retry and confirmation behavior remains authoritative.
- Migration/rollback: no data migration. Revert exact task source changes and rebuild the native adapter.
- Diagnostics: extend fixture inspection only with non-sensitive rendered style facts.
- Allowed scope: native AppKit rendering, bounded scene visual properties, affected native presenters/tests, native smoke checks and this audit.
- Persistent writeback: this contract/audit and a task-plan status pointer.

## Uncertainty Reducer

- Class: shared visual refinement; existing interaction flows remain unchanged.
- Artifacts: current-run screenshots, existing fixture-backed native acceptance host, and the invariant matrix below. A first rendered fixture iteration is the visual prototype before expanding the styling across remaining screens.
- Question: can hierarchy improve using the existing native controls while retaining compact scanning and narrow layouts?
- Not proved: subjective user acceptance, live source/model behavior or installed package delivery.

## Frozen Acceptance Contract

- RED: new scene visual properties are rejected by the current schema; shell tests currently lack navigation emphasis. Native inspection must verify real button/table treatment and two-line title capacity, rather than only matching source strings.
- Invariants: source values and action bindings unchanged; Save/Unsave, disabled actions, native selection/keyboard, secure input, IME, model and promotion ownership continue to pass existing tests.
- E2E: native Discover -> reading -> Save -> Saved -> Settings -> Sources -> Analytics, local search and promotion fixture paths.
- Matrix: light/dark, increased contrast/reduced transparency, wide and narrow windows, zoom 1.0/1.5; no new motion. Native forced-colors equivalent is the existing macOS accessibility contrast path.
- Verifiers: focused native tests, `npm run check`, `npm run smoke:appkit`, relevant compatibility E2E; current-run native screenshots and separate diff review.
- Security/dependency: strict visual enums only; no remote content execution or new packages. Existing credential and event isolation tests remain required.
- Package/install/live: not requested and not performed.
- Stop: all applicable gates pass, rendered issues introduced here are resolved, evidence and limitations are recorded.

## Implementation Slices

1. RED visual contract tests; minimal native control implementation and first fixture rendering.
2. Apply verified visual roles to shell, search, reading and settings; preserve stable IDs and data.
3. Run required gates, inspect appearance/viewport matrix, resolve findings and review diff independently.

## Acceptance-change Log

- The first fixture iteration reproduced an existing test sequencing race: after Keep Editing, a second window close was issued before the native sheet promise settled. The dialog log showed one resolved alert and no second open; the draft remained intact. The smoke helper now waits for the recorded real dialog resolution. All original close/dirty assertions remain; no production lifecycle change.
- Real-render assertions additionally inspect navigation symbols/selection/borders, primary search, two-line title frames and bounded settings widths. These make the visual contract executable.
- The existing native harness supplies 1360×880, 820×720 and 820×600 viewports; these replace the provisional 1380/900 widths with the actual wider/narrower inspection cases. The narrower 820px case exercises a stronger constraint than the planned 900px check.

## Independent Review

- A separate read-only reviewer checked product fit, native control semantics, appearance, test integrity and boundaries. No unresolved actionable findings after corrections.
- Bright accent contrast: actual yellow-button screenshots showed AppKit still drew a white title despite a requested black tint. Final code bounds the background luminance instead; rendered blue/yellow fill samples against white are approximately 6.59:1 / 7.09:1.
- Cached input border colors: removed the experimental layer styling and retained native NSBezelBorder. AppKit continues to own theme-aware input outlines.
- Checkbox isolation: decorative button styles apply only to button nodes; checked/unchecked source picker screenshots inspected.
- Title geometry: native assertions inspect actual title frame, measured line height and required text height at a 260pt split and 1.5x zoom.
- Public services, source/metadata values, SQLite, secret ownership, confirmation semantics, dependencies and package identity are unchanged.

## Evidence Closeout

- Complete for local source scope. Initial working tree was clean; baseline captures are from this run.
- Changed: native node rendering and fixture-only accent override; typed scene roles; native shell, Discover composer, reader and settings presentation; regression tests; smoke synchronization/assertions; audit and task-plan pointer.
- RED: two added contract tests failed for unsupported visual keys and missing navigation role. Focused GREEN: 23/23 across five affected suites.
- Final `npm run check`: exit 0; architecture, formatting, lint, types, 554 main tests, 61 native tests, both four-dimensional coverage gates and builds passed. Log: `/tmp/therss-ui-craft-final-check.log`.
- Native workflow: 12/12 groups passed on final native code, including real screenshots. Native controls: 5/5 groups passed. Compatibility desktop E2E: 1/1 passed.
- Current screenshot hashes and machine-readable summary: `verification.json`; selected images and step-by-step findings: `audit.md`.
- Appearance: light/dark, high contrast and reduced transparency, five fixture accent colors, narrow layout and 1.5x zoom inspected. No full VoiceOver compliance claim. Raw native evidence is in `test-results/ui-craft/`.
- Intermediate failures: initial desktop launch blocked by sandbox, passed at the approved desktop boundary; generated JSON formatting corrected by placing transient output under test-results; test sheet-completion race fixed without altering production close handling; lazy custom input-layer and ignored native text-tint assumptions replaced with verified native behavior.
- No migration, dependency or public API change; no additional network or credential scan requirement introduced. Independent diff review checked those boundaries.
- No package/install/release, commit/push, live model/source request or real vault write. Existing installed application remains unchanged.
- Rollback: revert the task's exact source paths and rebuild; no operational-data rollback required.
