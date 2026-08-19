# Notes: TheRSS

## User intent

- Daily discovery of relevant or potentially interesting arXiv papers.
- Daily discovery of relevant or potentially interesting GitHub repositories/trends.
- Personal interest configuration through topics and keywords.
- Selected-item analysis through Codex, Claude Code, user-supplied model APIs, or a DeepSeek harness.
- Very low-friction development updates and bug-fix iteration.
- Initial repository name: `TheRSS`.
- Project planning and quality gates should follow Google-style engineering practice.

## 2026-08-18 Apple-native editorial implementation contract

- The first development slice is the macOS window shell plus a Today/Saved list-detail workspace and keyboard triage.
- Preserve the existing editorial identity as a content accent, not as the control language: use system typography and Mac-like navigation/toolbar behavior for application chrome.
- Keep the current storage and evidence contracts unchanged. Selection is renderer state; Save, Dismiss, and Analyze continue to use the typed preload API and existing provenance-bearing services.
- Required renderer behavior: one selected signal, visible detail/inspector content, Arrow navigation, `S` Save toggle, `D` Dismiss, and `A` Analyze; shortcuts do nothing from editable controls.
- Required native behavior: hidden-inset macOS title bar, draggable application chrome, preserved traffic lights, flexible window layout, explicit focus states, dark-appearance tokens, and reduced-motion support.
- Verification must include deterministic renderer tests, Electron E2E, a current rendered screenshot, and package smoke before the installed development app is replaced.
- Implemented result: `SignalWorkspace` provides a persistent list-detail reading surface with accessible selection state, while Lucide icons and semantic CSS tokens provide native-like application chrome without changing the typed API or SQLite schema.
- Current verification: `npm run check` passed 130 tests and all four coverage thresholds; Electron E2E passed and produced `test-results/apple-native-today.png`; explicit release and installed-app smoke tests both passed.
- Local install: `~/Applications/TheRSS Dev.app` now contains the verified build. The previous application is `~/Applications/TheRSS Dev.backup-2026-08-18T15-04-16-135Z.app`, and the pre-install database backup is `~/Library/Application Support/therss/backups/therss-2026-08-18T15-04-16-135Z.sqlite`.

## 2026-08-18 Apple semantic color audit

- Today already uses a mostly native neutral shell, but onboarding, Interests, Models, Discover, analysis, and Data Analytics still inherit the earlier cream/forest editorial palette.
- The new source of truth should expose Apple-style semantic roles: label levels, system/grouped backgrounds, fill levels, separators, system status colors, and light/dark variants.
- Per-view tint is an orientation cue only: Today blue, Saved orange/gold, Discover indigo, Interests teal, Models purple, and Data Analytics cyan. Primary reading surfaces remain neutral.
- Legacy source colors become semantic source colors: arXiv system blue and GitHub system orange. Evidence/status meaning must not rely on color alone.

## Confirmed local context

- Target path `/Users/dtjgp/Projects/TheRSS` was absent before this project was initialized on 2026-08-15.
- Existing llm-wiki remains a separate canonical research knowledge base; TheRSS should integrate through narrow, previewable interfaces rather than owning the vault.
- The previous RSSReader application data and updater artifacts were removed from their active paths before this project began.

## Evidence to collect

- Official Google engineering-practice guidance relevant to design review, code review, testing, and launch.
- Official arXiv API/export behavior and rate guidance.
- Official GitHub APIs that can support an explainable approximation to repository trends.
- Current Codex and Claude Code MCP/CLI integration guidance.
- Current macOS personal-development and later distribution/signing constraints.

## Research findings

### Google engineering practices

- Source: <https://google.github.io/eng-practices/>
- Review should improve overall code health while permitting steady progress.
- Small, self-contained changes are easier to review, test, merge, and roll back.
- Tests should accompany production behavior and the build should remain working after each change.
- Reviews should cover design, functionality, complexity, tests, naming, documentation, and system context.

### arXiv

- Source: <https://info.arxiv.org/help/api/user-manual.html>
- The query API returns Atom 1.0 and supports category/field queries, paging, and submitted/updated sorting.
- Consecutive calls should be spaced by about three seconds.
- The same query does not need production polling more than once per day; results should be cached.

### GitHub

