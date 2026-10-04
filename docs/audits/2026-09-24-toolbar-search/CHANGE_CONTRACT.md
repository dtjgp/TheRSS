# Change Contract: toolbar search for local research

Scope authority: on 2026-09-24 the user asked to commit the page-scroll slice and "开始做工具栏搜索框"
(audit finding F4 in the [UX audit](../2026-09-23-apple-native-ux/REPORT.md)).

## Feature Intake

- User outcome: local research search works like Notes/Music/Mail: a search field in the window
  toolbar; typing shows results in the content area; clearing (or Escape) returns to the current
  workspace; opening a result keeps "Back to search results". No modal sheet blocks the window.
- Current behaviour (code, 2026-09-24): Command-F or the toolbar Find button opens an 820x680
  modal sheet (`NativeModals` kind `search`) with a query field (250 ms debounce, local SQLite
  only via `searchLocal`), a result table, a detail line and "Open original". Activating a
  result calls `openLocal`, closes the sheet and records `localReturn`; "Back to search results"
  restores the origin workspace and reopens the sheet with the retained query and selection.
- Product fit: PRODUCT.md "Find Local Research ... filters as the user types, with a short
  debounce and no separate submit step ... no model, embedding, telemetry, or network request".
  The data path (`searchLocal`, `openLocal`) is unchanged.
- Design:
  - Toolbar item `local-search-query`: `NSSearchToolbarItem`; text changes (not while IME marked
    text is composing) drive the existing debounced search; Return in the field searches
    immediately (as in the sheet) and Return in the result list opens a record; the clear
    button or Escape empties the field and ends the search, also cancelling a pending open.
  - A non-empty query shows a `local-search-page` workspace in the content area (count, result
    table, selected detail, "Open original"); the sidebar keeps the current workspace selected;
    the window title reads "Search". Clearing the query restores the workspace.
  - Command-F focuses the toolbar search field (restoring the pre-open workspace first when a
    result was opened from search, as today).
  - Choosing a sidebar workspace ends the search.
  - The toolbar changes items incrementally so the search field keeps its text, caret and IME
    state when "Back to search results" appears or disappears.
- Alternatives: keep the sheet (status quo, audit F4); a suggestions menu under the field
  (rejected: results carry kind, source, date and detail and need a list/detail area).
- Boundary changes: typed toolbar item kind `search`; native `NSSearchToolbarItem`; search state
  moves from `NativeModals` into a `LocalSearchScreen`. No IPC, SQLite, network or package change.
- Kill criterion: stop if the toolbar search field cannot keep IME composition or focus across
  scene updates.

## Capability Contract

- T1: toolbar `search` item: id, title, placeholder, value, text action (max 200 chars),
  activate action; validated at the presentation boundary.
- T2: native search item emits text changes (skipping marked text), Return activation and
  clearing; programmatic value updates never replace text while the field is being edited.
- T3: toolbar updates insert/remove items instead of replacing the toolbar when only the item
  set changes; existing items are reconfigured in place.
- T4: `LocalSearchScreen` owns query, debounce, results, selection, open-in-app and open-original
  with the existing semantics and messages; `NativeModals` keeps only document and promotion.
- T5: presenter shows the search workspace while a query is active, restores the workspace when
  cleared, keeps `localReturn`, and focuses the toolbar field on Command-F.
- Non-goals: search scopes, recent searches, Web fallback overlay.
- Allowed scope: `native/appkit/{chrome,host,bridge}.mm`, `native/appkit/ui.h`,
  `src/main/appkit/{presentation,presenter,modals,localSearch(new)}.ts` and tests,
  `src/main/appkit/testSupport.ts`, AppKit smoke scripts, this directory.

## Uncertainty Reducer

- Technical spike (controls-smoke fixture window with a scene toolbar): NSSearchToolbarItem
  installs through the existing toolbar delegate; typed/filled text emits the text action;
  marked text is not emitted; Return emits activate; focus by scene id works; inserting a
  second toolbar item keeps the same search field instance and its text.
