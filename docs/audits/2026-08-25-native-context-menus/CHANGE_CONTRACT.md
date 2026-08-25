# Change Contract: Native context menus

Slice 2 of the Apple-native remediation sequence.

## Feature Intake

- **User outcome:** right-clicking a Discover result or a Saved row opens a real macOS context
  menu with the secondary actions for that item.
- **Observed problem/evidence:** `onContextMenu` appears zero times in `src/renderer`, and `.popup(`
  zero times in `src/main`. Right-click currently does nothing. `docs/APPLE_NATIVE_PRODUCT_AUDIT.md`
  recommended exactly this (Open in Browser, Copy Link, Copy Citation) and still lists
  "右键 Copy/Open 命令" as outstanding.
- **Product fit and relevant non-goal:** fits the Apple-native surface intent. Non-goal: this slice
  does not add a Sources context menu, does not add new capabilities, and exposes only actions the
  product already performs.
- **Alternatives considered:** an HTML popup menu — rejected, it would look and behave non-native and
  would duplicate keyboard/dismiss semantics macOS already provides. No change — leaves the primary
  secondary-action affordance of every Mac list absent.
- **Cost:** implementation medium; runtime negligible; maintenance low; no external service.
- **Boundary changes:** one new IPC channel carrying a Zod-validated descriptor. No SQLite change,
  no secret handling, no new network egress.
- **Kill criterion:** if the menu cannot be built in main from a typed descriptor without accepting
  renderer-supplied labels or behaviour, stop — the security boundary outranks the feature.
- **Decision:** proceed.

## Capability Contract

- **Objective:** a native `NSMenu` on secondary click over a result or saved row, whose entries are
  derived in the main process from a typed description of the item.
- **Goals:** Open in Browser, Copy Link, Copy Title, Copy Citation, Save/Remove, Analyze, and
  Promote to llm-wiki, each shown only when applicable to that item.
- **Non-goals:** no Sources/sidebar/settings context menus; no new analysis or promotion capability;
  no clipboard read.
- **Interfaces and public API invariants:** `TheRSSApi` gains `showContextMenu(target)`. Existing
  methods keep their signatures.
- **Data ownership and evidence semantics:** the descriptor is transient. Nothing is persisted, and
  no analysis provenance is produced or altered.
- **Failure states:** an invalid descriptor rejects at the IPC boundary; dismissing the menu returns
  `{ action: 'none' }`; a non-https URL hides the open/copy-link entries entirely.
- **Migration and rollback:** none. Removing the `onContextMenu` handlers fully reverts behaviour.
- **Observability/diagnostics:** none added.
- **Allowed scope:** `src/shared/contextMenu.ts`, `src/core/menus/`, `src/shared/{ipc,api}.ts`,
  `src/preload/index.ts`, `src/main/index.ts`, `src/renderer/src/{DiscoverView,SignalWorkspace}.tsx`
  plus their tests.
- **Persistent writeback:** none.

## Uncertainty Reducer

- **Change class:** new UI flow plus an IPC/security-boundary change.
- **Chosen artifact:** invariant matrix plus failing unit tests over a pure template builder. The
  interaction itself is an OS-provided menu, so a fixture-backed prototype would only re-prove
  macOS behaviour.
- **Question it must answer:** can every menu entry be derived in main from a typed descriptor, with
  no label or behaviour supplied by the renderer?
- **What it does not prove:** it does not prove the rendered macOS menu appearance, and it does not
  prove clipboard or external-open side effects, which are exercised manually.

## Frozen Acceptance Contract

- **RED verifier and expected failure:** `src/core/menus/contextMenu.test.ts` fails because
  `buildContextMenuTemplate` does not exist.
- **Focused unit/integration cases:** entry composition per item shape; Save vs Remove labelling;
  Analyze only when analysable; Promote only when promotable; non-https URLs drop the open/copy-link
  entries; no leading, trailing, or doubled separators; citation payload is deterministic; renderer
  handlers call the API with a correct descriptor.
- **Migration/rollback cases:** none.
- **E2E/manual path:** existing Electron E2E must stay green. Real right-click, clipboard content,
  and external open are manual macOS checks.
- **Screenshot/viewport/accessibility matrix:** the menu is OS-drawn, so it inherits system
  appearance, contrast, and keyboard handling. No new focusable renderer surface is added.
