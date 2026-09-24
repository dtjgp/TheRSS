# Change Contract: native keyboard operation

Scope authority: on 2026-09-24 the user asked to commit the progress slice and "开始做键盘操作"
(audit finding F5 in the [UX audit](../2026-09-23-apple-native-ux/REPORT.md)).

## Feature Intake

- User outcome: standard macOS keys work: ⌘Z undoes the last Save/Unsave/Dismiss when focus is
  not in a text field, ⌘Return runs the Discover search, and Return closes read-only sheets.
- Observed problems (code, 2026-09-24):
  1. `dispatchNativeMenu('undo')` falls back to triage undo only when `bridge.edit` reports "not
     handled", but the bridge answers with `tryToPerform:@selector(undo:)`, which the responder
     chain may accept without undoing anything. The fallback is covered only by a unit test that
     mocks `edit` to return `false`.
  2. No keyboard submit for Discover: the question is multiline, Return inserts a newline.
  3. No native button has a key equivalent; sheets have no default button.
- Product fit: UI skill Familiarity/User control rows; no non-goal touched.
- Decisions inside scope:
  - Return is the default only in read-only document sheets (Help, Search details), whose only
    button is Close. Local search keeps Return for its field; the promotion sheet gets no Return
    default because it guards a vault write. Escape already cancels every sheet.
  - ⌘Z keeps text-field undo when a text view is first responder; otherwise it is triage undo.
- Boundary changes: bounded `shortcut` field on native button nodes; bridge undo semantics. No
  IPC channel, SQLite, network or package change.
- Kill criterion: stop if a key equivalent would fire while the user types in a text field
  (plain Return) or a destructive write could be confirmed by Return.

## Capability Contract

- K1: `bridge.edit('undo'|'redo')` reports handled only when a text view (or text field editor)
  is first responder; other responders report not handled so the presenter undoes triage.
- K2: button nodes accept `shortcut: 'return' | 'command-return'`, mapped to AppKit
  `keyEquivalent`/modifier mask; only button nodes may carry it.
- K3: Discover Search uses `command-return`; its tooltip names the shortcut.
- K4: document sheets' Close uses `return`; search and promotion sheets do not.
- K5: Help lists Command-Return and Command-Z (triage when not editing text).
- Allowed scope: `native/appkit/{bridge,node}.mm`, `src/main/appkit/{presentation,discover,modals,presenter}.ts`
  and tests, AppKit smoke scripts, this directory.

## Frozen Acceptance Contract

- RED (native): controls smoke: `edit('undo')` with a table first responder returns `false`; a
  `command-return` button fires its action from `performKeyEquivalent:` while a multiline text
  view is first responder and a plain Return there inserts a newline instead; inspection shows
  the key equivalent and modifier.
- RED (unit): schema accepts `shortcut` on buttons only; Discover Search carries
  `command-return`; document Close carries `return`; search/promotion Close carry none; Help
  mentions both shortcuts.
- Full verifier: `npm run check`; controls smoke; workflow smoke 14/14 (with and without
  screenshots).
- Stop condition: K1-K5 verified; no assertion weakened.

### Acceptance-change log

| Date | Contract change | Evidence/reason | Reviewer |
| ---- | --------------- | --------------- | -------- |

## Independent Review

- K1 was a real defect, not only a gap: before the change `bridge.edit('undo')` returned `true`
  with a table first responder (controls smoke RED), so Command-Z never reached triage undo in
  the native route. The runtime unit test mocked `edit` and could not see it.
- Assertions: none weakened; new checks only. The workflow smoke's Undo step gained a
  state-neutral Save → Edit ▸ Undo round trip with the result list focused.
- Safety: plain Return is a default only on read-only document sheets; Return in the multiline
  question still inserts a newline (native check); the promotion write keeps no Return default.
- Fixture-only additions: `shortcut` fixture action (via `performKeyEquivalent:`), key-equivalent
  inspection fields.
- Residual: the fixture `shortcut` action exercises `performKeyEquivalent:` directly, not a real
  hardware key event; Web fallback keyboard behaviour is unchanged and out of scope.

## Evidence Closeout

- Changed files: `native/appkit/{bridge,node}.mm`, `src/main/appkit/{presentation,discover,modals,presenter}.ts`
  and tests, `scripts/smoke-appkit-controls.mjs`, `scripts/smoke-native-appkit.mjs`.
- RED/GREEN: controls smoke failed (`edit('undo')` returned `true`) and passes 11/11; four unit
  tests failed and pass.
- `npm run check`: exit 0 (704 main, 113 AppKit tests; coverage above 80% on all axes).
- Native smoke: controls with screenshots 11/11; workflow 14/14 with and without screenshots.
- Not run: package/install, VoiceOver, hardware key events.
- Rollback: revert the slice commit. Git: uncommitted; installed app not updated.
