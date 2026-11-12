# Change Contract: My sources (default Discover sources)

Date: 2026-11-12, Europe/Rome. Base commit: `b1ea922`, plus the uncommitted, user-approved I2/I1/I4
changes listed in [BASELINE_STATUS.txt](BASELINE_STATUS.txt). Those changes are kept as they are.

## Authority

The user approved the proposal with “按照这个方案实现”. The approved contract and prototype are in
the Manager workspace (`docs/audits/2026-11-12-my-sources-proposal/`). This file freezes the
implementation decisions, RED cases and verification. Commit, push, merge, install, release, live
search/model calls, real vault writes and credential or system changes are not authorized.

## Feature Intake

- User outcome: choose the sources that new Discover searches use by default and keep that choice
  across restarts; adjust one search without changing the default.
- Evidence: `src/main/appkit/discover.ts` `load()` and `openLocal()` copy the latest/opened
  session's sources into the search draft; there is no stored default. Web `DiscoverView.tsx`
  does the same. Sources (`sources.ts`, `SourceCatalogView.tsx`) has no default-selection entry.
- Product fit: strengthens user-initiated Discover. Non-goals kept: no subscriptions, background
  refresh, named sets, custom groups, cleanup of Saved or old results, or a global network switch.
- Alternatives: keep per-search selection only (no lasting default); global source disable
  (rejected: changes browsing, refresh and retry).
- Cost: one SQLite table, two typed API methods, a shared chooser on both routes. No new dependency
  or runtime service.
- Kill criterion: stop if the default cannot be shared through SQLite and main-process validation
  for both routes.
- Decision: proceed.

## Capability Contract

### Storage and migration

- New table `discover_source_preference` (singleton row): `sources_json` (JSON string array),
  `origin` (`latest-session` | `all-sources` | `user`), `updated_at`.
- Created with `CREATE TABLE IF NOT EXISTS` in `migrateResearchDatabase`. In the same transaction,
  if the row is missing, it is initialized once:
  - from the latest `discover_session` whose `discover_source_run` rows have at least one current
    source with a status other than `not_searched` (origin `latest-session`);
  - otherwise all 22 current sources (origin `all-sources`).
  - Initialization performs no search and no network call.
- After the row exists, sessions never change it. Only an explicit save writes it (origin `user`).
- Read: stored IDs that are current sources are returned in registry order. Stored IDs that are no
  longer sources are returned as `unavailable`. New future sources are not added. If the valid set
  is empty, Discover blocks search until the user chooses sources.
- Save boundary (main process, Zod): 1–22 entries; each a current Discover source ID; duplicates
  are rejected (explicit rule: a request with a repeated ID is invalid, nothing is written);
  unknown or invalid IDs are rejected; 0 entries are rejected.
- Rollback: the table is additive. An older build ignores it; reverting the change set leaves an
  unused table. No data in other tables changes.
- Not stored in `NativePreferences` (layout file) or `localStorage`.

### Interfaces

- `TheRSSApi.getDiscoverSourcePreference(): Promise<DiscoverSourcePreference>`
- `TheRSSApi.saveDiscoverSourcePreference(sources): Promise<DiscoverSourcePreference>`
- `DiscoverSourcePreference = { sources, unavailable, origin, updatedAt }`.
- IPC channels with main-process validation; preload exposes both methods.

### Native (AppKit)

- Shared chooser (`sourceChooser.ts`): find field (name, research role, group), Only selected,
  Select shown / Clear shown (visible items only), group headers `Group · selected/total`, one
  checkbox per source with the real name and the catalog research role. No group toggles. Finding
  never changes the research question, hidden selections or the network.
- Sources: header button `My sources · N/22` opens a native sheet “Default search sources”:
  chooser, count, nearby “Select at least one source to save.”, Restore all (draft only), Cancel,
  Save default sources. Escape/Cancel discard the draft and return focus to the entry. Save
  failure keeps the draft and shows a retryable message. Save success closes the sheet and
  reports that new searches use the default; it starts no search.
- Discover: the source button reads `Sources for this search · N/22`. It opens the existing
  popover with the same chooser on a separate draft, mode text (default or custom), and Use
  defaults (draft only), Cancel, Apply to this search. Closing the popover cancels. Search still
  requires the Search button and sends only the applied sources.

### State rules

- Startup: the draft comes from the stored default. Loading the latest or a historical session
  (`load`, `openLocal`) no longer replaces the draft. A note shows the old session's source count
  when it differs from the next search.
- Saving a new default: if the draft equals the previous default and no run is active, the draft
  follows the new default; otherwise the draft and run are unchanged and a note says the default
  applies to future searches, with Use defaults available.
- A custom draft persists until changed, Use defaults, or restart. A finished search does not
  change it.
- Retry of a stored session uses its plan and its own failed/partial/canceled sources, not the
  default, and does not change the draft.
- Preference read failure: Discover shows an explicit message with Retry; the draft stays empty
  and search is blocked until the user chooses sources or the read succeeds.
- Late responses: a preference read that finishes after a save does not overwrite the saved value.

### Web fallback

- Same API and validation. A `SourceChooser` component is shared by the Discover picker (draft,
  Use defaults, Cancel, Apply to this search) and a Sources “My sources” dialog.
- Review round 1 (R1): the Web window keeps one Discover session per renderer (per API bridge):
  the unsubmitted question and runner, the sources of the next search, a running flag and the
  default-change note. It survives page changes and ends with a restart; it is never written as
  a preference. My sources saves through the same session, so the default-change rules above
  apply on the Web route as well. (The earlier "Web remount resets the draft" exception was not
  approved and is removed.)
