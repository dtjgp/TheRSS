# Apple-native UX audit (2026-09-23)

Scope: how closely the native AppKit route matches first-party macOS applications in ergonomics
and UI/UX. Authority: [project UI skill](../../../skills/therss-ui-improvement/SKILL.md) with its
Apple-design adaptation and accepted `3 / 2 / 7` profile. Base commit `0194f4f`.

## Evidence and limits

- Installed app `dev.dtjgp.therss` screenshots on 2026-09-23: Discover, Saved and Settings (light,
  1306 px window). The window was on a full-screen Space, so background clicks were refused;
  Data Analytics, Sources and sheets were reviewed from source only.
- Source review: `native/appkit/*.mm`, `src/main/appkit/*.ts`, `src/main/index.ts`,
  `src/main/applicationMenu.ts`.
- Not assessed: dark-mode screenshots, VoiceOver speech, narrow-window screenshots, the Web fallback.

## Summary

Controls are genuine AppKit (NSTableView, NSSplitView, NSGlassEffectView, secure input, IME,
contrast/transparency preferences, VoiceOver announcements). The gap to first-party apps is the
**window structure and interaction patterns**. Root cause: the presentation bridge exposes 13 node
kinds and 12 SF Symbols ([presentation.ts](../../../src/main/appkit/presentation.ts)); layout is
hand-computed frames in [node.mm](../../../native/appkit/node.mm). A search of `native/` and
`src/main/` found no use of NSToolbar, NSSearchField, NSSegmentedControl, NSProgressIndicator,
NSOutlineView/source-list style, NSPopover, `keyEquivalent`, NSSplitViewController,
NSSharingService or drag registration.

## Findings

### P0: window structure

| ID  | Finding                                                                                                                                                           | Evidence                                     | Native pattern                                                                                                 |
| --- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------- | -------------------------------------------------------------------------------------------------------------- |
| F1  | No toolbar; an empty ~32 pt strip sits under the traffic lights; the sidebar glass starts below it. Find and Undo are text buttons in a content row.              | Screenshots; `presenter.ts` `native-toolbar` | Unified NSToolbar with window title/subtitle, sidebar toggle and search field; sidebar reaches the window top. |
| F2  | Sidebar is a column of buttons: AX role `AXButton`, no arrow-key movement, 23 pt brand plus "YOUR RESEARCH DESK", collapsed state is 84 pt of text without icons. | AX summary; `presenter.ts` `native-sidebar`  | NSSplitViewController sidebar item with a source-list NSOutlineView; collapse hides it with animation.         |
| F3  | Page-level scroll around independently scrolling panes; "Show 24 more" pagination.                                                                                | `adaptiveScroll` on `native-main`; Discover  | Fixed panes filling the window; NSTableView handles all rows lazily.                                           |
| F4  | Local search is an 820×680 modal sheet that blocks the window.                                                                                                    | `modals.ts`                                  | NSSearchToolbarItem filtering in place with scopes (Mail, Notes).                                              |

### P1: interaction and ergonomics

| ID  | Finding                                                                                                                               | Status        |
| --- | ------------------------------------------------------------------------------------------------------------------------------------- | ------------- |
| F5  | No default buttons or `keyEquivalent`; no Command-Return submit; triage undo is a separate button instead of NSUndoManager/Command-Z. | **Fixed S2**  |
| F6  | Discover progress is text only, although PRODUCT.md describes native source progress.                                                 | **Fixed S3**  |
| F7  | Two-line result titles clipped without an ellipsis.                                                                                   | **Fixed S0**  |
| F8  | Row labels drawn ~8 px above adjacent controls; single buttons stretched to column width (Saved "Open Settings").                     | **Fixed S0**  |
| F9  | Result status showed the raw enum (`partial`).                                                                                        | **Fixed S0**  |
| F10 | View menu shortcuts only for Discover and Saved.                                                                                      | **Fixed S0**  |
| F11 | Result-kind filter is a pop-up (segmented control or scope bar is native); the 22-source picker expands inline (popover is native).   | **Fixed S3**  |
| F12 | Settings is an in-window route with a pop-up section switcher and duplicate headings; native apps open a separate Settings window.    | Decision (D5) |
| F13 | Ad hoc font sizes (23/14/12/11/10) instead of system text styles; in-content large titles; empty states are a single label.           | Open (S1)     |
| F14 | No kind glyph or Saved star in result rows; ISO dates throughout (localized display is a product decision).                           | Open/decision |