- Sources: <https://docs.github.com/en/rest/search/search> and <https://docs.github.com/en/search-github/searching-on-github/searching-for-repositories>
- Repository search supports name/description/topic/README terms plus stars, forks, created, pushed, language, topic, archived, and fork qualifiers.
- Search has a distinct rate limit: currently 30 authenticated or 10 unauthenticated requests per minute for non-code search.
- GitHub provides no stable official REST endpoint for the website's Trending ranking. The initial product must label its result `GitHub Interest Radar`, not `Official Trending`.

### Agent integration

- Codex and Claude Code both support MCP servers.
- One local MCP contract can serve both clients and avoid split read/triage state.

### Electron updates

- Electron documents that macOS automatic updates require a signed application.
- The unsigned personal-beta path should use hot reload and an explicit local build/install/rollback command rather than claim silent production updates.

## Working product hypothesis

TheRSS wins by combining deterministic, provenance-preserving discovery with a deliberate handoff to stronger analysis tools. It should not attempt to replace Zotero, Obsidian, llm-wiki, Codex, or Claude Code.

## Completion-audit findings

- The first local beta required manual refresh after every new day, which did not fully prove the promise that opening the app yields the day's signal. The accepted behavior is one automatic refresh on the first configured open of each local calendar day, same-day suppression, manual retry, and preservation of the last verified inbox on failure.
- Initial analysis artifacts identified the item, model, provider, prompt version, and time but not the exact source snapshot. They now require a SHA-256 hash over every discovery field included in the prompt so later metadata changes cannot silently blur provenance.
- A successful empty source response was previously labeled the same as a non-empty success. The persisted result count now derives an explicit `no_results` dashboard state without changing the legacy status constraint.
- A process exit during `refreshing` previously left a current-day timestamp that could suppress the next startup attempt. Only terminal source states now contribute to `lastRefreshAt`, so an interrupted refresh is retried on the next open.

## Environment findings

- Node `v26.7.0`, npm `11.19.0`, Git `2.55.0`, GitHub CLI `2.97.0`, Apple Silicon macOS `26.6.2`, and Xcode are present.
- On 2026-08-15, a network-enabled `gh auth status` confirmed an active keyring login for `dtjgp` with `repo` and `workflow` scopes. `dtjgp/TheRSS` did not yet exist; repository creation still requires an explicit public/private visibility choice.

## 2026-08-15 final local release audit

- `npm run check` passed: 17 test files and 72 tests passed; global coverage was 93.17% statements, 82% branches, 97.24% functions, and 94.8% lines.
- The Electron critical-path E2E passed with desktop execution permission. The restricted-sandbox `SIGABRT`/`EPERM` launch failure was environmental and reproduced the already documented sandbox boundary.
- Live source smoke passed with arXiv=3 and GitHub=25.
- The MCP stdio smoke passed all three read-only tools and verified source-hash provenance without secret fields.
- Electron `safeStorage` encryption/decryption passed, `npm audit --audit-level=high` reported zero vulnerabilities, and tracked-file secret-pattern review found no credentials.
- `npm run install:local` backed up the existing SQLite database, retained the previous application, installed the current build, and the packaged-app smoke passed.
- The local worktree was clean at commit `85577a0` before this audit writeback. GitHub publication and CI remain the only founding-goal evidence not yet available.

## 2026-08-15 publication evidence

- The user explicitly selected public visibility. The repository was created at <https://github.com/dtjgp/TheRSS> with `main` as its default branch.
- Initial local and remote `main` matched at `c41e63dce75eee258f9325ef20e23d5ad25a7380`.
- GitHub Actions run <https://github.com/dtjgp/TheRSS/actions/runs/31894821844> passed `npm ci`, `npm run check`, and `npm audit --audit-level=high`.
- A real `npm run update:local` completed from the new remote and preserved the database/application rollback artifacts.
- The first CI run warned that v4 GitHub Actions used deprecated Node.js 20; the workflow was updated to the official current `actions/checkout@v7` and `actions/setup-node@v7` lines.
- The local update used Node.js 24.13 and emitted a non-blocking `jsdom` engine warning; project setup now documents Node.js 24.15+ or 26. The full test, coverage, build, packaging, and install gates still passed.
- The personal beta remains intentionally unsigned and currently uses Electron's default icon. Signing/notarization and release branding remain later public-distribution work, not founding-goal requirements.

## 2026-08-15 Saved and local-agent analysis

