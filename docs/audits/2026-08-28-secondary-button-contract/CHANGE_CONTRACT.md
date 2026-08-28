# TheRSS Change Contract: Secondary Button State System

## Feature Intake

- User outcome: secondary actions look intentionally enabled/disabled and consistent across TheRSS.
- Observed problem/evidence: four components apply `secondary-button`, but no selector defines it; Chromium defaults therefore own geometry and state appearance.
- Product fit and relevant non-goal: improves native-desktop coherence and action clarity; does not redesign pages or add motion/dependencies.
- Alternatives considered, including no change: keep browser defaults; style Cancel only; define one global secondary contract. The global contract is the narrowest coherent fix.
- Cost: one small CSS rule family, one style contract, and affected Electron assertions/screenshots.
- Boundary changes: renderer presentation only; no React behavior, data, storage, IPC, security, network, dependency, or package change.
- Kill criterion: stop if a shared rule changes button semantics, hides focus, weakens forced colors, or causes layout overflow.
- Decision: proceed with RED/GREEN.

## Capability Contract

- Objective: make all existing `.secondary-button` actions share one explicit state system.
- Goals: visible enabled state, restrained hover/pressed feedback, existing focus outline, distinct disabled state, semantic tokens, and platform-independent geometry.
- Non-goals: new button component API, label/handler changes, primary/detail action changes, F6-F8/F5, or dependency additions.
- Interfaces and public API invariants: class names, DOM roles, accessible names, click/disabled behavior, and action ownership remain unchanged.
- Data ownership and evidence semantics: none changed.
- Failure states: enabled looks disabled; disabled appears interactive; focus becomes invisible; forced colors lose boundaries; labels wrap or controls overflow.
- Migration and rollback: remove the scoped CSS/test/E2E assertions.
- Observability/diagnostics: CSS contract, computed Electron styles, and screenshots.
- Allowed scope: `src/renderer/src/styles.css`, `src/renderer/src/styles.test.ts`, `e2e/desktop.spec.ts`, and this task directory.
- Persistent writeback: scoped source/test/docs and current local screenshots.

## Uncertainty Reducer

- Change class: user-visible style bug.
- Chosen artifact: failing CSS invariant plus current live Electron fixture screenshots.
- Question it must answer: whether one semantic rule distinguishes secondary actions from browser defaults and disabled controls across appearances.
- What it does not prove: preference for a different visual language or any F6-F8/F5 redesign.

## Frozen Acceptance Contract

- RED verifier and expected failure: style test cannot find `.secondary-button` or its hover/active/disabled contracts.
- Focused unit/integration cases: base uses 30px minimum height, 6x12 padding, label foreground, secondary fill, separator border, 7px selection radius, 12px/550 typography, pointer cursor, and a short transform/background/border transition.
- State cases: hover strengthens fill/border; active translates down 1px; disabled uses default cursor, no transform, and reduced opacity; all hover/active selectors exclude disabled.
- E2E/manual path: active Discover Cancel is enabled, 7px, pointer-cursor, fully opaque, and rendered in light/dark/forced-colors screenshots; existing Settings/retry behaviors remain covered by the full desktop flow.
- Screenshot/viewport/accessibility matrix: reuse planning/searching wide, 820px, dark, forced colors, and reduced motion; no horizontal overflow.
- Security/dependency impact: none.
- Package/install/live opt-in impact: none.
- Full verifier: focused test, `npm run check`, build-first Electron 2/2, diff/security scan, visual review.
- Stop condition: all gates pass with no F6-F8/F5 or behavioral scope growth.

### Acceptance-change log

| Date | Contract change | Evidence/reason | Reviewer |
| ---- | --------------- | --------------- | -------- |

## Implementation Slices

1. RED: add base/state CSS and Electron computed-style expectations.
2. Minimal GREEN: define the global secondary-button rule family with existing tokens.
3. Refactor: remove duplication only if proven; keep tests green.
4. Next slice gate: stop before F6-F8/F5.

## Independent Review

- Product/contract fit: pass; the change makes existing secondary actions explicit without adding a
  new control or changing behavior.
- Accidental scope or complexity: one 39-line CSS rule family, one static contract, and three
  computed Electron assertions. No caller JSX changed.
- Test weakening: none; the style contract failed because the selector was absent and passed after
  the exact state system was added.
- Input/secret/untrusted-content boundaries: unchanged; presentation-only CSS consumes existing
  semantic tokens.
- SQLite/IPC/migration/rollback: unchanged.
- Diagnostics/package/update impact: no dependency/package/install change; current E2E screenshots
  are the visual diagnostic.
- Findings and resolutions: enabled Cancel was previously browser-native and visually ambiguous in
  dark mode. It now has explicit geometry, fill, border, cursor, and state transitions; disabled
  remains visibly distinct and non-interactive.
- Residual review: `e2e/desktop.spec.ts` remains under the 800-line gate at 779 lines. No F6-F8/F5
  scope entered this change.

## Evidence Closeout

- Changed files: `src/renderer/src/styles.css`, `src/renderer/src/styles.test.ts`, three scoped
  assertions in `e2e/desktop.spec.ts`, and this task directory.
- Deliberately untouched files: all four caller components and their labels/handlers; package files;
  product/layout files; shared/core/main/preload/storage/IPC; F6-F8/F5; installed app; Git remote.
- Focused RED/GREEN: RED 1 failed / 21 passed because `.secondary-button` was undefined; GREEN 22/22.
- `npm run check:architecture`: passed; all owned TypeScript/TSX files remain <=800 lines.
- `npm run check`: passed 61 files / 410 tests; 90.29% statements, 80.15% branches, 93.64%
  functions, and 93.20% lines.
- Electron E2E/rendered evidence: build-first 2/2 passed; fresh light, dark, forced-colors, Settings,
  820px, and reduced-motion flows remain green.
- Security/dependency/migration/package evidence: `git diff --check` and scoped scans passed; no new
  dependency, migration, package, or installer gate.
- Live opt-in checks not run: providers/sources/vault writes remain fixture-only or untouched.
- Residual risks/blockers: none for F9. F6-F8/F5 are deferred product decisions, not blockers.
- Rollback path: remove the scoped secondary-button CSS family and its style/E2E assertions.
- Git/install/push/publication state: uncommitted local worktree; no commit, push, app install,
  package replacement, or publication occurred.
