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

## 2026-08-20 Personal Prompt verification

- UI/UX placement decision: the Personal Prompt belongs at the top of `Models & Agents`, not as a
  new primary navigation item and not inline inside each Discover search. It is stable planner
  context, so the settings surface is the least ambiguous location and keeps the per-search intent
  explicit.
- Current implementation stores one bounded prompt in local SQLite through typed IPC, validates and
  trims it in shared schema code, and includes it only in the planner prompt for Discover. Source
  adapters receive the validated generated plan; its search terms can reflect the personal context.
- Discover does not echo the private text in status or provenance. Provenance retains only
  `personalizationApplied` plus the composed-input hash under `semantic-discover-v2`; the separately
  persisted generated plan remains inspectable and its terms can reflect personal context.
- Focused verification passed: `npm test -- src/shared/personalization.test.ts
src/core/storage/researchRepository.test.ts src/core/discover/discoverPlanner.test.ts
src/renderer/src/App.test.tsx` -> 4 files / 54 tests.
- Full quality gate passed on 2026-08-20: `npm run check` -> 43 files / 232 tests with 91.63%
  statements, 80.95% branches, 93.59% functions, and 94.49% lines; production and MCP builds
  passed.
- Electron E2E first failed only at the known macOS restricted-GUI boundary (`SIGABRT`,
  `kill EPERM`). The authorized rerun of `npm run test:e2e` passed 1/1.
- Rendered screenshots inspected locally: `test-results/05-personal-prompt-settings.png` confirms
  the settings card hierarchy, privacy copy, character counter, and save confirmation;
  `test-results/02-discover-results.png` confirms Discover result layout and search-details
  inspector placement after a successful run.
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

## 2026-08-19 explicit X research watchlist

- User authorization: add every previously recommended person and add Elon Musk.
- Exact scope: 23 handles. Do not add the supplemental institution accounts (`@IEEEComSoc`,
  `@3GPPLive`, `@6G_SNS`), the suspended Emma Strubell account, or Catherine Wolfram's X account.
- Display groups: model compression/edge/Green AI, 6G, smart grid/energy, agents/RAG/evaluation,
  behavior/economics, and technology/industry.
- Retrieval decision: flatten the groups into one query of 23 `from:` clauses. The current query is
  441 characters before optional parentheses and therefore remains inside the adapter's 500-byte
  input boundary. Use one metered call with `count: 100` rather than one call per group.
- X source-only retrieval should no longer require an Interest profile because the query is fixed by
  the approved watchlist. The UI must still require an explicit click and disclose that the call may
  use xapi balance.
- Evidence boundary: no live account/profile/timeline validation is authorized by this configuration
  change; tests use deterministic runners and fixtures.
- Final implementation source of truth is `src/shared/xWatchlist.ts`; it validates case-insensitive
  uniqueness and X handle syntax, freezes all groups/arrays, and constructs the 441-character query.
- Focused verification passed 26/26 tests. The full gate passed 42 files / 218 tests with 91.38%
  statements, 80.16% branches, 92.78% functions, and 94.28% lines; production and MCP builds passed.
- The first restricted Electron launch hit the known macOS `SIGABRT`/`kill EPERM` boundary. The
  desktop-permission E2E passed 1/1. `08c-x-watchlist.png` and
  `08d-x-watchlist-elon.png` were inspected; all groups and `@elonmusk` render without overlap.
- No live xapi call or package/install operation was performed. The installed-app `npx` lookup
  remains deferred and is still required before packaged X retrieval can be claimed.

## 2026-08-20 Discover result usability

- The screenshot confirms the ranked result list is clipped by a fixed-height `.today-view` nested
  inside the page-scrolling Discover surface; `.today-view` currently applies `overflow: hidden`.
- Discover cards still expose a one-way `Save result` text action even though Saved already has the
  required accessible outline/filled `Star` toggle and the repository supports `saved -> viewed`.
- The existing paper analysis path already mirrors the live
  `/Users/dtjgp/Obsidian/llm-wiki/Templates/Paper_Note_L1.md` decision/evidence sequence under prompt
  version `llm-wiki-paper-l1-v1`; no new template or vault runtime access is needed.
- Direct analysis of an unsaved Discover result needs a local `discovery_item` row before
  `AnalysisService.analyzeItem` can run. Promotion for analysis must remain distinct from the Saved
  star state so an analysis request does not silently claim that the user saved the result.