- The existing `saved` triage state now drives a dedicated Saved view containing both arXiv papers and GitHub repositories, with source filters retained.
- Today and Saved expose a runner selector for the configured model provider, Codex CLI, or Claude Code.
- Local runners use bounded non-interactive child processes with schema-validated IPC, stdin-only untrusted metadata, reduced environment inheritance, timeout/output limits, and persisted analysis provenance.
- Current-machine detection found both Codex CLI and Claude Code. A real metadata-only smoke analysis completed successfully through each runner.
- `npm run check` passed with 86 tests and 93.19% statements, 83.43% branches, 94.02% functions, and 94.97% lines. The fixture-driven Electron E2E passed for model analysis, local Codex analysis, and Saved paper/repository navigation.

## 2026-08-15 brand alignment and account-sync assessment

- The sidebar mark is offset because the later `.brand-lockup span { display: block; }` rule overrides `.brand-lockup__index { display: grid; place-items: center; }`.
- Account login and synchronization are feasible but are not the same capability: OAuth establishes identity; a separate storage owner and conflict protocol synchronize data.
- API keys and macOS `safeStorage` ciphertext cannot be synchronized as portable credentials because the decryption key is OS-managed on the originating Mac.
- The regression test first observed `display: block` on the mark and passes after narrowing the descendant selector, fixing the mark at 42 px, and restoring Grid centering.
- Google officially supports installed-desktop OAuth through the system browser and a loopback redirect, with PKCE recommended. Drive `appDataFolder` offers a hidden per-app, per-user store behind the narrow `drive.appdata` scope, so it is the preferred first sync path without a TheRSS backend.
- GitHub device flow can authenticate a desktop app without embedding a client secret, but GitHub identity supplies no sync database. Gist or private-repository storage would require broader, more surprising permissions, so GitHub-backed cross-device sync should wait for an explicit storage/backend decision.

## 2026-08-16 selected Google Drive sync scope

- The user selected optional Google Drive synchronization for interests, saved items, and dismissed state.
- Analysis text, API/provider credentials, OAuth tokens, local Codex/Claude state, source caches, and diagnostics remain device-local.
- SQLite remains the operational source of truth; Google Drive `appDataFolder` carries a bounded, versioned synchronization document rather than a database copy.
- Automated tests must use deterministic OAuth and Drive fixtures. Live Google authorization is an explicit opt-in release check requiring a user-owned OAuth desktop client registration.
- Implementation uses system-browser Desktop OAuth with S256 PKCE, a random `127.0.0.1` callback, the narrow `drive.appdata` scope, fixed HTTPS endpoints, and OS-encrypted refresh-token persistence. Access tokens stay transient in Electron main.
- Each Mac owns a bounded `therss-sync-v1-<deviceId>.json` Drive shard. Version vectors merge causal changes; concurrent different interests require an explicit choice, and concurrent Dismissed wins over Saved to prevent resurrection.
- Saved state includes a bounded discovery snapshot so a new Mac can render saved papers/repositories before rediscovery. Dismissed-only records are replayed after later source discovery.
- Review found and fixed two race boundaries: edits made while an interest conflict awaits resolution are merged into the chosen result, and Drive upload/delete operations are serialized so deletion cannot be followed by a stale shard rewrite. An upload-time local edit triggers a follow-up sync and is not cleared from the pending counter prematurely.
- Final deterministic evidence: `npm run check` passed with 148 tests and 93.61% statements, 83.87% branches, 94.64% functions, and 95.44% lines; Electron E2E, macOS `safeStorage` smoke, and `npm audit --audit-level=high` also passed.
- Not yet claimed: live Google login/Drive I/O. Before withdrawal it required the user to enable Drive API, configure OAuth consent, and supply a Desktop OAuth client ID; the corresponding setup guide was removed with the implementation in Phase 11.

## 2026-08-16 synchronization withdrawal

- The user explicitly withdrew all login options and deferred synchronization.
- Rollback scope: remove the Sync navigation/settings, Google OAuth/Drive implementation, sync IPC/preload types, sync SQLite bookkeeping, sync-specific tests, and user setup guide.
- Preserve unrelated completed work: Saved paper/repository shelf, direct local Codex/Claude analysis, sidebar icon correction, packaging assets, and existing model-provider credential support. Model-provider API-key configuration is not an account login and remains in scope.
- Keep the architectural decision as historical evidence but mark it superseded/deferred; do not leave instructions that suggest login or synchronization is currently available.
- The rollback uses a migration that removes only the experimental sync credential/bookkeeping tables. It retains the local interest profile, discovery items, Saved/Dismissed state, provider configuration, and analysis artifacts.
- Verification after withdrawal: 89 automated tests passed; coverage remained above 80% in statements, branches, functions, and lines; production build and the Electron critical-path E2E passed with explicit assertions that no Sync button or Google Drive text is present.
- No live Google authorization had been verified before withdrawal. The rollback removes any locally stored experimental refresh-token ciphertext on next database open, but it does not mutate a remote Google account or Drive data.

