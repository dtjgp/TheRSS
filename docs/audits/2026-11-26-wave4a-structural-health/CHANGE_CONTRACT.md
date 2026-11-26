# TheRSS Change Contract — Wave 4A Structural Health & Group-14 Hardening

## Feature Intake

- User outcome: Keep TheRSS's native AppKit bridge and Web fallback shell modular and maintainable, and eliminate unbounded Chromium renderer IPC waiting during native window recreation.
- Observed problem/evidence:
  1. `native/appkit/node.mm` has grown to 1,219 lines, mixing custom AppKit subclasses, color/contrast helpers, node lifecycle, layout/split reconciliation, table/drag/edit interaction, and inspection in one translation unit.
  2. `src/renderer/src/App.tsx` is at 746 lines (approaching the 800-line owned TypeScript/TSX architecture ceiling enforced by `scripts/check-source-size.ts`), mixing shell navigation with sidebar pointer/keyboard resize logic and the full Saved signals shelf UI.
  3. Native smoke group 14 (`Dirty marked-text close guard and native window recreation preserve data/preferences`) previously suffered intermittent hangs during window recreation (`docs/audits/2026-10-27-native-smoke-hang/NOTES.md`). Inspection of `src/main/nativeAppKitRuntime.ts` and `src/main/index.ts` shows `attachAppKit` unconditionally executes `await window.webContents.executeJavaScript(...)` on the blank `native-host.html` renderer process—with no timeout and even when `native-ui.json` already exists on disk—and `app.on('activate')` has no in-flight guard against overlapping `createWindow` calls.
- Product fit and relevant non-goal: Pure structural refactor and reliability hardening directly supporting `GOALS.md` Wave 4 item 1. Non-goal: changing any user-visible UI, IPC schema, SQLite schema, or native scene contract.
- Alternatives considered, including no change: Leaving `node.mm` and `App.tsx` unsplit increases review/merge friction and risks breaching the 800-line cap on the next Web touch; leaving unconditional unbounded `executeJavaScript` in `attachAppKit` preserves a Chromium renderer IPC hang vector on every recreated native window.
- Cost: implementation low-medium (mechanical splits + narrow lazy/bounded legacy read); runtime zero overhead (faster native window recreation by skipping unnecessary renderer JS eval); maintenance net positive; external service zero.
- Boundary changes: No SQLite, IPC, preload, security, network, or packaging contract changes. Native build script `scripts/build-native-appkit.mjs` compiles the split Objective-C++ translation units into the exact same `out/native-appkit/therss-ui.node` binary.
- Kill criterion: Any regression in native AppKit layout/controls/smoke tests, Web renderer tests, or E2E suites that cannot be resolved cleanly without weakening assertions.
- Decision: proceed

## Capability Contract

- Objective: Split `native/appkit/node.mm` and `src/renderer/src/App.tsx` into cohesive modules under 550 lines each with zero behavioral regression, and harden native window recreation by avoiding unnecessary/unbounded `executeJavaScript` calls when `native-ui.json` is already present plus guarding concurrent `activate` window creation.
- Goals:
  1. Split `native/appkit/node.mm` (1,219L) into `nodeInternal.h`, `nodeControls.mm`, `node.mm`, `nodeLayout.mm`, and `nodeInteraction.mm`, wired cleanly in `scripts/build-native-appkit.mjs`.
  2. Split `src/renderer/src/App.tsx` (746L) by extracting `src/renderer/src/useSidebarResize.ts` and `src/renderer/src/SavedSignalsView.tsx`.
  3. Update `readNativePreferences` / `attachAppKit` so `native-ui.json` is read from disk first and legacy `localStorage` migration runs only when the file is missing/invalid, bounded by a timeout and safe fallback; guard concurrent `activate` main-window creation in `src/main/index.ts`.
- Non-goals:
  - No changes to AppKit visual design, layout rules, scene JSON schema, or Web fallback DOM/ARIA structure.
  - No `P1-3` vault writer changes or Daily Papers contract changes in this PR.
- Interfaces and public API invariants:
  - `native/appkit/ui.h` public class interfaces (`TRHost`, `TRNode`, `TRCanvas`, `TRChart`, `TRChrome`, `TRPopover`) remain unchanged.
  - `App` component props (`{ api: TheRSSApi }`) and all DOM roles, labels, CSS classes, data attributes, and keyboard/pointer behaviors remain unchanged.
  - `readNativePreferences(path, legacy)` remains backward-compatible with plain object arguments while also accepting a lazy async reader callback `() => Promise<LegacyNativePreferences>`.