- The focused RED run produced four intended failures: missing scroll CSS, missing materialization,
  the old Save result text control, and the absent paper Analyze action. After implementation, the
  same renderer/style/storage selection passes 42/42.
- Final behavior: the result region has bounded vertical overflow, keyboard focus, stable scrollbar
  space, overscroll containment, and a sticky heading/filter bar. Save is an accessible star with
  outline/filled state and `saved -> viewed` cancellation. Only `kind: paper` gets the adjacent
  Analyze action; an unsaved paper materializes as `viewed`, runs the selected Discover runner, and
  keeps its star off while persisting the standard L1 provenance artifact.
- Final verification: `npm run check` passes 42 files / 224 tests at 91.56% statements, 80.71%
  branches, 93.51% functions, and 94.44% lines. The Electron E2E passes 1/1; inspected screenshots
  include `02-discover-results.png` and `03b-discover-star-saved.png`.

## 2026-08-20 Personal Prompt settings

- UI/UX placement: keep the five-destination sidebar stable. Native `Command-,` and the existing
  Models & Agents destination already converge on one settings surface, so Personal Prompt belongs
  as the first settings group rather than a sixth primary destination.
- Interaction: saving a non-empty prompt activates it for subsequent Discover planning; clearing
  and saving disables personalization. This avoids a second switch whose state could disagree with
  the text while keeping the off-state explicit.
- Prompt content guidance: fields/current questions, preferred methods/evidence, and exclusions are
  useful. The UI explicitly warns against passwords, API keys, or confidential unpublished details.
- Privacy boundary: the bounded prompt is stored in the local SQLite operational database. It is
  sent only to the selected configured model or bounded Codex/Claude planner after an explicit
  Discover action. Source adapters receive the validated generated plan, whose search terms can
  reflect the personal context; the UI discloses this and warns against entering sensitive details.
- Injection boundary: personal context and the per-search intent have separate untrusted-data
  delimiters. The profile cannot change the JSON contract, selected sources, tool/file access, or
  evidence status. Only the validated `discover-plan-v1` reaches source adapters.
- Traceability: new plan runs use `semantic-discover-v2`; the existing input hash covers the exact
  composed prompt, and provenance records whether personal context was applied without persisting a
  duplicate profile inside each historical session. Legacy v1 sessions restore as generic context.
- RED evidence: the initial focused run had four intended failures across prompt composition/hash,
  SQLite persistence, and renderer settings. The added schema test also failed because the bounded
  personalization module did not yet exist.
- Focused GREEN evidence: seven files / 78 tests pass across schema, planner, service, SQLite
  migration/round-trip, shared contract, and renderer behavior; type checking also passes.

## 2026-08-19 retain only live-verified sources

- Latest user direction supersedes the Phase 24 X addition: retain only the 22 sources that were
  previously verified to return readable content; do not currently consider any other source.
- Exact retained set: arXiv, GitHub, Hugging Face, 北京智源人工智能研究院, 国家哲学社会科学文献中心,
  NBER, OpenAI, 科学网, 量子位, MIT Technology Review China, McKinsey, AIbase, C114, CNBC,
  Hacker News, MDPI, Solidot, TechCrunch, TechPowerUp, Nikkei Asia, The Verge, and WIRED.
- X was not part of the successful 22 because its live call was skipped and its installed `npx`
  runtime remained unverified. The X watchlist must therefore leave the current product surface and
  active refresh registry.
- Preserve the 105-entry raw catalog and SQLite history as dormant/recoverable data; filter the
  product-facing catalog through an immutable 22-ID allowlist instead of deleting historical data.
- Final implementation exposes only those 22 IDs through `SOURCE_CATALOG`, derives the Today
  identity set from that allowlist, registers 20 configured adapters alongside arXiv/GitHub, and
  excludes retired-source rows from Today while retaining Saved rows.
- The Pending directory mode, X watchlist/UI, registered xapi transport, and unused X client were
  removed. The dormant raw X entry is marked `adapter_required`, so it cannot be scheduled by
  accident.
- Focused RED contracts failed at the intended old 105/23/X boundaries and then passed 78/78.
  `npm run check` passed 40 files / 209 tests with 91.87% statements, 80.23% branches, 93.35%
  functions, and 94.97% lines; production and MCP builds passed.
- Electron E2E passed 1/1 after correcting the expected configured-source count to 20.
  `test-results/08-sources.png` and `test-results/08b-source-detail.png` were inspected: the
  directory shows 22 cards, A=7/B=15/C=0, no Pending/X surface, and a working in-app detail view.