## 2026-08-16 repository cleanup audit

- User-authorized scope: remove content that is no longer used while preserving version-control information.
- Safety boundary: preserve `.git`, all tracked source/history, current uncommitted product changes, icon design provenance, user data, dependencies needed for active development, and any file whose purpose is uncertain.
- Initial known cleanup candidate: `release/` is ignored, reproducible Electron Builder output. The newest `release/mac-arm64/TheRSS.app` contains the approved v5 icon; older DMG/update metadata predates that package.
- No cleanup target will be removed until exact paths, file types, symlink status, regeneration command, and Git status are recorded.
- Baseline: repository 1.1 GB; `.git` 9.1 MB; `node_modules` 628 MB; `release` 479 MB; `out` 1.4 MB; coverage/report/test output about 1 MB. `HEAD` and the local `origin/main` tracking ref both resolve to `0126fcd29b63ef21e9ca601ed3d8e0a47804f434`.
- `git fsck --full` found no corrupt or missing objects. It reported dangling objects, so cleanup deliberately excludes Git garbage collection/pruning to preserve possible recovery evidence.
- Keep: `.git`, all tracked/current source work, `node_modules` (active installed dependency tree), `assets/brand/therss-icon-v1.png` through `v5.png`, their design notes, `build/icon.png`, and superseded architecture decisions.
- The only source-tree sync remnants are the intentional database migration and regression test that delete withdrawn sync tables/credential ciphertext. They remain active safety behavior. The former implementation directories `src/core/sync/google` and `.github/ISSUE_TEMPLATE` are empty.
- Recoverable cleanup manifest: root `.DS_Store`; `out`; `coverage`; `playwright-report`; `test-results`; the two empty directories above; and every child of `release/` except `release/mac-arm64/TheRSS.app`. The retained app is the current v5-icon installation candidate.
- The manifest was moved to `/Users/dtjgp/.Trash/TheRSS-cleanup-20260816-phase12/`. Post-move checks confirmed all source paths absent and all recovery targets present; `release/mac-arm64/TheRSS.app` remains intact with `CFBundleIconFile = icon.icns`.
- Static reachability audit: all 48 TypeScript/TSX files are reachable from Electron main/preload/renderer, MCP, declaration, or test entries; no orphan source file was found. The only unresolved relative import was the expected CSS side-effect import. TypeScript also passed with `--noUnusedLocals --noUnusedParameters`.
- Dependency audit: `npm ls --depth=0` is complete with no missing/extraneous top-level packages; `npm prune --dry-run` proposed no removals. `node_modules` is therefore active, not obsolete residue.
- Content hashing found one deliberate duplicate: `assets/brand/therss-icon-v5.png` and `build/icon.png`. Keep both because the former is the approved design source and the latter is the stable Electron Builder input.
- `npm run check` passed after cleanup: formatting, lint, type checking, all 18 test files / 89 tests, coverage thresholds, Electron/Vite build, and MCP build succeeded. Coverage was 93.26% statements, 83.57% branches, 94.07% functions, and 95.04% lines.
- The first `npm run test:e2e` attempt rebuilt successfully but the restricted desktop sandbox aborted Electron before assertions with `SIGABRT` and `kill EPERM`; this is an environment boundary and requires the established desktop-permission retry.
- The desktop-permission E2E retry passed its single full critical-path test. The initial dependency-audit attempt then failed only because the restricted network could not resolve the npm registry; a network-permission retry is required for a valid result.
- The network-permission `npm audit --audit-level=high` retry reported 0 vulnerabilities.
- After verification, regenerated `out`, `coverage`, `playwright-report`, and `test-results` were moved to the recovery directory again. Final project size is approximately 978 MB versus the initial 1.1 GB; the recovery directory is approximately 152 MB and continues to consume disk until the system Trash is emptied.
- Final version-control check: `git fsck --full` exited 0 with no corrupt/missing/broken objects; `HEAD` and the local `origin/main` tracking ref remain `0126fcd29b63ef21e9ca601ed3d8e0a47804f434`; all 7 commits remain; no tag, commit, push, reset, checkout, stash, Git GC, or prune was performed.
- Final audit: `docs/CLEANUP_AUDIT.md`. Current feature, rollback, and icon work remains uncommitted and preserved; scoped commits are still required to turn that work into durable Git versions.