- Data ownership and evidence semantics: Unchanged (`native-ui.json` remains local UI preference storage; SQLite untouched).
- Failure states: Missing/corrupt `native-ui.json` falls back to bounded legacy read (2 s max) and then to `defaultNativePreferences`; a destroyed window during async `createWindow` exits cleanly without throwing unhandled rejections.
- Migration and rollback: Pure refactor / additive lazy-read guard. Rollback is a clean `git revert` of the squash commit with zero data migration impact.
- Observability/diagnostics: Unchanged.
- Allowed scope: `native/appkit/`, `scripts/build-native-appkit.mjs`, `src/renderer/src/`, `src/main/appkit/preferences.ts`, `src/main/appkit/preferences.test.ts`, `src/main/nativeAppKitRuntime.ts`, `src/main/index.ts`, `GOALS.md`, and this audit directory.
- Persistent writeback: `GOALS.md` updated to record Wave 4A completion once verified.

## Uncertainty Reducer

- Change class: Mechanical refactor + defect hardening.
- Chosen artifact: Existing behavior/invariant matrix (all `App.*.test.tsx`, `preferences.test.ts`, native AppKit unit suite, `smoke-native-appkit.mjs` 17 groups, `smoke-appkit-controls.mjs` 20 groups, Playwright E2E 11 specs).
- Question it must answer: Does every existing native AppKit and Web fallback behavior remain 100% identical after splitting, and does `readNativePreferences` skip legacy `localStorage` reads when `native-ui.json` exists while bounding stalled legacy reads?
- What it does not prove: Does not replace human physical-keyboard/VoiceOver acceptance or prove elimination of every possible Chromium OS-level stderr warning outside `attachAppKit`.

## Frozen Acceptance Contract

- RED verifier and expected failure:
  1. New unit tests in `src/main/appkit/preferences.test.ts` verifying: (a) a lazy legacy reader callback is NOT invoked when a valid `native-ui.json` already exists on disk; (b) when `native-ui.json` is missing, a stalled or rejecting legacy reader falls back cleanly to `defaultNativePreferences` within its bounded timeout. Fails RED before `readNativePreferences` supports lazy/bounded legacy reads.
- Focused unit/integration cases:
  - `npx vitest run src/main/appkit/preferences.test.ts`
  - `npx vitest run src/renderer/src/App.test.tsx src/renderer/src/App.shell.test.tsx src/renderer/src/App.directInteraction.test.tsx src/renderer/src/App.savedUpdates.test.tsx`
- Migration/rollback cases: Legacy `localStorage` migration still succeeds when `native-ui.json` is absent.
- E2E/manual path: Full `npm run test:e2e` (11 specs), `THERSS_NATIVE_DEFAULT_ONLY=1 THERSS_NATIVE_SCREENSHOTS=0 node scripts/smoke-native-appkit.mjs` (17 groups), and `node scripts/smoke-appkit-controls.mjs` (20 groups).
- Screenshot/viewport/accessibility matrix: Existing native smoke and Web E2E viewport/resize/accessibility assertions pass unchanged.
- Security/dependency impact: Zero new dependencies; no changes to CSP, IPC, secret storage, or path validation.
- Package/install/live opt-in impact: `scripts/build-native-appkit.mjs` compiles all split `.mm` files into `out/native-appkit/therss-ui.node`; live network/provider smoke not required.
- Full verifier: `npm run check` (`check:architecture`, `format:check`, `lint`, `typecheck`, `test:coverage >= 80%`, `test:appkit`, `build` incl. `build:native`) + `npm run test:e2e` + native smoke suites + GitHub CI (`CI/quality` + `CI/desktop`).
- Stop condition: Every hotspot target is split below 550 lines, RED->GREEN tests pass, all local and CI gates pass with zero weakened assertions, and independent diff review is clean.

### Acceptance-change log

| Date       | Contract change                                                                                                                | Evidence/reason                                                                                                                                                                                                                            | Reviewer     |
| ---------- | ------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------ |
| 2026-11-26 | `attachAppKit` passes a lazy legacy reader callback to `readNativePreferences` instead of eagerly invoking `executeJavaScript` | Updated `src/main/nativeAppKitRuntime.test.ts` to verify both that `executeJavaScript` is not eagerly called and that invoking the lazy callback yields `{ sidebar: '245' }` (stronger assertion matching the Wave 4A Capability Contract) | technical-pm |

## Implementation Slices