- No live source revalidation, package build/install, commit, or push was performed in this phase.

## 2026-08-19 Discover-centered consolidation

- User direction: Today, Discover, and Interests overlap in the current product; Discover should
  become the broad model/agent-assisted retrieval entry instead of requiring a standing Interest
  profile.
- Current mismatch: `SOURCE_CATALOG` and active discovery contain 22 live-verified sources, while
  `discoverSearchRequestSchema`, `DiscoverService`, SQLite Discover checks, and `DiscoverView` still
  hard-code only `arxiv | github`.
- Retrieval boundary: arXiv and GitHub accept specialized transient plan fields. The other 20
  deployed adapters already expose bounded typed batches; they do not perform remote semantic
  search, so Discover must apply plan-derived deterministic matching after retrieval and report
  zero matching results honestly rather than treating every recent feed item as relevant.
- Preservation boundary: hide/remove Today and Interests as user-facing routes and stop automatic
  Interest-driven refresh, while retaining legacy tables, APIs, history, and Saved rows unless a
  later request explicitly authorizes destructive migration.
- Persistence migration must remove the old arXiv/GitHub `CHECK` constraints from
  `discover_source_run` and `discover_result`, and persist `item_kind` so Hugging Face models,
  datasets, papers, and general articles keep their type after reload/save.
- Final implementation derives `DISCOVER_SOURCE_IDS` from the retained 22-source registry and keeps
  selection user-controlled. Search-capable arXiv/GitHub receive specialized fields; configured
  adapters receive only fixed-host requests and browse-only records require a token/phrase-aware
  semantic reason. CJK phrases retain substring semantics while Latin terms use Unicode boundaries.
- Per-source states distinguish `healthy`, `no_results`, `partial`, `failed`, and unselected
  `not_searched`. All-invalid normalization is failed, mixed valid/invalid is partial, and final
  outcome counts match the deduplicated/capped session results.
- The SQLite migration is transactional, removes only obsolete Discover two-source checks, adds
  `item_kind`, fills missing legacy source outcomes as `not_searched`, and preserves legacy Interest,
  Today, Saved, analytics, and analysis records. Saving a configured result retains its actual kind.
- Security review narrowed `THERSS_HUGGINGFACE_TOKEN` forwarding to only the Hugging Face transport;
  renderer, SQLite, and unrelated adapters never receive it.
- Final deterministic evidence: `npm run check` passed 42 files / 213 tests with 91.85% statements,
  80.83% branches, 93.79% functions, and 94.81% lines. Electron E2E passed 1/1 with arXiv, GitHub,
  and a configured BAAI result across all 22 source outcomes; seven rendered screenshots were
  inspected.
- The unsigned arm64 build at `release/mac-arm64/TheRSS.app` passed the corrected package smoke.
  The smoke default was changed from the older installed development app to the newly built release
  so package evidence cannot be accidentally attributed to stale code. No installation, live
  source/model request, commit, push, or publication was performed.

## 2026-08-19 Apple-native Discover refinement

- Current-run audit direction: preserve the editorial research identity, but treat Saved's
  list/detail workspace as the product's native interaction reference. Discover should prioritize
  results after a search and move the 22-source outcome matrix plus expanded plan behind an
  inspectable disclosure.
- Current motion issue: every Discover result receives a 360 ms `card-enter` animation with a
  55 ms index-based delay. At the 100-result cap, the last item can be delayed by more than five
  seconds. Reduced Motion shortens keyframe animations but does not currently neutralize CSS
  transitions.
- Live verification before implementation: arXiv returned 3 targeted + 200 recent records; GitHub
  returned 25. Of 20 configured sources, 18 passed the second run. MIT Technology Review China and
  AIbase were transient first-run failures; 科学网 and C114 failed both 30-second adapter runs and
  both direct 35-second proxy checks.
- 科学网 publishes an official credential-free HTTPS RSS endpoint at
  `https://www.sciencenet.cn/xml/blog.aspx?di=0`; a direct check returned HTTP 200,
  `application/xml`, and 7,818 bytes in 2.5 seconds. This is a candidate replacement only after the
  existing normalizer contract passes.
- C114's configured proxy is unavailable and its direct site did not pass the local TLS chain
  check. Do not bypass certificate validation; keep the source failed unless a trustworthy HTTPS
  feed/proxy is independently verified.