## 2026-08-16 Saved star interaction

- The current control already behaves as an accessible toggle and persists through the existing triage API; only its visual encoding needs to change.
- The star will be an inline SVG to avoid platform-dependent emoji rendering: outline means not saved, gold fill means saved.
- Renderer and Electron E2E tests should assert both `aria-pressed` and the SVG fill state, followed by a rendered screenshot inspection.
- Final rendering check showed a gold filled star for the saved paper and a gray outline star for the unsaved repository, aligned with the Analyze/Dismiss action row.
- `npm run install:local` rebuilt and installed the unsigned personal-beta app at `~/Applications/TheRSS Dev.app`; the database backup is `~/Library/Application Support/TheRSS/backups/therss-2026-08-16T14-44-44-013Z.sqlite` and the prior app remains at `~/Applications/TheRSS Dev.backup-2026-08-16T14-44-44-013Z.app`.
- The release and installed `app.asar` files share SHA-256 `6eba28bff549f216eab0585228bde85586779d43eb99a927c4a4eb4fffd6f690`, and `npm run smoke:package` passed against the installed app.
- Final reviewer feedback found no blocking, high, or medium issues. Its P3 suggestion was applied: Electron E2E now also checks the saved button's computed gold color (`rgb(183, 121, 0)`), and the updated test passed.

## 2026-08-16 Discover semantic expansion search

- User-defined capability: Discover is an active semantic expansion-search surface driven by Codex, Claude Code, or the configured model provider, not a duplicate of the deterministic Today inbox.
- Required boundary: the selected runner converts natural-language intent into a bounded, schema-validated search plan; TheRSS executes that plan through typed source adapters and returns real source records.
- Initial source scope: arXiv and GitHub. Model output and source metadata remain discovery/derived evidence and cannot establish full-paper or source-code claims.
- Existing local-agent analysis deliberately disables browsing, tools, session persistence, and shell access. Discover should add a separate planning prompt/method while retaining those restrictions; the runner does not need direct network access because TheRSS performs retrieval.
- The existing configured-model gateway can be generalized to a bounded text-generation primitive, but plan JSON must be stripped from optional Markdown fences and validated before any source request.
- Search execution must bound input length, expansion terms, source queries, network response sizes, runtime, and displayed results; it must distinguish complete, partial, empty, and failed outcomes.
- Final verification on 2026-08-16: `npm run typecheck`, all 22 test files / 117 tests in `npm run check`, desktop-permission `npm run test:e2e`, live `npm run smoke:sources` (arXiv=3, GitHub=25), and network-permission `npm audit --audit-level=high` all passed. Coverage finished at 93.64% statements, 83.87% branches, 94.41% functions, and 95.85% lines.
- Rendered verification: a real Electron screenshot confirmed the Discover page shows the bounded-plan copy, runner/source controls, per-source status chips, plan provenance, and separate result cards after execution.
- Review fix: latest-session restore now rehydrates the previously searched source set from persisted `not_searched` outcomes instead of silently defaulting back to both sources.

## 2026-08-17 local Data Analytics capability

- User outcome: the disabled Diagnostics navigation becomes Data Analytics and answers two questions without leaving the app: how many result records were returned each day, and which items received deep analysis.
- Analytics is a local operational view, not product telemetry. No remote event collection, account, cloud database, or analytics SDK is introduced.
- Today refresh volume and explicit semantic Discover volume must remain separately visible because they have different intent and lifecycle contracts.
- “Search volume” means the number of result records returned by completed source searches. Repeated manual refreshes can count the same source result again; the UI must not mislabel this as unique-paper discovery.
- Existing `source_run` rows retain only the latest state per source, so exact historical Today refresh volume cannot be reconstructed. Add append-only terminal-run activity from this version onward and label the boundary; do not backfill invented daily totals.
- Existing persisted Discover sessions can supply historical semantic-search counts. Existing `analysis_artifact` records are the only evidence for deep analysis and can be joined to discovery items for source, title, runner/provider, and timestamp.
- The first dashboard should provide a recent daily series, summary totals, separate Today/Discover/source counts, and a reverse-chronological analyzed-item list with explicit empty states.
- Final implementation adds append-only `source_search_event` records for terminal Today source runs, counts persisted Discover result snapshots directly, and joins analysis artifacts to discovery items without exposing analysis content or credentials through analytics IPC.
- Final verification: `npm run check` passed 25 test files / 127 tests with 93.93% statements, 84.45% branches, 94.83% functions, and 96.02% lines; desktop-permission Electron E2E passed; `test-results/data-analytics.png` was visually inspected after animation settle; `npm run package:mac` and an explicit smoke of `release/mac-arm64/TheRSS.app` passed.

