# Notes: ClashMac-reference implementation and mainline release

## Evidence inventory

- `PRODUCT.md` keeps Discover/Saved primary, Analytics/Sources secondary, and Settings focused on
  Personal Context plus one model provider.
- `App.tsx` owns the dashboard snapshot, active view, saved counts, source-health summary, and the
  existing 52 px top bar. No new API is required for contextual shell status.
- `DataAnalyticsView.tsx` already exposes lifetime totals and a persisted recent local-day window;
  the window total is currently embedded in Lifetime-card detail rather than a peer summary.
- `SourceCatalogView.tsx` already has a compact four-metric strip, explicit catalog-vs-health
  boundary, actionable attention filter, and text-labelled health. No additional Sources feature is
  needed; it becomes a verification target.
- README already documents the Apple-native accent/menu work and must be updated only for the new
  contextual status layer, four-card Analytics summary, and current verification evidence.

## Branch audit

- After `git fetch origin --prune`, local refs contain only `main`; remote heads contain only
  `refs/heads/main`. There are no old local or remote branches to delete.
- Local `main` was `81b3d5a` and `origin/main` was `9b645b6`, with divergence `4 1`.
- The divergence is history-only: `git diff --stat origin/main..main` is empty and both commits point
  to tree `31c12ad18ab085d82841b30685b2fd203d0b08d5`.
- Local history preserves three Apple-native commits plus merge; GitHub main contains PR #29's squash
  commit. Final integration should merge `origin/main` without discarding either history.
- One worktree exists at `/Users/dtjgp/Projects/TheRSS`; no linked worktree holds an old branch.

## Apple-native provenance closeout

- The previously dirty slice is no longer dirty: it is committed locally and published remotely.
- Local merge `81b3d5a` and remote squash `9b645b6` are content-identical.
- Current task starts with only its new audit directory untracked. Full runtime/check/package
  revalidation remains scheduled in Phase 7.

## RED/GREEN record

### RED

- Command: `npm test -- src/renderer/src/AppTopbar.test.tsx src/renderer/src/DataAnalyticsView.test.tsx src/renderer/src/styles.test.ts`.
- Expected failures observed:
  - `AppTopbar.test.tsx` could not resolve the not-yet-created `AppTopbar` component;
  - Analytics tests could not find `Last 7 local days` as a first-class summary card;
  - the style contract could not find contextual top-bar rules, a four-column Analytics summary,
    or its narrow 2x2 layout.
- Existing assertions in the three focused files otherwise remained green; no test was weakened.

### Integration finding

- The first six-file renderer integration run passed 69/71 tests. Both failures were caused by the
  new persistent `role=status` making existing transient Personal Prompt and triage statuses
  non-unique.
- This is an accessibility design issue, not an incorrect legacy test. The frozen contract was
  amended before implementation/test edits: `View context` uses `role=group`, `aria-live=polite`,
  and `aria-atomic=true`; transient terminal feedback keeps `role=status`.
- A second run passed 70/71. The remaining failure correctly protected the old Settings behavior:
  `Unsaved changes` must still be a status. The final semantic model is a non-live labelled context
  group with a nested status only for the unsaved primary label.

### GREEN

- Focused component/style run: 3 files / 24 tests passed.
- Six-file renderer integration run after the semantic correction: 6 files / 71 tests passed.
- `npm run check:architecture` passed; every owned TypeScript/TSX file remains at or below 800 lines.
- `git diff --check` passed.
- Production implementation extracts `AppTopbar.tsx`, derives context only from the existing
  dashboard/saved/filter/settings state, and leaves `TheRSSApi`, IPC, SQLite, source adapters, and
  provider contracts unchanged.
- Analytics now exposes four peer summaries: lifetime returned records, the persisted recent local
  window, deep analyses, and distinct analyzed papers. The recent window is calculated only from
  `snapshot.daily`; no history is reconstructed.