- R2: the Web My sources dialog keeps Tab and Shift-Tab inside it (the same focus cycle as local
  search, now shared in `focusTrap.ts`); while saving every control is disabled and the dialog
  holds focus; Escape cannot close it until the save ends.
- R3: a native sheet may report `busy`; while busy, Escape, navigation and another sheet cannot
  end it (`NativeModals.blocksNavigation`). My sources is busy only while saving.
- Review round 2: a busy sheet also blocks Help (`openDocument`) and local search
  (`canOpenSearch`). The Web session owns the active run by ID (`startRun` refuses a second run,
  only the owner's `finishRun` clears it), so a rebuilt Discover view cannot start a second run.
  The native popover has an optional `cancel` action: Escape cancels and focus returns to the
  Sources button; an outside click still only closes. Open (R4): after an app switch with the
  popover open, real keys reach the research question; a fix needs a decision and an
  exclusive-desktop real-input verification.

## Uncertainty Reducer

- Change class: product capability plus storage/IPC boundary and UI flow.
- Artifacts: failing tests for store/migration, application/IPC, native state and screens, Web
  components; isolated native render driver with a temporary profile and synthetic data.
- Not proven: real-user database volume, physical input, VoiceOver.

## Frozen Acceptance Contract

RED cases (expected failure: missing API, table or behavior):

1. Store: no row + latest session with 3 searched sources → default is those 3, origin
   `latest-session`; no session → all 22, origin `all-sources`; existing row is not replaced by a
   newer session; save 1 and 22; reject 0, unknown, invalid type and duplicate IDs (row
   unchanged); unavailable stored IDs reported; corrupt JSON throws; reopen keeps the value.
2. Application/IPC: get/save delegate; invalid save rejected before storage.
3. Native Discover: draft from default, not from the latest session; old-session note; popover
   draft Cancel/Apply/Use defaults; Apply does not save the default; Search sends only applied
   sources; retry sends the session's own sources and keeps the draft; default change syncs only
   an unchanged draft with no active run; a custom draft and an active run are kept with a note;
   read failure blocks search with Retry; a late read does not overwrite a save.
4. Native chooser: find by role and group; Only selected; Select/Clear shown affect only visible
   items; hidden selections stay; group counts.
5. Native Sources sheet: entry count; Cancel/Escape discard and return focus; 0 blocks save with a
   nearby reason; Restore all changes only the draft; save failure keeps the draft and retries;
   success closes and does not search.
6. Web: Discover picker Apply/Cancel/Use defaults and default initialization; My sources dialog
   save/cancel/zero.
7. Discovery service: a search request runs only the requested sources (existing coverage
   checked, added if missing).

Verifier: focused tests, `npm run check:architecture`, `npm run check`, `npm run test:e2e`,
isolated native render (wide/narrow, light/dark, long names, focus/keyboard), native smoke with raw
logs kept on failure. Stop condition: RED→GREEN for all cases, gates run and reported as they are,
report written.

### Acceptance-change log

| Date       | Contract change                                                                                                                                             | Evidence/reason                                                       | Reviewer |
| ---------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------- | -------- |
| 2026-11-12 | `discover.polish.test.ts`: group toggle test replaced by Select/Clear shown on a found group, Only selected and Apply                                       | Approved chooser has no group toggles; changes need Apply             | Engineer |
| 2026-11-12 | `discover.recovery.test.ts`: zero choice now disables Apply with a nearby reason (was a readiness line after clearing)                                      | Approved: 0 sources cannot be applied                                 | Engineer |
| 2026-11-12 | `discover.test.ts`, `presenter.test.ts`, `workflows.test.ts`: new node ids and Select/Clear shown + Apply                                                   | Approved draft/Apply flow; no assertion removed without a replacement | Engineer |
| 2026-11-12 | Web `App.test.tsx`: clear/select all → Clear/Select shown with Apply disabled at 0; “restores the latest session subset” → “starts from the stored default” | Approved default-first rule                                           | Engineer |
| 2026-11-12 | `e2e/desktop.spec.ts` and `scripts/smoke-native-appkit.mjs` source steps: Select/Clear shown, Apply, new title                                              | Same contract change                                                  | Engineer |
| 2026-11-12 | Test API mocks (`testSupport.ts`, `App.testSupport.ts`, `SettingsView.test.tsx`, `SourceCatalogView.test.tsx`) gain the two preference methods              | New API surface only                                                  | Engineer |

## Evidence Closeout

See [REPORT.md](REPORT.md).

### Continuation slice (2026-11-12, user: “继续运行，网络已经恢复了”)

Scope: Manager `CONTINUATION_CONTRACT.md`. R4 option A: when the app loses the foreground
(`NSApplicationDidResignActiveNotification`), the native Discover source popover closes as a
cancel (plain `close` action: the unapplied draft is discarded); the research question, runner,
applied sources and the SQLite default are unchanged, and nothing reopens on return. The observer
is added when the popover is shown and removed on close, did-close and dealloc. Verification uses
an in-process fixture action (`app-resign-active`, fixture hosts only) that posts the app's own
notification; no other app is activated and no system-wide input is sent. The real-input
keyboard script is suspended behind `THERSS_ALLOW_REAL_INPUT=1` and is not part of any gate.
