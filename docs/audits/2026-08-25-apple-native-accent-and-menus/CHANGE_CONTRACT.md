# Change Contract: System accent color and menu-bar completeness

Slice 1 of the Apple-native remediation sequence recorded in the 2026-08-25 native-gap review.

## Feature Intake

- **User outcome:** TheRSS honors the accent color the user chose in System Settings > Appearance,
  and its menu bar offers the standard macOS commands a Mac user expects to find.
- **Observed problem/evidence:** `systemPreferences.getAccentColor()`, `accent-color`, and
  `AccentColor` appear zero times in `src/`; the app renders one fixed blue regardless of the system
  accent. `src/main/applicationMenu.ts` has no Help menu, no View zoom commands, no accelerator for
  Dismiss Selected, and binds the universal Save shortcut (Command+S) to "Save Selected".
- **Product fit and relevant non-goal:** Fits `PRODUCT.md` "Apple-native" surface intent. Non-goal:
  this slice does not add an in-app appearance override, does not restyle per-view identity colors,
  and does not introduce a Settings window.
- **Alternatives considered, including no change:**
  - No change: leaves the single most visible non-native signal in place.
  - Pipe the raw system hex into `--view-accent`: rejected. `--view-accent` is per-view by design
    (`styles.css` `.app-shell[data-view=...]`) and its `-text` variants are contrast-tuned by the
    Phase 19 N7 fix. Arbitrary hex would silently break both.
  - **Chosen:** resolve the system accent to the nearest already-tuned palette name and apply it to
    control surfaces only, leaving per-view identity intact.
- **Cost:** implementation small; runtime one `systemPreferences` read plus a change subscription;
  maintenance low; no external service.
- **Boundary changes:** IPC gains one read channel and one push channel plus one app command. No
  SQLite change, no secret handling, no network, no packaging change.
- **Kill criterion:** if honoring the system accent cannot preserve the N7 contrast contract for any
  reachable accent, revert to the fixed blue and record the reason.
- **Decision:** proceed.

## Capability Contract

- **Objective:** control surfaces follow the macOS accent color, and the menu bar carries the
  standard macOS command set, without altering per-view color identity.
- **Goals:**
  - Focus rings, form controls (`accent-color`), and text selection use the system accent.
  - The accent updates live when the user changes it in System Settings.
  - Help menu, View zoom commands, and Mac-idiomatic accelerators exist.
- **Non-goals:**
  - Per-view accents (Discover blue, Saved amber, Sources teal, Analytics indigo) are unchanged.
  - `.primary-button` keeps its per-view tint. macOS already draws the true default button with the
    system accent inside native sheets, which is where this app's confirmations live.
  - No in-app appearance/accent override setting.
- **Interfaces and public API invariants:** `TheRSSApi` gains `getSystemAccent()` and
  `onSystemAccentChange(listener)`. Existing methods keep their signatures.
- **Data ownership and evidence semantics:** the accent is transient OS state. It is never persisted
  to SQLite and never enters analysis provenance.
- **Failure states:** an unreadable, malformed, or unavailable accent resolves to `null` and the
  renderer keeps the default blue. Non-macOS platforms keep the default blue.
- **Migration and rollback:** no migration. Rollback is removing the `data-system-accent` attribute
  application; every token retains its current default value.
- **Observability/diagnostics:** none added in this slice; the resolver is pure and unit-tested.
- **Allowed scope:** `src/core/appearance/`, `src/shared/{ipc,api,appearance}.ts`,
  `src/preload/index.ts`, `src/main/{index,applicationMenu}.ts`, `src/renderer/src/App.tsx`,
  `src/renderer/src/styles.css`, `src/renderer/src/styles/accessibility.css`.
- **Persistent writeback:** none.

## Uncertainty Reducer

- **Change class:** New or redesigned UI flow (control tint) plus a menu/command surface change.
- **Chosen artifact:** invariant matrix plus failing unit tests. A fixture-backed interactive
  prototype is not required: the visual change is a token substitution on existing components, and
  the design question (how far the accent reaches) was resolved explicitly with the user before
  implementation rather than discovered through a prototype.
- **Question it must answer:** does every reachable macOS accent resolve to a palette entry whose
  contrast-tuned text variant already exists?
- **What it does not prove:** it does not prove rendered contrast ratios under
  `prefers-contrast: more`, and it does not prove live OS accent switching. Both are named in the
  acceptance contract below.

## Frozen Acceptance Contract

- **RED verifier and expected failure:** `src/core/appearance/systemAccent.test.ts` fails because
  `resolveSystemAccentName` does not exist; `src/main/applicationMenu.test.ts` fails because the
  Help menu, zoom roles, and new accelerators are absent.
- **Focused unit/integration cases:**
  - every macOS stock accent (blue, purple, pink, red, orange, yellow, green, graphite) resolves to
    a palette name that has a tuned `-text` variant;
  - malformed, empty, short, and non-hex input resolves to `null`;
  - both `RRGGBB` and macOS `RRGGBBAA` forms parse;
  - the menu exposes Help, View zoom roles, Command+Backspace dismiss, and Shift+Command+D save;
  - Command+S is no longer bound to a non-Save action.
- **Migration/rollback cases:** none; no persisted state.
- **E2E/manual path:** existing Electron E2E must stay green. Live accent switching in System
  Settings is a manual macOS check.
- **Screenshot/viewport/accessibility matrix:** `forced-colors: active` must continue to force the
  accent to `Highlight`; `prefers-contrast: more` must keep its tuned text variants.
- **Security/dependency impact:** none. No new dependency. The new channels carry an enum-validated
  string only.
