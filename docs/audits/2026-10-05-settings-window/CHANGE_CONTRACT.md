# Change Contract: separate Settings window (S4, F12)

Scope authority: on 2026-10-05 the user asked to continue the remaining
[UX audit](../2026-09-23-apple-native-ux/REPORT.md) work and chose decision D5 option
"独立窗口，移出侧边栏": Settings opens in its own window and leaves the sidebar.

## Feature Intake

- User outcome: Command-comma (or TheRSS → Settings…) opens one Settings window, as in Mail and
  Notes. The workspace window keeps its content while the user edits settings.
- Current behaviour (code, 2026-10-05): Settings is the fifth sidebar workspace of the native
  window; a pop-up switches between "Personal context" and "Model provider"; leaving it with
  unsaved edits asks to discard them.
- Product fit: the same two panes, explicit Save, provider test-before-save and protected
  credential rules. Only the window structure changes.
- Decisions inside scope (default, reversible): the window title names the selected pane;
  "Open Settings" recovery buttons in Discover and reading open the Model Provider pane;
  section drafts survive pane switches (unchanged).
- Alternatives: keep the in-window route (rejected by D5); a window plus a sidebar entry
  (rejected by D5).
- Boundary changes: native-only `NativeSettingsPresenter`; toolbar `style: 'preference'` and
  `selected` (NSWindowToolbarStylePreference, selectable items); symbol `person.crop.circle`;
  `NativeContext.openSettings`; `NativePresenterPort.openSettings`; `NativePresenter.settingsChanged`;
  main-process Settings window (single instance, `native-host.html`, sandboxed preload as the
  other windows). No IPC channel, SQLite, network or package change. The Web fallback keeps its
  in-window Settings route.
- Kill criterion: stop if the Settings window can lose a dirty draft without confirmation,
  leave the main window with stale provider or personal-context state after Save, or prevent
  the main window from being recreated on activation.

## Capability Contract

- R1 (window): `open-settings` on the native route opens the Settings window, or focuses the
  existing one; a pane argument selects that pane. The main sidebar has four workspaces.
- R2 (panes): a preference-style toolbar shows "Personal Context" and "Model Provider" as
  selectable items; the selected item and the window title follow the pane. The pop-up section
  switcher and the description label are removed.
- R3 (guards): closing the Settings window with unsaved edits asks Keep Editing / Discard
  Changes; Keep Editing keeps the window and its drafts (including the secure draft); quitting
  with a dirty Settings window asks the same question (existing quit guard).
- R4 (sync): after a successful save or credential clear in the Settings window, the main
  window reloads provider, personal context and agent availability (Discover readiness and the
  personal-context line update without reopening the app).
- R5 (commands): with the Settings window focused, view commands go to the main window, item
  and triage commands are dropped, Command-comma focuses Settings; activation recreates the main
  window when only Settings or record windows remain.
- Non-goals: immediate-apply settings, frame restoration of the Settings window, Web fallback
  changes, new settings content.
- Allowed scope: `src/main/appkit/{settings,settingsPresenter(new),presenter,common,
discover,reading,presentation,testSupport}.ts` and tests; `src/main/{index,nativeAppKitRuntime,
recordWindowRouting,auxiliaryWindows(new)}.ts` and tests; `native/appkit/chrome.mm`;
  `scripts/smoke-native-appkit.mjs`; `PRODUCT.md`,
  `docs/USER_GUIDE.md`; this directory; the UX audit report.

## Frozen Acceptance Contract

- RED (unit): the main sidebar lists four workspaces without Settings; `open-settings` calls
  `port.openSettings` and leaves the route unchanged; Discover/reading "Open Settings" calls
  `openSettings('provider')`; the Settings presenter renders a preference toolbar whose selected
  item and title follow the pane, with no `settings-tab` pop-up; a successful save calls the
  port's `changed`; `settingsChanged()` reloads provider, prompt and agents in the main
  presenter; command routing treats the Settings window as auxiliary.
- Workflow smoke: the Settings steps run in a second native window opened by Command-comma;
  the toolbar reports `style: 'preference'` and the selected pane; save/test/secure-credential
  assertions keep their current strength; closing with a dirty draft shows Keep Editing (window
  stays, secure draft kept) then Discard Changes (window closes); after main-window recreation a
  reopened Settings window shows the saved prompt; the main Discover personal-context line reads
  "Personal context active" after the prompt is saved in the Settings window.