## 2026-08-18 Apple-native product audit

- Scope: current local-first academic discovery workflow, all six primary renderer surfaces, onboarding, Electron/macOS shell behavior, keyboard and menu conventions, status/error/empty states, accessibility, and capability gaps.
- Evidence policy: use current repository artifacts and screenshots captured and inspected during this audit; prior screenshots are context only and cannot establish the current rendered state.
- Product contract: protect the daily explainable arXiv/GitHub inbox, explicit triage, user-triggered provenance-bearing analysis, local SQLite ownership, and the no-login/no-sync boundary. New work must not turn TheRSS into Zotero, Obsidian, an autonomous research author, or a generic reader.
- Current strengths confirmed in source: hidden-inset macOS title bar, sidebar vibrancy, resizable window and full-screen-capable BrowserWindow, responsive sidebar collapse, system typography for controls, semantic light/dark colors, reduced-motion handling, visible focus rings, local-only state, typed preload IPC, safe external-link routing, explainable ranking, list-detail Today/Saved workspace, and honest source/model evidence boundaries.
- Current-run visual evidence: the authorized fixture test passed and regenerated seven screenshots covering onboarding, Interests, Today light/dark, Models, Discover, and Data Analytics. Every screenshot was opened and inspected in this run.
- Visual finding: Today is the strongest native-aligned surface, with a clear three-column reading hierarchy, neutral content planes, restrained system-blue selection, and coherent dark appearance.
- Visual finding: onboarding, Interests, Models, and Analytics retain editorial display headings at a scale closer to a publication landing page than a compact macOS utility; they consume excessive vertical space and delay task controls.
- Visual finding: Discover uses a wide form plus stacked report cards instead of the list-detail idiom established by Today/Saved, so selection, comparison, and keyboard movement are inconsistent across the product.
- Visual finding: muted labels, dates, shortcut hints, status text, teal/cyan/purple eyebrows, and green detection badges are visibly too faint at their small rendered sizes in light appearance; screenshot inspection flags risk but does not constitute a complete accessibility audit.
- Visual finding: the sidebar footer always presents a green `local index` state, while real per-source health available in the dashboard is absent from Today; the visual therefore overstates operational readiness.
- Visual finding: destructive Dismiss has no reversible confirmation or status surface in the rendered workspace, and no application-menu affordance makes keyboard actions discoverable.
- Native-shell gap: Electron supplies its generic default application menu because TheRSS does not define one, but there is no TheRSS-specific Settings command (`Command-,`), View > Show/Hide Sidebar command, navigation commands, Refresh command, or menu discoverability for Save/Dismiss/Analyze.
- Inactive-window gap: the sidebar vibrancy is configured with `visualEffectState: 'active'`, which forces an active material even when the window loses focus instead of following the native active/inactive window state.
- Split-view gap: Today/Saved visually resembles a Mac split view, but its sidebar and list/detail dividers are CSS grid columns and cannot be dragged or persist user-selected widths. Window bounds, sidebar visibility, active view, and pane sizes are not restored.
- Narrow-window gap: CSS automatically collapses the sidebar below 920 px without updating React state. At those widths the toolbar can claim `Hide sidebar` while the sidebar is already collapsed, and clicking `Show sidebar` cannot override the media rule. Auto-collapsed icons also lose the hover titles that are added only for explicit collapse state.
- Workflow correctness gap: selecting a `new` signal does not transition it to `viewed`, so the visible unread count does not represent reading activity. Dismiss removes a signal immediately with no Undo path or recoverable dismissed view.
- Selection-state gap: when the selected Saved item is removed, `selectedIndex` falls back to the first remaining item while `selectedItemId` still references the removed item; the detail changes but no list row receives the selected appearance.
- Analysis continuity gap: `getLatestAnalysis` exists through repository, IPC, preload, and shared API but the renderer never calls it. Persisted analyses are listed in Analytics yet cannot be reopened on the selected item after reload/navigation.
- Source-state gap: `DashboardSnapshot.sourceHealth` distinguishes idle/refreshing/healthy/no-results/partial/failed, but the renderer does not show these outcomes; the sidebar always shows a green `local index` dot, including stale or failed-source states.
- Settings gap: Interests and Models are placed as peer content views instead of a standard Settings window. Forms have no unsaved-change protection. The provider surface has no connection test and no explicit clear/replace credential control.
- Interaction risk: raw Arrow/S/D/A handlers are registered on `window`; they ignore text inputs but can still intercept keys while focus is on unrelated buttons or navigation. Selection changes without moving DOM focus, which weakens Full Keyboard Access and assistive-technology clarity.
- Accessibility risk: global app and form errors lack `role=alert` or an equivalent live region; inputs do not expose `aria-invalid`/`aria-describedby`. Loading and state transitions are generally not announced.
- Contrast calculation against the actual light surfaces found 3.44:1 for the 60% secondary label, 4.02:1 for blue on white, 2.57:1 for teal on white, 2.54:1 for cyan on white, 2.22:1 for green on white, and 3.65:1 for saved gold on white. Several of these colors are used at 9–12 px, so semantic naming alone does not establish readable contrast.
- Design-system gap: the fixed per-view sidebar icon colors conflict with Apple's preference for the user's system accent on most sidebar icons. The 1,859-line stylesheet also contains duplicate declarations and lacks increased-contrast/inactive-window adaptations, making future visual drift likely.
- Surface consistency gap: Today/Saved uses a dense native-style list-detail workspace, while Discover returns to large editorial cards. The different selection, open, save, and keyboard behaviors make the two discovery workflows feel like separate products.
- Test gap: the suite strongly covers business behavior and one critical Electron flow, but there is no automated accessibility scan, contrast contract, application-menu/window-restoration test, keyboard-focus assertion, or stateful visual-regression baseline.
- Current quality gate remained green during the audit: 26 test files / 133 tests passed with 93.93% statements, 84.45% branches, 94.83% functions, and 96.02% lines; lint, typecheck, renderer/main/MCP builds, and formatting passed.