### First Electron E2E attempt

- Sidebar resize E2E passed.
- Desktop E2E reached Sources and showed `22 not checked · 22 configured`; the new test had
  incorrectly assumed an attention state. The fixture has no recorded source run at that step, so
  the UI is correct and the assertion was corrected to the exact honest state. Partial/failed
  attention remains covered by `AppTopbar.test.tsx`.

### Prototype acceptance

- `prototype.html` switches deterministically between Discover, Saved, Data Analytics, Sources, and
  Settings status states using only existing product concepts.
- Accepted wide Discover screenshot: `01-prototype-discover.jpg`.
- Accepted wide Analytics screenshot: `02-prototype-analytics.jpg`.
- Accepted 820 px Analytics screenshot: `03-prototype-analytics-820.jpg`.
- At 820 px the secondary top-bar copy is removed, the primary text label remains, and the four
  Analytics metrics reflow to a 2x2 bordered strip without clipping.
- The prototype keeps search/triage controls out of the top bar, uses text plus a status dot, and
  preserves the editorial main surface. Proceed to focused RED tests.

## Rendered verification

- Full Electron E2E: 2/2 passed after one fixture-assertion correction.
- Installed-binary desktop E2E: 1/1 passed against
  `/Users/dtjgp/Applications/TheRSS Dev.app/Contents/MacOS/TheRSS`.
- Accepted current-run screenshots:
  - `01-discover-first.png` — wide Discover with contextual source state;
  - `01a-discover-820.png` — real 820 px window with no horizontal overflow and compact primary
    context only;
  - `04-saved.png` — saved count plus active source filter;
  - `05a-personal-prompt-dark.png` — dark appearance;
  - `05f-settings-forced-colors.png` — forced colors and focus;
  - `05z-settings-200-percent.png` — 200% zoom without horizontal overflow;
  - `06-analytics.png` — four honest peer summaries;
  - `07-sources-directory.png` — `not checked` distinct from attention/failure;
  - `09-installed-app-current.jpg` — actual installed app with the user's current local state.
- README hero image was refreshed from the accepted current-run wide Discover fixture.
- Native smoke with the original multicolor setting reported `007AFFFF -> blue`, then a temporary
  Purple selection reported `953D96FF -> purple` and DOM `data-system-accent=purple`; System Settings
  was restored to Multicolor and a final smoke again reported `007AFFFF -> blue`.

## Packaging and install

- `npm run install:local` succeeded and installed `/Users/dtjgp/Applications/TheRSS Dev.app`.
- Previous app retained at
  `/Users/dtjgp/Applications/TheRSS Dev.backup-2026-08-25T16-36-46-930Z.app`.
- Database backup created at
  `/Users/dtjgp/Library/Application Support/therss/backups/therss-2026-08-25T16-36-46-930Z.sqlite`.
- `npm run smoke:package` passed against the installed executable.
- Release and installed `app.asar` SHA-256 both equal
  `fc1affef5c7c6afe7f9929b920b1341ed9a908c897d0a8dbf4a9deedb12386cc`.
- Current SQLite and the new backup both returned `PRAGMA integrity_check = ok` in immutable
  read-only mode.
- Installed metadata is `dev.dtjgp.therss`, version `0.2.0`; build remains unsigned because no valid
  Developer ID Application identity exists, consistent with the personal-beta boundary.

## GitHub closeout

- Product commit: `b1f89d9 feat(ui): add contextual research status`.
- History reconciliation merge: `599db7f merge: reconcile published Apple-native history`.
- The merge retained local three-commit Apple-native history and remote PR #29 squash history.
- `git diff --stat b1f89d9..599db7f` is empty, proving the reconciliation merge changed no product
  content.
- Local and remote branch inventories each contain only `main`; there are no old branches to delete.
- Pre-push divergence after reconciliation: local main ahead 6, behind 0.
- Final documentation commit, push, and remote SHA verification: pending.