- **Package/install/live opt-in impact:** none.
- **Full verifier:** `npm run check:architecture`, `npm run check`.
- **Stop condition:** focused RED/GREEN recorded, full check green, forced-colors and contrast
  contracts preserved, and any unrun manual check reported explicitly rather than assumed.

### Acceptance-change log

| Date | Contract change | Evidence/reason | Reviewer |
| ---- | --------------- | --------------- | -------- |

## Implementation Slices

1. RED: pure accent resolver tests + menu template tests.
2. Minimal GREEN: resolver, menu items, IPC plumbing, CSS tokens.
3. Refactor: none anticipated; the resolver is a single pure function.
4. Next slice gate: full check green before Slice 2 (native context menus).

## Independent Review

- **Product/contract fit:** matches the agreed scope. The system accent reaches controls, text
  selection, and focus rings only; every `.app-shell[data-view=...]` identity accent is unchanged,
  asserted by a negative test (`--view-accent: var(--system-accent)` must not appear).
- **Accidental scope or complexity:** none found in behavior. The README verification block was
  updated because this change altered the exact numbers it cites; leaving it would have increased an
  already-recorded staleness rather than merely preserving it.
- **Test weakening:** none. No existing assertion was edited or relaxed. All three pre-existing
  `applicationMenu` tests still pass unmodified.
- **Input/secret/untrusted-content boundaries:** the two new channels are one-directional reads. The
  renderer sends no payload; the pushed value is re-validated with `isSystemAccentName` in preload
  and falls back to `null`. The Help command opens one hardcoded `https:` URL through the existing
  `setWindowOpenHandler` + `isSafeExternalUrl` path, so no new external-navigation surface exists.
- **SQLite/IPC/migration/rollback:** no schema, migration, or persisted state touched.
- **Diagnostics/package/update impact:** none.
- **Findings and resolutions:**
  1. _Resolved during review._ The first implementation put the accent effect inline in `App.tsx`,
     taking it from 768 to 794 lines against the fail-closed 800-line policy — 6 lines of headroom.
     Extracted to `src/renderer/src/useSystemAccent.ts`; `App.tsx` is now 775 lines (net +7).
  2. _Resolved during implementation._ `resolveSystemAccentName` initially seeded its search from
     `PALETTE_ANCHORS[0][0]`, which fails `noUncheckedIndexedAccess`. Replaced with an explicit
     `'blue'` default, which also states the documented fallback in the code.

## Evidence Closeout

- **Changed files:** `src/shared/appearance.ts` (new), `src/core/appearance/systemAccent.ts` (new),
  `src/core/appearance/systemAccent.test.ts` (new), `src/renderer/src/useSystemAccent.ts` (new),
  `src/shared/{ipc,api}.ts`, `src/preload/index.ts`, `src/main/{index,applicationMenu}.ts`,
  `src/main/applicationMenu.test.ts`, `src/renderer/src/{App.tsx,App.testSupport.ts,
SettingsView.test.tsx,styles.css,styles.test.ts}`, `src/renderer/src/styles/accessibility.css`,
  `README.md`, and this contract.
- **Deliberately untouched:** `.app-shell[data-view=...]` accent rules, `.primary-button`
  (macOS already draws the true default button with the system accent inside the native sheets this
  app uses for confirmation), all SQLite code, all secret handling, `docs/ROADMAP.md`.
- **Focused RED/GREEN:** `systemAccent.test.ts` failed on a missing module, then passed 20/20.
  `applicationMenu.test.ts` failed 4 of 7 (Help menu, zoom roles, Command+Backspace, Command+S
  release), then passed 7/7 with the 3 pre-existing cases untouched.
- **`npm run check:architecture`:** passed — all owned source files <= 800 lines.
- **`npm run check`:** passed. 55 test files / 360 tests. Statements 90.49%, branches 80.59%,
  functions 93.73%, lines 93.40% — all above the 80% floor. All four builds succeeded.
- **Electron E2E:** 2/2 passed, re-run after the `useSystemAccent` extraction.
- **Security/dependency/migration/package evidence:** no dependency added, so no new audit surface;
  no migration; no packaging change. Working tree contains no secrets.
- **Runtime evidence added 2026-08-25 via `npm run smoke:native`:** a launched Electron instance
  reported the real OS accent `007AFFFF`, main resolved it to `blue`, the renderer applied
  `data-system-accent="blue"`, and `--system-accent` computed to `#007aff` both at the root and on a
  component. The menu bar was read back from the live `Menu.getApplicationMenu()`: a `help`-role menu
  is installed, `View` carries `resetzoom`/`zoomin`/`zoomout`, `Dismiss Selected` carries
  `CommandOrControl+Backspace`, `Save Selected` carries `Shift+CommandOrControl+D`, and no Signal
  entry binds `CommandOrControl+S`.
- **Live opt-in checks still NOT run:**
  - The machine's accent is the stock blue, so only the default path was exercised end to end. A
    **non-blue** accent, and the `accent-color-changed` subscription firing on a live change, remain
    without runtime evidence. The hex-to-name mapping for all eight stock accents is unit-tested.
  - No rendered screenshot matrix was captured for the non-blue accents.
  - No live provider or live source call was made.
- **Residual risks/blockers:**
  - macOS pink and yellow accents resolve to `purple` and `orange` respectively. This is deliberate:
    the palette has no contrast-tuned pink or yellow `-text` variant, and inventing one would need
    its own contrast evidence. Documented rather than silently approximated.
  - `App.tsx` remains large at 775 lines. The headroom problem is deferred, not solved.
- **Rollback path:** revert the listed files. Every token retains its current default value, so a
  partial revert degrades to the existing fixed blue rather than to an unstyled state.
- **Git/install/push/publication state:** working tree is **dirty and uncommitted**. No commit, no
  push, no packaging, no install, and no publication was performed by this slice.