### P2: platform integration

Share submenu (NSSharingServicePicker), dragging rows out as URL/citation to Zotero, Obsidian or
Mail, opening a record in its own window, and animated NSSplitViewController transitions within
`MOTION_INTENSITY 2`. Quick Look of remote URLs is rejected because it renders remote HTML.

### Keep

Inset NSTableView lists, keyboard-resizable dividers, IME draft guards, contrast and
transparency fallbacks, glass foreground contrast handling, accessibility announcements, grouped
context menus, standard menu roles and the dedicated secure-input path.

## Roadmap

| Slice | Content                                                                                         | Gate                                        |
| ----- | ----------------------------------------------------------------------------------------------- | ------------------------------------------- |
| S0    | F7-F10 quick fixes                                                                              | **Done**, see below                         |
| S1    | Typed `toolbar` and `sidebar` (source list) node kinds; remove title strip and sidebar branding | **Done**, [contract](S1_CHANGE_CONTRACT.md) |
| S2    | Default buttons, Command-Return, NSUndoManager triage undo                                      | **Done**, see S2/S3 progress                |
| S3    | Toolbar search replacing the sheet; `progress`, `segmented`, `popover` node kinds               | **Done**, see S2/S3 progress                |
| S4    | Separate Settings window                                                                        | Decision gate D5 first                      |

Every new node kind keeps zod validation at the presentation boundary, AppKit smoke coverage and
the 800-line limit.

## S0 outcome

[Change contract](CHANGE_CONTRACT.md) and [verification summary](verification.json).

- Titles: `truncatesLastVisibleLine` on research-row titles; inspected as `titleTruncates`.
- Rows: labels in non-wrapped rows get a text-height frame centered on the row.
- Columns: non-navigation buttons keep intrinsic width, leading-aligned.
- Status: `Partial results · 20 of 22 sources complete · 2026-09-07`, derived only from
  persisted source outcomes (`healthy` and `no_results` count as complete; `not_searched` excluded).
- Menu: View → Data Analytics (Command-3), Sources (Command-4), native and Web fallback.

Verification: `npm run check` exit 0 (690 main, 105 AppKit tests; coverage ≥ 80% on all axes);
AppKit controls smoke 9/9 groups. The workflow smoke stopped at the Sources step on a
pre-existing aged fixture (item dated 2026-08-14, outside the 2026-08-24..2026-09-23 window);
with only that step disabled in a disposable copy, 13/13 groups passed. Fixing that fixture is a
separate task. Window screenshots were unavailable (full-screen Space); package/install and
VoiceOver were not run.

## S1 outcome

[S1 contract](S1_CHANGE_CONTRACT.md) and [verification summary](verification-s1.json).

- The native route uses a standard-frame window with full-size content, a unified NSToolbar and a
  visible workspace title; AppKit places the traffic lights. The empty title strip is gone.
- Toolbar: sidebar toggle (navigational, before the title), Back to search results when
  available, Find local research, Undo triage.
- Sidebar: AppKit source list with SF Symbol rows, arrow-key navigation and table accessibility
  roles; branding removed; collapse hides it entirely.
- Notices moved to a fixed status row at the bottom of the content column.
- Findings F1 and F2 are closed. The title sits over the sidebar column because
  `NSTrackingSeparatorToolbarItem` needs an NSSplitViewController (future S-slice).
- Open: one intermittent workflow-smoke failure (trailing space in the query field) in 5 runs.

## F13 (partial) outcome: duplicated page titles

Requested 2026-09-24. The window title already names the workspace, so the in-content 23 pt
headings `discover-title`, `saved-title`, `analytics-title`, `sources-title` and `settings-title`
were removed; content now starts directly below the toolbar.

- RED/GREEN: `presenter.test.ts` "names each workspace once" failed before and passes after.
  No existing assertion changed.