## 2026-08-18 Apple semantic color system

- The renderer now uses Apple-style semantic roles for labels, system backgrounds, grouped surfaces, fills, separators, status colors, and source identity instead of the legacy beige and forest-green palette.
- Each primary surface inherits a restrained system tint through the app shell: Today blue, Saved accessible gold, Discover indigo, Interests teal, Models purple, and Data Analytics cyan. Neutral content surfaces remain visually quiet.
- Dark appearance uses explicit semantic overrides, including a true-black primary canvas, dark grouped materials, elevated fills, and macOS-style brighter status/accent variants.
- A stylesheet contract prevents the legacy palette from returning and verifies all six per-view mappings. Electron E2E checks the actual computed navigation colors and dark appearance, not only source tokens.
- Rendered screenshots were inspected for onboarding, Interests, Today light, Today dark, Models, Discover, and Data Analytics; no visual blocker remained.
- Final verification: `npm run check` passed 26 test files / 133 tests with 93.93% statements, 84.45% branches, 94.83% functions, and 96.02% lines; the full Electron E2E passed.
- The arm64 release and installed app both passed `npm run smoke:package`. The installed app is `/Users/dtjgp/Applications/TheRSS Dev.app`; rollback artifacts are `/Users/dtjgp/Applications/TheRSS Dev.backup-2026-08-18T15-19-57-799Z.app` and `/Users/dtjgp/Library/Application Support/therss/backups/therss-2026-08-18T15-19-57-799Z.sqlite`.
- The release and installed `app.asar` files share SHA-256 `4d93e244abec0ef0f0f9a295c2929fb62ac0e01b617840e5fde96a6c70c37e9d`, confirming that the verified build is the installed build.

## 2026-08-18 Apple-native interaction correctness