- Implementation outcome: ScienceNet now uses its official RSS endpoint. C114 uses the fixed mobile
  HTTPS endpoint, explicit bounded `gb18030` decoding, and a source-specific listing normalizer. The
  final configured-source smoke passed 20/20; C114 returned 12 normalized records (8 dated today),
  and ScienceNet returned 20 normalized records (all dated today).
- Discover now defaults to a one-line 22-source summary, presents ranked records before a collapsed
  details inspector, displays honest indeterminate pending feedback, caps card stagger at six
  positions, and disables transitions as well as animations under Reduced Motion.
- Final gates: `npm run check` passed 42 files / 219 tests; Electron E2E passed 1/1; seven fresh
  light-mode captures were inspected; the generated unsigned macOS bundle passed package smoke.
- Publication-gate revalidation exposed repeatable timeouts at the earlier C114 mobile primary. The
  official desktop homepage returned current dated content with the application's bounded user
  agent, so C114 now uses that fixed HTTPS origin first, retries twice, retains the mobile origin as
  a bounded fallback, and supports both audited listing shapes. Focused tests passed 23/23 and the
  next complete live run passed 20/20 configured sources; C114 returned 25 normalized records, 18
  dated today, with zero rejected records. The post-fix full gate passed 42 files / 220 tests with
  91.53% statements, 80.60% branches, 93.46% functions, and 94.41% lines.

## 2026-08-20 Apple system typography

- The renderer previously mixed 26 Newsreader declarations, one IBM Plex Sans declaration, five
  Fontsource stylesheet imports, and two direct font-package dependencies.
- Typography is now centralized as `--font-apple-text` for body/controls and
  `--font-apple-display` for headings. macOS resolves these to SF Pro Text and SF Pro Display; the
  remaining stack entries are system/development fallbacks, not bundled font files.
- Every renderer `font-family` declaration is limited by contract to one of the two Apple variables
  or inheritance. Removing the Fontsource imports and dependencies prevents the production bundle
  from retaining the former third-party font assets.
- Final evidence: `npm run check` passed 43 files / 237 tests and all four coverage thresholds;
  Electron E2E passed 1/1 with computed-font checks. Discover, Saved, Personal Prompt, and Sources
  screenshots showed no typography-driven clipping or layout regression, and the renderer build
  contains no font asset files.
- Publication preparation repeated the complete quality gate and a production-only dependency audit
  with zero vulnerabilities. The reversible installer retained the previous app and a SQLite backup,
  installed the Apple-typography build to `~/Applications/TheRSS Dev.app`, and the installed executable
  passed package smoke. Release and installed `app.asar` hashes both equal
  `822fe94be988b4a003f0f02702bbe489bb8a790b292a7c1adabf75502e1a889e`.
- GitHub PR #8 passed its required quality workflow and was rebased into protected `main`; the
  published Apple-typography commit is `e7fb39c`. Merge commits are disabled in this repository, so
  rebase is the verified publication strategy for this change set.

## 2026-08-20 native macOS shortcut diagnosis

- `Menu.setApplicationMenu()` installs a fully custom template, so native commands absent from that
  template are not retained automatically.
- The template includes native quit, hide, minimize, zoom, editing roles, and custom navigation
  accelerators, but no File menu and no `close` role. This specifically leaves `Command+W` without a
  native menu command.
- The correct fix is a standard File menu containing `role: close`; the existing macOS activation
  handler already recreates a window after the last one is closed.
- Implementation uses `id: close-window`, `role: close`, and the application-menu-scoped
  `CommandOrControl+W` accelerator. This is not a system-wide `globalShortcut`.
- Playwright keyboard injection does not pass through AppKit accelerators, and directly calling a
  role-backed `MenuItem.click()` does not emulate native dispatch. The stable E2E contract inspects
  the built menu registration and uses `Menu.sendActionToFirstResponder('performClose:')` to verify
  Cocoa window-close behavior while keeping the Electron application process alive.
- Final verification passes 43 files / 238 tests, all four coverage thresholds, Electron E2E 1/1,
  production/MCP builds, unsigned arm64 packaging, and isolated packaged-app smoke. The E2E also
  emits `activate` after closing the last window and confirms that the Discover window is recreated.
- Publication commit `078dcc3` passed the ECC pre-push gate. GitHub PR #10 passed the required
  `quality` workflow and was rebased into protected `main` as `ca24931`.