- `npm run check`: exit 0 (692 main, 107 AppKit tests). AppKit controls smoke 9/9. Workflow smoke
  (aged Sources step disabled as before): 13/13 in 2 of 3 runs; one screenshot-enabled run failed
  in window recreation (personal prompt read empty), not reproduced in two reruns.
- Still open in F13: Settings pane headings ("Personal context", "Model provider") repeat the
  section pop-up value; ad hoc font sizes; single-label empty states.

## S2/S3 progress (2026-09-24 to 2026-10-04)

Each slice has its own change contract and verification record.

| Finding        | Outcome                                                                                                                                                   | Contract                                                                              |
| -------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------- |
| F13 (Settings) | Settings pane headings that repeated the section pop-up value are removed.                                                                                | [settings-titles-progress](../2026-09-24-settings-titles-progress/CHANGE_CONTRACT.md) |
| F6             | Native `progress` node (NSProgressIndicator); Discover shows the three stages and the latest completed-source outcome.                                    | same                                                                                  |
| F5             | Command-Z reaches triage undo outside text views; Command-Return runs Discover; Return closes read-only sheets only; bounded button shortcuts.            | [keyboard](../2026-09-24-keyboard/CHANGE_CONTRACT.md)                                 |
| F3             | Discover lists every result in the lazy table (no "Show 24 more"); workspaces fit the window; page scroll is only a small-window fallback.                | [page-scroll](../2026-09-24-page-scroll/CHANGE_CONTRACT.md)                           |
| F4             | `NSSearchToolbarItem` replaces the search sheet; results fill the content area; clearing or Escape restores the workspace.                                | [toolbar-search](../2026-09-24-toolbar-search/CHANGE_CONTRACT.md)                     |
| F11 (filter)   | Native `segmented` node (NSSegmentedControl); the Discover result-kind filter shows every kind with its count.                                            | [segmented-filter](../2026-10-04-segmented-filter/CHANGE_CONTRACT.md)                 |
| F11 (popover)  | Discover sources open in a semi-transient NSPopover under "Sources (n/22)" instead of pushing the results down.                                           | [source-popover](../2026-10-04-source-popover/CHANGE_CONTRACT.md)                     |
| F14 (glyphs)   | Discover and Saved rows show a kind glyph; saved Discover results show a star instead of the " · Saved" text.                                             | [row-glyphs](../2026-10-04-row-glyphs/CHANGE_CONTRACT.md)                             |
| F13 (empty)    | Empty workspaces use a centered native composition: SF Symbol, title, explanation and recovery action; empty sessions keep their outcome.                 | [empty-states](../2026-10-04-empty-states/CHANGE_CONTRACT.md)                         |
| S1 residual    | The window split is hosted by an NSSplitViewController with a tracking separator: the toggle sits over the sidebar and the title over the content column. | [window-title](../2026-10-05-window-title/CHANGE_CONTRACT.md)                         |
| P2 (share)     | Context-menu Share submenu, a reading Share button (sharing picker) and dragging rows out as link, title and citation; https links only.                  | [share-drag](../2026-10-05-share-drag/CHANGE_CONTRACT.md)                             |
| P2 (windows)   | Double-click or "Open in New Window" opens a record read-only in its own window; item commands never act from it.                                         | [record-window](../2026-10-05-record-window/CHANGE_CONTRACT.md)                       |
| P2 (motion)    | The sidebar slides when hidden or shown (system split item animation); Reduce Motion changes it at once.                                                  | [sidebar-motion](../2026-10-05-sidebar-motion/CHANGE_CONTRACT.md)                     |
| F14 (dates)    | Native display dates follow the macOS language and region (UTC calendar day kept); evidence, citations and chart data stay ISO.                           | [localized-dates](../2026-10-05-localized-dates/CHANGE_CONTRACT.md)                   |
| F13 (styles)   | Labels use macOS text styles (Title 1/2, Body, Callout, Subheadline); the reading summary keeps 14 pt by decision.                                        | [text-styles](../2026-10-05-text-styles/CHANGE_CONTRACT.md)                           |

Still open: F12/S4 (decision D5).