- Test-first behavior now treats explicit click/Arrow selection of a `new` signal as `viewed`, uses roving row focus, and scopes bare Arrow/S/D/A keys to the signal workspace instead of unrelated controls.
- The latest successful reversible Save/Dismiss mutation carries its exact prior state into a transient Undo HUD and `Command-Z` path outside editable controls. Passive read transitions do not create noisy HUDs, and navigation hides the HUD without discarding menu/keyboard Undo state. Renderer and native-menu commands share the same typed preload contract.
- A custom macOS application menu now exposes `Command-,` Settings routing, `Command-1/2/3` navigation, Show/Hide Sidebar, Refresh, Save/Dismiss/Analyze Selected, Undo Last Triage, and standard Edit/Window roles.
- Selecting a signal asks SQLite for its latest persisted analysis and only renders an artifact whose `itemId` matches the current selection. This restores local analysis continuity without leaking another item's stale result.
- Today displays independent arXiv/GitHub health. Sidebar readiness requires every source to be `healthy` or `no_results`; mixed terminal/idle state reports `Some sources pending`, and partial/failed state reports attention rather than a green success claim.
- macOS vibrancy now follows active/inactive window state. Narrow layouts no longer use a CSS-only forced collapse that contradicts React/sidebar controls.
- Light-mode secondary labels and small blue/green/red/indigo/purple/teal/cyan/saved foregrounds use readable semantic text tokens; global and form errors announce with `role=alert`, while loading and triage feedback use `role=status`.
- Current-run baseline and final captures covered onboarding, Interests, Today light/dark, Models, Discover, and Data Analytics at the same logical 1360×880 viewport. All 14 before/after files and all seven final captures were opened and inspected; no clipping, overlap, broken dark mode, or navigation inconsistency remained.
- Final verification: `npm run check` passed 27 test files / 141 tests with 93.55% statements, 84.10% branches, 93.95% functions, and 95.74% lines; Electron fixture passed 1/1 in 5.2 seconds; production-only `npm audit --omit=dev --audit-level=high` found zero vulnerabilities.
- The final unsigned arm64 build installed to `/Users/dtjgp/Applications/TheRSS Dev.app` and passed packaged-app smoke. Immediate rollback artifacts are `/Users/dtjgp/Applications/TheRSS Dev.backup-2026-08-18T16-32-40-294Z.app` and `/Users/dtjgp/Library/Application Support/therss/backups/therss-2026-08-18T16-32-40-294Z.sqlite`.
- Release and installed `app.asar` files share SHA-256 `43765d677b32a93944bf48c386337578da04a3e1627c9e595bb2f4951221e12e`, confirming that the smoke-tested installation contains the final source result.

## 2026-08-19 paper-specific llm-wiki L1 analysis

- The source template is `/Users/dtjgp/Obsidian/llm-wiki/Templates/Paper_Note_L1.md`.
- Its decision-bearing sequence is: quick decision card, TL;DR, basic information, contribution/novelty map, technical core, claim-evidence ledger, experiments/reproducibility, reuse feasibility, reviewer evaluation, and current-project next step.
- The template explicitly requires `[TBD]` for unverified facts and separation of author-reported claims, reproduced results, and analyst inference.
- TheRSS currently sends only bounded discovery metadata to models/local agents, stores `promptVersion` plus a source hash, and renders the selected artifact below actions. Paper-specific routing can therefore remain inside the existing typed analysis boundary, but the paper prompt must disclose `abstract-only` evidence and the renderer must move the paper artifact immediately below the summary.
- Phase 21 implementation uses `llm-wiki-paper-l1-v1` for every normalized `kind: paper` record, with a legacy-only fallback for arXiv snapshots whose optional kind is absent. The prompt follows the live L1 template section order while keeping missing full-text evidence as `[TBD]`; it never claims a completed deep read or writes to the vault.
- The paper detail keeps analysis explicitly user initiated and displays it immediately after the discovery summary. Old generic artifacts remain visible but are not relabeled as L1. A limited React renderer presents headings, lists, and tables without interpreting model-supplied HTML.
- Final feature evidence: 55 focused tests pass; scoped Prettier, ESLint, production/MCP build, and desktop Electron E2E pass; `test-results/05b-paper-l1-analysis.png` was inspected after the Markdown-renderer correction. The all-repository gate is presently blocked only by separate in-progress Sources/arXiv contract tests (3 formatting files, 12 type errors, 16 coverage-test failures / 191 passes).
- The referenced Sources/arXiv task later completed those in-progress contracts rather than requiring an independent workaround: its final checkout passes 216 tests and the 80% branch gate, validates 20 non-X configured adapters plus arXiv/GitHub/Hugging Face, and keeps X installation-path work explicitly deferred. The resulting Phase 13–22 worktree is the intended publish scope; ignored generated output remains excluded.
- Automatic analysis on selection would contradict the current user-initiated analysis promise and could spend provider quota or launch a local process without an explicit action. The UI will expose the L1 behavior while retaining the existing Analyze button/keyboard command.