- Full verifier: `npm run check`; controls smoke; workflow smoke with and without screenshots.
- Stop condition: R1-R5 verified; no assertion weakened beyond the logged contract changes.

### Acceptance-change log

| Date       | Contract change                                                                                                                                | Evidence/reason                                                | Reviewer |
| ---------- | ---------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------- | -------- |
| 2026-10-05 | Presenter route list and "guards settings navigation" test: Settings is no longer a main-window route; the guard moves to the window close     | D5 decision; R1/R3                                             | user D5  |
| 2026-10-05 | Settings unit tests switch panes through the presenter toolbar/`select` instead of the `settings-tab` pop-up                                   | R2 removes the pop-up                                          | user D5  |
| 2026-10-05 | Workflow smoke Settings steps target the Settings window; discard-by-navigation becomes discard-by-close                                       | R1/R3; navigation away from Settings no longer exists natively | user D5  |
| 2026-10-05 | Workflow smoke route list loses `settings`; a new group "Settings opens in its own window and the workspace reloads saved context" (16 groups) | R1/R2/R4 need a real second native window                      | user D5  |

## Verification (2026-10-05)

- Unit RED: no `NativeSettingsPresenter`, no `SettingsScreen.select`, five sidebar routes,
  "Open Settings" navigating in-window, no `attachSettingsAppKit`/`selectSettingsPane`. GREEN
  after the change: `settingsPresenter.test.ts`, `settings.test.ts`, `presenter.test.ts`,
  `discover.recovery.test.ts`, `reading.test.ts`, `presentation.test.ts` (preference toolbar
  schema), `nativeAppKitRuntime.test.ts` (pane selection and cross-window reload).
- Rendered evidence (workflow smoke with screenshots): `settings-personal.png` and
  `settings-provider.png` show a separate window with a centered preference toolbar, icon and
  label per pane, the selected pane highlighted and the window title following it;
  `discover-light.png` shows four sidebar workspaces. The first run found the toolbar in
  icon-only mode (AppKit applies its default when the toolbar attaches); the display mode is
  now set after attachment and asserted as `iconAndLabel`.
- Workflow smoke with screenshots 16/16 (exit 0). Without screenshots: 16/16 groups in three
  runs; the first run then failed its final stderr check on one AppKit line "Window move
  completed without beginning", not reproduced in the next two runs (exit 0 both).
- Controls smoke: 19/19 groups. Electron E2E (Web fallback and AppKit quit): 8/8.
- `npm run check`: exit 0; 753 main and 151 AppKit tests; coverage at or above 80% on all axes.
- Not run: a real Command-comma key press (the smoke clicks the same menu item), package/install
  smoke, VoiceOver speech.
- Independent diff review (fresh-context reviewer): no blocker; no secret path to scene JSON,
  logs or the main window; no dirty-draft loss. Fixed:
  1. Medium: activation with only the Settings window open was untested. New
     `AuxiliaryWindows` registry (`auxiliaryWindows.test.ts`); the workflow smoke now closes the
     workspace window while Settings stays open and asserts that activation adds a new workspace
     window (two windows).
  2. Low-medium: a pane requested while the window was still attaching was dropped; the latest
     pane is now kept and applied after attachment.
  3. Low-medium (inferred): the quit prompt is a sheet on the dirty window; that window is now
     restored, shown and focused before the prompt.
  4. Low: a reload requested during startup was dropped and overlapping reloads could apply out
     of order; it now runs after startup and only the latest reload applies (unit test, RED first).
  5. Low: the reopened-window secure-draft check is strict again; the schema rejects search and
     sidebar items in a preference toolbar (unit test, RED first).
     Not changed: the "focuses the same window" smoke check asserts the window count only;
     `keyWindow` is unreliable while the fixture app is inactive (see `capture`).
- After the review fixes: `npm run check` exit 0 (756 main, 152 AppKit tests; coverage at or
  above 80% on all axes); controls smoke 19/19; workflow smoke 16/16 without screenshots (two
  runs) and with screenshots (one run).