- **Security/dependency impact:** the descriptor is Zod-validated and length-bounded. Main builds
  every label. External opens reuse `isSafeExternalUrl`. No dependency added.
- **Package/install/live opt-in impact:** none.
- **Full verifier:** `npm run check:architecture`, `npm run check`, `npx playwright test`.
- **Stop condition:** RED/GREEN recorded, full check and E2E green, and every manual-only check
  reported explicitly rather than assumed.

### Acceptance-change log

| Date       | Contract change                                                                                                                              | Evidence/reason                                                                                                                                                                                                                                                                            | Reviewer    |
| ---------- | -------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ----------- |
| 2026-08-25 | Promote to llm-wiki removed from the renderer wiring; call sites pass `canPromote: false`. The core builder still emits and tests the entry. | Promotion state lives inside `PaperPromotionAction`, which owns the confirmation gate ADR 0008 requires. Triggering it from a context menu would either duplicate that gate or need a state lift that is a separate refactor. Recorded before implementation rather than silently dropped. | self-review |

## Independent Review

- **Product/contract fit:** matches scope, minus the recorded promotion amendment. Every entry maps
  to a capability the product already has.
- **Accidental scope or complexity:** none. No new capability, no new persisted state, no new
  network egress.
- **Test weakening:** none. No existing assertion was edited.
- **Input/secret/untrusted-content boundaries:** the descriptor is Zod-validated and length-bounded
  at the IPC boundary. Main derives every label from `buildContextMenuTemplate`; the renderer cannot
  supply a label, an accelerator, or a click handler. `open-external` re-checks `isSafeExternalUrl`
  in main even though the core builder already dropped non-https entries, so the guard holds even if
  the two ever disagree. `buildCopyPayload` returns null for unsafe URLs, so a `javascript:` or
  `file:` URL from a feed can reach neither the browser nor the clipboard. No clipboard read exists.
- **SQLite/IPC/migration/rollback:** one new channel; no schema or migration touched.
- **Diagnostics/package/update impact:** none.
- **Findings and resolutions:**
  1. _Resolved._ The first template builder risked emitting leading/trailing separators when a group
     was empty. Rewritten to assemble groups independently and join them, with a test asserting no
     leading, trailing, or doubled separator across five item shapes.
  2. _Resolved._ `isRendererContextMenuAction` was added so main narrows the action union instead of
     casting, keeping the copy/open branches provably unreachable in the returned outcome.

## Evidence Closeout

- **Changed files:** `src/shared/contextMenu.ts` (new), `src/core/menus/contextMenu.ts` (new),
  `src/core/menus/contextMenu.test.ts` (new), `src/shared/{ipc,api}.ts`, `src/preload/index.ts`,
  `src/main/index.ts`, `src/renderer/src/{DiscoverView,SignalWorkspace,App.test,App.testSupport,
SettingsView.test}.tsx|ts`, and this contract.
- **Deliberately untouched:** `PaperPromotionAction`, all SQLite code, all secret handling, the
  Sources view, the application menu bar.
- **Focused RED/GREEN:** `contextMenu.test.ts` failed on a missing module, then passed 15/15. The
  four renderer wiring tests passed with `App.test.tsx` at 17/17.
- **`npm run check:architecture`:** passed — all owned source files <= 800 lines.
- **`npm run check`:** passed. 56 test files / 379 tests. Statements 90.42%, branches 80.80%,
  functions 93.49%, lines 93.29% — all above the 80% floor.
- **Electron E2E:** 2/2 passed.
- **Live opt-in checks NOT run:**
  - A real secondary click producing a rendered macOS menu was **not performed**. The renderer
    dispatch and the main-process construction are unit-tested, but `Menu.popup()` has **no executed
    runtime evidence**.
  - Clipboard contents after Copy Link / Copy Title / Copy Citation were **not verified on a live
    machine**; only `buildCopyPayload` is tested.
  - `shell.openExternal` was **not observed** opening a browser.
- **Residual risks/blockers:**
  - Promote is absent from the menu at runtime, per the amendment above.
  - The Sources view still has no context menu.
  - Citations are built from discovery metadata only and are discovery evidence, not verified
    bibliographic records. This matches the project evidence boundary but is worth stating.
- **Rollback path:** remove the two `onContextMenu` handlers. The channel and core module then
  become unreferenced and can be deleted separately.
- **Git/install/push/publication state:** committed to `feat/apple-native-accent-and-menus`. No push,
  no packaging, no install, no publication.