1. Split `native/appkit/node.mm` into `nodeInternal.h`, `nodeControls.mm`, `node.mm`, `nodeLayout.mm`, `nodeInteraction.mm`, update `scripts/build-native-appkit.mjs`, and verify `npm run build:native` + native smoke.
2. Split `src/renderer/src/App.tsx` into `useSidebarResize.ts`, `SavedSignalsView.tsx`, and `App.tsx`, and verify all `App.*.test.tsx`.
3. Add RED tests in `src/main/appkit/preferences.test.ts`, implement lazy/bounded legacy read in `preferences.ts` + `nativeAppKitRuntime.ts` and concurrent `activate` window-creation guard in `src/main/index.ts`, verify GREEN.
4. Run full `npm run check`, `npm run test:e2e`, native smoke + controls suites, self-review diff, update `GOALS.md` and Evidence Closeout, open PR.

## Independent Review

- Product/contract fit: Matches `GOALS.md` Wave 4 item 1; zero user-visible UI, IPC, or SQLite behavior drift.
- Accidental scope or complexity: None; Objective-C categories preserve `TRNode`'s exact runtime identity and compile with zero new clang++ warnings, and React extractions preserve identical DOM/ARIA structure.
- Test weakening: None; `preferences.test.ts` adds new RED->GREEN coverage and `nativeAppKitRuntime.test.ts` strengthens the assertion to prove `executeJavaScript` is not called eagerly.
- Input/secret/untrusted-content boundaries: Unchanged; no secrets, network calls, or new dependencies introduced.
- SQLite/IPC/migration/rollback: Unchanged; legacy `localStorage` migration still works when `native-ui.json` is absent and is bounded to 2 s. Clean `git revert` rollback.
- Diagnostics/package/update impact: `scripts/build-native-appkit.mjs` compiles all four `node*.mm` units into `out/native-appkit/therss-ui.node`.
- Findings and resolutions: Initial category split produced `-Wincomplete-implementation` warnings until `@interface TRNode (Layout)` and `@interface TRNode (Interaction)` were declared in `native/appkit/ui.h`; resolved with zero warnings on all `node*.mm` files.

## Evidence Closeout

- Changed files:
  - `native/appkit/ui.h`, `native/appkit/nodeInternal.h`, `native/appkit/nodeControls.mm` (182L), `native/appkit/node.mm` (427L), `native/appkit/nodeLayout.mm` (285L), `native/appkit/nodeInteraction.mm` (304L), `scripts/build-native-appkit.mjs`
  - `src/renderer/src/App.tsx` (488L), `src/renderer/src/useSidebarResize.ts` (175L), `src/renderer/src/SavedSignalsView.tsx` (183L)
  - `src/main/appkit/preferences.ts`, `src/main/appkit/preferences.test.ts`, `src/main/nativeAppKitRuntime.ts`, `src/main/nativeAppKitRuntime.test.ts`, `src/main/index.ts`
  - `GOALS.md`, `docs/audits/2026-11-26-wave4a-structural-health/CHANGE_CONTRACT.md`
- Deliberately untouched files: SQLite schema/repository, IPC/preload schemas, `llm-wiki` adapters, Daily Papers contract.
- Focused RED/GREEN: `preferences.test.ts` failed RED on lazy legacy migration before implementation and passed 6/6 GREEN after; `App.*.test.tsx` passed 46/46 immediately after split.
- `npm run check:architecture`: PASS (all owned `src/` files <= 800 lines).
- `npm run check`: PASS — Main suite 153 files / 1,138 tests (93.03% stmts, 85.04% branches, 96.17% funcs, 95.25% lines); AppKit suite 43 files / 249 tests (91.06% stmts, 85.00% branches, 88.93% funcs, 93.58% lines); native AppKit addon compiled cleanly for arm64 with zero new warnings.
- Electron E2E/rendered evidence: `npm run test:e2e` 11/11 PASS (40.3s); `smoke-native-appkit.mjs` 17/17 PASS (including Group 14 window recreation); `smoke-appkit-controls.mjs` 20/20 PASS.
- Security/dependency/migration/package evidence: Zero new dependencies; `native-ui.json` legacy migration verified in unit tests.
- Live opt-in checks not run: Live external sources, model providers, and real `llm-wiki` writes (out of scope for pure structural refactor).
- Residual risks/blockers: Non-deterministic OS/Chromium stderr noise (`task_policy_set`) remains bounded by existing per-group timeout diagnostics (`scripts/native-smoke-step.mjs`); human physical-keyboard/VoiceOver and real-paper P0-1 acceptance remain separate human gates.
- Rollback path: `git revert` of the Wave 4A squash commit.
- Git/install/push/publication state: Rebased onto `origin/main` (`2d1b89d`), pushed to `refactor/wave4a-hotspot-splits-and-group14` for PR CI verification.