- Spike result (2026-09-24): controls smoke 12/12 including the toolbar search group; the field
  kept its instance and typed text when a second item was inserted and ignored a stale scene
  value while editing. Kill criterion not met.

## Frozen Acceptance Contract

- RED (native): the spike assertions above in `smoke-appkit-controls.mjs`.
- RED (unit): toolbar `search` schema; `LocalSearchScreen` debounce/selection/open/stale-result
  cases migrated from the modal tests; presenter shows/clears the search workspace, keeps
  `localReturn`, and focuses `local-search-query` on Command-F; navigation ends search.
- Full verifier: `npm run check`; controls smoke; workflow smoke 14/14 with and without
  screenshots, with the local-search step migrated to the toolbar field.
- Stop condition: T1-T5 verified; every changed assertion logged below.

### Acceptance-change log

| Date       | Contract change                                                                                                                                                                                                                                   | Evidence/reason                                                                                 | Reviewer |
| ---------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------- | -------- |
| 2026-09-24 | Six search tests move from `NativeModals.openSearch()` to `LocalSearchScreen` through `localSearchHarness` (toolbar field as a `local-search-query` node); "close" becomes clearing the field                                                     | T4 moves search out of the sheet; debounce, stale-result, open and message assertions unchanged | user F4  |
| 2026-09-24 | `localNavigation.test.ts` reads the query from the toolbar item, expects `local-search-page` instead of a modal, clears the field instead of `modal-close`, and reads `local-search-message`                                                      | Same navigation/return/stale-lookup intent without the sheet                                    | user F4  |
| 2026-09-24 | `presenter.test.ts` toolbar items are `sidebar-toggle`, `local-search-query` (kind `search`), `undo-triage` instead of the `open-local-search` button                                                                                             | T1/T5 replace the Find button with the search field                                             | user F4  |
| 2026-09-24 | Workflow smoke local-search step drives the toolbar field: focus is the field's `editing` state, results/restores are read from the content root and toolbar, closing is Escape in the field; the sheet-only Tab-containment assertion is removed | No sheet exists; the field keeps standard toolbar tab order                                     | user F4  |
| 2026-09-24 | Workflow smoke S1 toolbar assertion lists `local-search-query` instead of `open-local-search`                                                                                                                                                     | Found by the first verifier run; T1 replaces the Find button                                    | user F4  |
| 2026-10-04 | Controls smoke adds: a repeated scene focus on an editing search field emits nothing and keeps the edit; moving focus to a content input emits no `search-text` clear                                                                             | Regression for the failure below; RED on the pre-fix native build, GREEN after                  | user F4  |

## Failure and fix (2026-10-04)

- Symptom: the workflow smoke without screenshots failed at the local-search step in every run;
  the main process received `pruning` and then an empty value for the same text action.
- Cause (native call stack captured with a temporary emit trace): a scene that repeats
  `focus: local-search-query` called `-[TRChrome focusSearchField:]` while the field was already
  editing. `makeFirstResponder` ended the edit, `-[NSTextField textDidEndEditing:]` sent the field
  action, and `searchActivated:` read the detached, empty field editor and emitted a clear. With
  screenshots the window is in the background, so the refocus did not end the edit.
- Fix (`chrome.mm`): `focusSearchField:` keeps a field that is already editing; the search cell
  sets `sendsActionOnEndEditing = NO`, so only Return, the clear button and Escape send the action.
- The temporary diagnostics from the investigation (runtime delivery trace, `search-delivery.json`,
  inspection fields `lastEvent`/`delegate`/`specAction`, emit trace) are removed.

## Verification (2026-10-04)

- Controls smoke: RED on the pre-fix native build ("Repeated scene focus emits nothing"); GREEN
  12/12 groups after the fix.
- Workflow smoke: without screenshots 14/14 in two consecutive runs; with screenshots 14/14.
  The local-search screenshot shows the toolbar field, the "Search" title and in-content results.
- `npm run check`: exit 0; 705 main and 114 AppKit tests; coverage at or above 80% on all axes.
- Not run: package/install smoke, VoiceOver.
- Stop condition: T1-T5 verified; all changed assertions are logged above.
