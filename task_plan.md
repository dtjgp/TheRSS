# Task Plan: TheRSS initial product and release

## Goal

Build and publish a verified initial version of TheRSS: a local-first academic discovery app that presents a daily personalized inbox of arXiv papers and GitHub repositories, supports user-configured model analysis plus Codex/Claude/DeepSeek workflows, and can be iterated and updated with minimal friction.

## Success criteria

- A runnable project exists at `/Users/dtjgp/Projects/TheRSS` and is pushed to a GitHub repository named `TheRSS`.
- A user can configure arXiv topics/keywords and GitHub interests, refresh sources, and see one ranked daily inbox.
- Every recommendation explains why it matched the user's interests and preserves source provenance.
- Feed or repository metadata remains discovery evidence; paper-level claims require a primary source or full paper.
- The user can configure model endpoints without storing secrets in source control or ordinary app data.
- Codex and Claude Code can inspect selected items through one shared, read-only-by-default agent interface; write or export actions require explicit confirmation.
- Local development supports fast reload, deterministic fixtures, automated tests, and a documented one-command update path.
- Type checking, linting, unit/integration/E2E tests, coverage, build, and security audit satisfy the release gates.

## Phases

- [x] Phase 0: Establish product governance and evidence-backed engineering plan.
- [x] Phase 1: Scaffold the app, test harness, CI, and local developer workflow.
- [x] Phase 2: Implement interests, arXiv discovery, GitHub discovery, ranking, and daily inbox.
- [x] Phase 3: Implement configurable model providers and analysis artifacts.
- [x] Phase 4: Implement Codex/Claude/DeepSeek agent integration.
- [x] Phase 5: Implement fast local packaging/update workflow and release gates.
- [x] Phase 6: Complete security, quality, runtime, and requirement-by-requirement verification, including once-per-day startup refresh.
- [x] Phase 7: Create the GitHub repository, push the verified initial version, and record release evidence.
- [x] Phase 8: Add a Saved inbox and direct, provenance-preserving local Codex/Claude analysis.
- [x] Phase 9: Correct the sidebar brand-mark alignment and define the optional account-sync boundary.
- [x] Phase 10 (superseded): Implemented and locally verified an experimental Google Drive synchronization path; the user later withdrew it before release.
- [x] Phase 11: Withdraw account/login and synchronization surfaces until the product revisits cloud sync.

### Phase 11 execution

- [x] Add a failing UI test proving that no login or Sync entry is exposed.
- [x] Remove Google OAuth/Drive, synchronization storage/services, IPC, preload, and renderer code.
- [x] Restore direct local interest/triage persistence without sync bookkeeping.
- [x] Mark synchronization as deferred in product, architecture, roadmap, security, and traceability docs.
- [x] Run the full quality gate and Electron E2E.

### Phase 10 execution (superseded history)

- [x] Confirm the selected portable-data scope and official OAuth/Drive constraints.
- [x] Add deterministic sync documents, version-vector merge, and SQLite persistence.
- [x] Add PKCE desktop OAuth, encrypted refresh-token storage, and bounded Drive adapters.
- [x] Add typed IPC and the optional Google Drive Sync interface.
- [x] Verify two-device convergence, conflicts, deletion/disconnect, E2E, coverage, and security gates.

## Product milestones

| Milestone                      | User-visible outcome                                                        | Exit gate                                       |
| ------------------------------ | --------------------------------------------------------------------------- | ----------------------------------------------- |
| M0 — Foundation                | Scope, architecture, risks, and launch gates are explicit                   | PRD/design/roadmap reviewed against the request |
| M1 — Discovery loop            | Daily arXiv and GitHub items can be collected, matched, ranked, and triaged | Unit + integration + first critical E2E pass    |
| M2 — Analysis loop             | A selected item can be analyzed by a configured model or handed to an agent | Secret-handling and provenance tests pass       |
| M3 — Personal beta             | The app runs locally with fast updates and recoverable data migrations      | Package/smoke/update checks pass                |
| M4 — Published initial version | Repository and CI are available on GitHub                                   | Remote commit and CI state verified             |

## Key questions

1. Which desktop shell best preserves rapid personal iteration while keeping future signed macOS distribution possible?
2. What is the smallest agent contract that works for Codex, Claude Code, and a DeepSeek harness without duplicating state?
3. How should GitHub "trending" be sourced when GitHub has no stable official Trending API?
4. Should background refresh run only while the app is open in the initial version, or use a login helper?

## Decisions made

- The product is a single-user, local-first desktop application, not a multi-user cloud service.
- arXiv abstracts and GitHub metadata are discovery inputs, not scientific evidence.
- The first ranking system must be deterministic and explainable; LLM ranking is an optional second stage.
- Agent integrations share one interface and are read-only by default.
- Apple Developer Program membership is not a prerequisite for the development and personal-beta phases.
- Use Electron + React + TypeScript + Vite for the initial desktop shell.
- Use SQLite as the local operational source of truth; add FTS5 only when a full-text search surface exists.
- Use one bounded official arXiv Atom query per manual refresh; add daily caching and cross-request spacing before any background refresh.
- Implement `GitHub Interest Radar` from official repository search instead of claiming to reproduce the website's undocumented Trending ranking.
- Use one MCP contract for Codex, Claude Code, and compatible harnesses.
- Pin Electron tooling to the compatible Vite 7 / React plugin 5 / TypeScript 5 line instead of unqualified latest versions.
- When an interest profile exists, refresh once on the first app open of the dashboard day if no refresh has completed that day. Keep manual refresh available and retain the last inbox if startup refresh fails.
- Persist a SHA-256 hash of the exact discovery fields sent for analysis, and distinguish a successful empty source response from a non-empty success.
- Publish the initial repository publicly at `https://github.com/dtjgp/TheRSS` as explicitly selected by the user.
- Present saved arXiv papers and GitHub repositories in one dedicated Saved view backed by the existing triage state.
- Invoke local Codex or Claude Code through bounded non-interactive CLI processes; do not attach to or mutate an existing interactive agent session.
- Defer all account-login and synchronization work; expose no login or Sync surface until the user explicitly reopens the product decision.

## Errors encountered

- The Phase 11 renderer test initially failed because the `06 Sync` navigation button was still present. Removing the Sync view and renderer wiring made the negative capability test pass.
- The Phase 11 storage migration test initially failed because the three experimental sync tables remained. The migration now drops only `google_sync_conflict`, `google_sync_account`, and `sync_local_state`, preserving all local research tables.
- The first Phase 8 type check could not narrow the shared model/local-agent response union after assignment. Resolve by retaining the local-agent response in its own typed binding before copying provenance fields.
- The first one-line CLI-detection smoke used top-level await, which `tsx -e` compiled as CommonJS. Resolve by wrapping the read-only smoke in an async function.
- The corrected CLI-detection smoke then hit the known sandboxed `tsx` IPC `EPERM`; the approved out-of-sandbox read-only retry detected both Codex CLI and Claude Code.
- The first `npm audit` attempt could not resolve the registry inside the network sandbox. The approved network retry completed with zero vulnerabilities.
- GitHub authentication was initially invalid. A network-enabled check on 2026-08-15 confirmed the active `dtjgp` keyring login with repository/workflow scopes. Resolved after the user selected public visibility: `dtjgp/TheRSS` was created, `main` was pushed, and CI was verified.
- Initial `npm install` failed because `electron-vite@5.0.0` supports Vite 5–7 while the unqualified latest Vite was 8.2.1. Resolve by pinning the latest compatible Vite 7 release; do not bypass peer checks with `--force`.
- The first sandboxed development launch could not bind `::1:5173`; the approved local launch succeeded outside the network sandbox.
- npm 11 installed the Electron package without its desktop binary. Add `scripts/ensure-electron.mjs` to `postinstall`, explicitly allow the required `better-sqlite3`/`esbuild` scripts, deny the unused Windows installer script, and verify a real Electron launch.
- The first E2E run found a blank renderer because a sandboxed Electron renderer cannot load an ESM preload. Build the preload as bundled CommonJS and keep `sandbox: true` plus context isolation.
- The first local installer used a generic filesystem copy that rewrote relative Electron Framework links into invalid absolute links. Replace it with macOS `ditto`, verify the copied framework links and ICU data, retain the previous app, and add an installed-package renderer/preload smoke test.
- Parallel sandboxed smoke execution caused Electron `SIGABRT`, tsx IPC `EPERM`, and blocked registry DNS. Serial execution with the required desktop/network permissions passed; do not classify the sandbox failure as an application regression.

## Status

**Phase 11 complete.** Account/login and synchronization surfaces are withdrawn and documented as deferred. Saved, local Codex/Claude analysis, branding, packaging, and unrelated work remain intact. `npm run check` and the Electron E2E pass without a login or Sync entry.

## Phase 12: Repository cleanup and version-control preservation

### Goal

Remove obsolete and reproducible local artifacts without losing Git history, current uncommitted product work, design provenance, or the ability to rebuild and verify the application.

### Execution

- [x] Capture the current Git branch, commit graph, tracked/untracked state, ignored files, and disk-usage baseline.
- [x] Classify repository content as source-of-truth, version/provenance history, active dependency, reproducible artifact, or obsolete residue.
- [x] Remove only artifacts proven reproducible or obsolete; preserve `.git`, tracked files, current source work, and untracked brand/design history unless separately proven disposable.
- [x] Audit references and source imports for remnants of withdrawn or superseded features.
- [x] Run the strongest practical quality gates after cleanup.
- [x] Recheck Git history, remote tracking metadata, worktree state, and remaining disk usage; record a cleanup audit.

### Safety decisions

- No commit, push, reset, checkout, stash, or history rewrite is part of this cleanup.
- Exact cleanup targets must be enumerated and checked for symlinks before removal.
- Generated outputs may be removed only when their regeneration command is known.
- Historical architecture decisions and icon design iterations count as version/provenance information and are not disposable build output.

### Errors encountered

- The first Phase 12 planning patch contained an empty `notes.md` update hunk and was rejected without changing files. Split the plan and notes updates into valid patches.
- The first Phase 12 Electron E2E attempt built successfully but the restricted desktop sandbox aborted Electron with `SIGABRT` and returned `kill EPERM` before any assertion ran. Retry the same E2E outside the restricted desktop sandbox, matching the established project verifier boundary.
- The first Phase 12 `npm audit --audit-level=high` attempt could not resolve `registry.npmjs.org` in the restricted network sandbox and produced no security conclusion. Retry with network permission.

### Status

**Phase 12 complete.** Obsolete/generated content was moved to a recoverable Trash directory; dead-content and dependency audits found no additional safe source/dependency removal; all quality gates passed; Git history and current uncommitted work remain intact. See `docs/CLEANUP_AUDIT.md`.

## Phase 13: Star-shaped Saved toggle

### Goal

Replace the text-only Save/Saved action with an immediately recognizable star marker while preserving local triage behavior, accessibility, and retry semantics.

### Execution

- [x] Confirm the existing Saved toggle, tests, and renderer styles.
- [x] Add a failing renderer regression test for outline-versus-filled star states.
- [x] Implement a consistent inline SVG star and saved-state styling.
- [x] Run renderer tests, the full quality gate, Electron E2E, and visual inspection.
- [x] Repackage, install, smoke-test, and open `TheRSS Dev.app`.

### Decisions

- Use an outlined star when unsaved and a gold filled star when saved.
- Keep the stable `Save signal` accessible name with `aria-pressed`; the visible label becomes icon-only.
- Reuse the existing `saved -> viewed` cancellation transition and SQLite persistence path.

### Errors encountered

- The new renderer test failed as expected because the current button still contained `Save` text and no `[data-save-star]` SVG path. Proceed with the minimal icon implementation.
- The first full check stopped at Prettier for `src/renderer/src/App.tsx`; format only the changed source file, then rerun the complete gate.

### Status

**Phase 13 complete.** The star toggle passed source, accessibility, persistence, Electron E2E, and visual checks. The package was rebuilt and installed at `~/Applications/TheRSS Dev.app`; its installed `app.asar` matches the release artifact (`6eba28bff549f216eab0585228bde85586779d43eb99a927c4a4eb4fffd6f690`), and the packaged-app smoke test passed.

## Phase 14: Agent-assisted semantic Discover

### Goal

Turn the disabled Discover placeholder into a bounded semantic expansion-search workflow: the user states a research intent, selects the configured model provider, Codex, or Claude Code, and receives real arXiv/GitHub results produced through typed source adapters with an inspectable generated search plan.

### Execution

- [x] Define and test the validated semantic-search request, generated plan, result, provenance, and partial-failure contracts.
- [x] Add model-provider and bounded local-agent plan generation without granting source content filesystem or arbitrary tool access.
- [x] Execute the generated plan through the existing arXiv and GitHub adapters, deduplicate results, and compute explainable deterministic relevance.
- [x] Add typed IPC/preload support and an accessible Discover renderer workflow.
- [x] Update product/design/traceability documentation and run coverage, build, Electron E2E, visual verification, and security gates.

### Decisions

- Models and local agents interpret the user's semantic intent and return a validated plan; TheRSS, not the model, retrieves source records.
- The first implementation searches arXiv and GitHub only and uses bounded query/result counts.
- Discover failures preserve source distinctions: a partial source result is not reported as a complete success, and generated text remains derived evidence.
- Discover is an explicit user-triggered network action and does not change the deterministic Today refresh contract.

### Errors encountered

- The first Discover Electron E2E attempt aborted inside the restricted desktop sandbox with `SIGABRT` and `kill EPERM` before any assertion ran. Re-run the same verifier outside the restricted GUI sandbox.
- The first `npm audit --audit-level=high` attempt could not resolve `registry.npmjs.org` in the restricted network sandbox. Re-run with network permission to obtain a valid result.
- Review found a renderer-state regression: reopening Discover restored the prior intent and runner but not the previously selected source set. Restore the source checkboxes from the persisted `not_searched` outcomes and add a regression test.

### Status

**Phase 14 complete.** Discover now performs bounded semantic plan generation through the configured model provider or local Codex/Claude runners, executes validated plans through the typed arXiv/GitHub adapters, persists separate sessions, promotes explicit saves into Saved without polluting Today, and passes unit, coverage, build, Electron E2E, dependency-audit, and rendered-UI verification.

## Phase 15: Local Data Analytics

### Goal

Replace the disabled Diagnostics placeholder with a local Data Analytics surface that shows how many source results were returned each day and which papers or repositories received deep analysis.

### Execution

- [x] Define exact daily aggregation, repeat-search, source, and analysis-attribution semantics.
- [x] Add failing repository/API/renderer/E2E tests for daily search counts and analyzed-item history.
- [x] Persist append-only Today refresh activity without changing the existing latest-source-health contract.
- [x] Aggregate Today refreshes, semantic Discover sessions, and analysis artifacts through typed IPC.
- [x] Implement the accessible Data Analytics navigation and dashboard.
- [x] Update product/design/traceability documentation and run coverage, build, Electron E2E, and rendered-UI verification.

### Decisions

- Analytics remains local-only and reads operational SQLite records; it does not introduce telemetry or cloud synchronization.
- Report Today refresh and semantic Discover activity separately so deterministic inbox refreshes are not conflated with explicit semantic searches.
- Count returned result records per completed search, including results seen again in a repeated refresh; label this as result volume rather than unique-paper discovery.
- Deep-analysis history is derived only from persisted `analysis_artifact` records and retains source type, title, runner/provider provenance, and timestamp.
- Historical Today refresh volume begins when append-only activity recording ships; do not fabricate prior daily totals from the latest-only `source_run` table.

### Errors encountered

- The RED test run failed at the intended boundaries: `getAnalyticsSnapshot` did not exist, `DataAnalyticsView` could not be imported, and the disabled Diagnostics button could not be found as an enabled Data Analytics route. Proceed with the minimum typed implementation.
- The first broad lint command traversed a pre-existing generated `playwright-report/` and reported thousands of third-party bundle errors; the owned-code result had one actionable issue in `DataAnalyticsView` (`setState` synchronously reachable from an effect). Split initial loading from the event-driven retry path and keep generated-report handling outside the feature diff.
- ESLint previously ignored build and coverage output but not Playwright's generated report/test-result directories. Add those standard generated paths to the lint ignore list so `npm run check` validates owned code without mutating or linting third-party report bundles.
- The first sandboxed Electron E2E and packaged-app smoke attempts aborted at the established macOS GUI boundary (`SIGABRT`/launch failure). The approved desktop-permission retries passed; the application behavior was not the cause.

### Status

**Phase 15 complete.** Data Analytics records append-only Today result volume, aggregates persisted Discover sessions and analysis artifacts through typed IPC, and renders daily/source-separated counts plus deep-analysis history. `npm run check` passed 127 tests with 93.93% statements, 84.45% branches, 94.83% functions, and 96.02% lines; Electron E2E, rendered screenshot inspection, release packaging, and explicit release-bundle smoke also passed.

## Phase 16: Apple-native editorial inbox

### Goal

Make the daily TheRSS workflow feel at home on macOS without erasing its editorial research identity: integrate the window chrome, replace the card wall with a list-detail workspace, and make repeated triage efficient from the keyboard.

### Execution

- [x] Add failing renderer and Electron E2E checks for list-detail selection, native-style navigation, and keyboard triage.
- [x] Integrate the macOS title bar and renderer shell while retaining safe Electron isolation.
- [x] Implement the Today/Saved list-detail workspace with an explicit selected record and provenance-preserving actions.
- [x] Add bounded keyboard navigation and Save/Dismiss/Analyze shortcuts that ignore editable controls.
- [x] Refresh the visual system around macOS typography, materials, focus, window resizing, and reduced motion.
- [x] Run focused tests, the full quality gate, Electron E2E, rendered screenshot review, package smoke, and local install when the source result is accepted.

### Decisions

- Use an Apple-native editorial direction: system typography and controls for application chrome; retain Newsreader only where it helps research-content identity.
- Keep Today and Saved on the same triage state and SQLite contracts; this phase changes presentation and interaction, not persistence semantics.
- Treat keyboard shortcuts as scoped inbox commands and ignore them while an input, select, textarea, or editable element has focus.
- Preserve Discover, analytics, provider, local-agent, local-first, evidence-boundary, and withdrawn-sync behavior.

### Errors encountered

- The initial RED renderer run failed at the intended boundaries: no selected-detail article, no signal-selection buttons, and no sidebar toggle existed. The run finished with 3 failures and 21 passing regression tests.
- The first GREEN run exposed eight legacy assertions that assumed each signal title appeared only once. Update those tests to query the list-selection controls and selected-detail region explicitly; the focused suite then passed 24/24.
- The restricted desktop sandbox aborted Electron before E2E assertions and packaged-app smoke. Re-run the same checks with approved desktop execution; both passed.
- The first package attempt could not resolve `github.com` while Electron Builder fetched a missing bundle. Re-run with approved network access; the unsigned arm64 directory build completed.
- The default package-smoke target initially exercised the prior installed app. Smoke the explicit `release/mac-arm64/TheRSS.app` executable before installation, then repeat against the newly installed copy.

### Status

**Phase 16 complete.** The macOS build now uses a hidden-inset title bar, collapsible native-style sidebar, system control typography, responsive light/dark materials, and a Today/Saved list-detail workspace with Arrow, Save, Dismiss, and Analyze shortcuts. `npm run check` passed 25 test files / 130 tests with 93.93% statements, 84.45% branches, 94.83% functions, and 96.02% lines. Electron E2E, current-release smoke, rendered screenshot inspection, installation, and installed-app smoke all passed. The previous app and SQLite database remain in timestamped backups.

## Phase 17: Apple semantic color system

### Goal

Unify every renderer surface around Apple-style semantic colors and materials while giving Today, Saved, Discover, Interests, Models, and Data Analytics restrained native system tints.

### Execution

- [x] Add a failing stylesheet contract for light/dark semantic color tokens and per-view accents.
- [x] Replace legacy paper/forest/beige colors with semantic system backgrounds, labels, fills, separators, and status colors.
- [x] Apply restrained per-view system tints without changing information or persistence behavior.
- [x] Capture representative renderer screenshots for onboarding/settings, Today, Discover, Models, and Data Analytics.
- [x] Run focused tests, full quality gates, Electron E2E, package smoke, and recoverable local installation.

### Decisions

- Follow Apple semantic roles rather than painting every screen with a large brand color: content surfaces stay neutral while selection, status, and small accents carry system color.
- Maintain accessible source identity: arXiv uses system blue, GitHub uses system orange, saved state keeps its tested accessible gold, success uses system green, and errors use system red.
- Use light/dark token overrides as the source of truth; component rules must not need separate ad hoc dark-mode palettes.

### Errors encountered

- The first multi-view Electron color check showed the Interests icon still using Today blue. The root-level `--accent` alias had resolved before the app-shell `--view-accent` override; recompute the alias on `.app-shell` so each active view inherits its selected tint.
- The first package attempt could not resolve `github.com` while Electron Builder fetched its bundle in the restricted network sandbox. The approved network retry completed the unsigned arm64 build.

### Status

**Phase 17 complete.** Every primary renderer surface now derives light/dark materials, labels, fills, separators, statuses, source identity, and per-view accents from one Apple-style semantic palette. `npm run check` passed 26 test files / 133 tests with 93.93% statements, 84.45% branches, 94.83% functions, and 96.02% lines. Electron E2E plus seven rendered screenshot checks passed in light and dark appearances. The unsigned arm64 release, explicit release smoke, recoverable local installation, and installed-app smoke also passed; the prior application and SQLite database remain in timestamped backups.

## Phase 18: Apple-native product and interaction audit

### Goal

Strictly audit the current product, rendered desktop flows, macOS interaction conventions, accessibility, and capability gaps; produce an evidence-backed remediation and feature-priority contract without changing product behavior during the audit.

### Execution

- [x] Reconfirm the product outcome, non-goals, architecture boundaries, and current roadmap.
- [x] Inspect the renderer, Electron window/menu behavior, keyboard paths, state handling, and tests.
- [x] Capture and inspect the current onboarding, Today/Saved, Discover, Interests, Models, and Analytics flows.
- [x] Separate confirmed strengths, structural issues, polish issues, accessibility risks, and screenshot-only evidence limits.
- [x] Produce a durable audit with P0/P1/P2 recommendations and an explicit build/defer/reject judgment for proposed capabilities.

### Decisions

- Audit against TheRSS's local-first academic-discovery purpose, not against a generic macOS content app.
- Treat an Electron implementation as Apple-native-aligned only when window behavior, menus, keyboard use, controls, state feedback, and accessibility support the visual styling.
- Do not add features during this phase; first determine whether they improve the daily discovery-to-triage-to-analysis loop without overlapping Zotero or Obsidian.

### Errors encountered

- Appending the audit note after the final SHA line failed because the patch context did not match despite the rendered text; insert the audit section through the stable semantic-color heading instead.

### Status

**Phase 18 complete.** Static product, implementation, Apple HIG, Electron, contrast, and quality-gate review is complete. The authorized current-run Electron fixture passed and seven current screenshots were inspected. The rendered baseline confirms a coherent neutral macOS shell and strong list-detail reading surface, while also confirming weak small-text contrast, overlarge editorial headings in settings/analytics, a non-native card treatment in Discover, visually unconditional green source status, and missing reversible feedback for destructive triage. The prioritized implementation contract is recorded in `docs/APPLE_NATIVE_PRODUCT_AUDIT.md`.

## Phase 19: Apple-native interaction correctness

### Goal

Make the daily discovery workspace behave like a trustworthy macOS information app before adding broader capabilities: truthful unread state, reversible triage, synchronized selection/focus, restored local analysis, visible source health, native commands, and honest responsive behavior.

### Execution

- [x] Add failing renderer tests for read-on-selection, undo, selection recovery, keyboard focus/scope, persisted analysis restore, and source health.
- [x] Implement the smallest typed renderer behavior that satisfies those contracts.
- [x] Add a TheRSS application menu for Settings, navigation, sidebar visibility, refresh, and workspace actions.
- [x] Make vibrancy follow window activity and stop CSS from silently overriding the sidebar's controlled state.
- [x] Strengthen light-mode small-text/status contrast and accessible error/status announcements.
- [x] Run focused tests, full quality gates, current-run Electron screenshots, package smoke, and recoverable local installation.

### Decisions

- Keep this phase within existing SQLite, preload, and source-adapter boundaries; no account, sync, background polling, or autonomous authoring.
- Treat selection, keyboard focus, unread state, and visible detail as one interaction contract rather than independent styling concerns.
- Undo only the latest successful local triage action and never invent remote or historical state.
- Restore only a persisted analysis artifact whose selected item still matches; do not display stale content from another item.

### Errors encountered

- The first final Electron retry could not launch inside the restricted GUI sandbox (`SIGABRT`/`kill EPERM`). The authorized desktop execution reached the flow but one `fullPage` screenshot intermittently exceeded Playwright's 30-second screenshot timeout. The Electron app is a fixed viewport with internal scrolling, so replace unnecessary full-page capture with viewport capture and disabled animations; the final flow passed in 5.2 seconds.
- Strict review found that a mixed `healthy` + `idle` source snapshot was summarized as `Sources ready`. Add a failing regression test, require every source to be `healthy` or `no_results` before declaring readiness, and report `Some sources pending` for mixed terminal/idle state.
- The first production dependency audit could not resolve `registry.npmjs.org` inside the restricted network sandbox. The authorized npm registry audit completed with zero vulnerabilities.
- The unsigned personal-beta package still has no valid Developer ID Application identity. This remains an explicit public-distribution gate and does not block the local development install.

### Status

**Phase 19 complete.** Explicit signal selection now closes the unread lifecycle without showing a persistent Undo HUD, list selection and DOM focus move together, and reversible Save/Dismiss changes offer a transient one-step Undo that does not leak across views. Persisted analysis reopens only for the matching item, and source health is truthful down to mixed pending states. The app now exposes typed native menu commands for Settings, navigation, sidebar, refresh, Save/Dismiss/Analyze, and triage Undo; macOS vibrancy follows window activity and narrow windows no longer override controlled sidebar state. Readable semantic foreground colors and live status/error roles complete the P0 visual/accessibility slice. `npm run check` passed 27 test files / 141 tests with 93.55% statements, 84.10% branches, 93.95% functions, and 95.74% lines. The final Electron fixture passed in 5.2 seconds, all seven final screenshots were inspected, the production dependency audit found zero vulnerabilities, and the recoverable local install plus installed-app smoke passed. Release and installed `app.asar` hashes both equal `43765d677b32a93944bf48c386337578da04a3e1627c9e595bb2f4951221e12e`.

## Phase 20: Built-in research source catalog

### Goal

Add the selected 106 research sources to a real, inspectable TheRSS product surface without implying that catalog membership equals executable retrieval.

### Execution

- [x] Add exact catalog invariants for 106 unique HTTPS sources, A/B/C counts, C-class identities, and acquisition-state counts.
- [x] Add a typed immutable shared catalog generated from the validated selection.
- [x] Add a searchable Sources view with priority, research-axis, and acquisition-state filters.
- [x] Integrate Sources into the application navigation and preserve Today/Discover source unions.
- [x] Document the catalog/retrieval boundary and verify the renderer in Electron.

### Decisions

- Catalog metadata is versioned application content, not mutable operational state, so it does not require a SQLite table or IPC method.
- Only arXiv and GitHub are marked active because they are the only current executable adapters.
- The remaining entries are separated into 94 RSSHub candidates and 10 sources requiring new adapters; neither state can enter Today or Discover yet.

### Errors encountered

- The first focused green run used an unsupported Chai `toHaveSize` matcher; replace it with an explicit `Set.size` assertion.
- The first Electron E2E launch aborted inside the restricted GUI sandbox with `SIGABRT` and `kill EPERM`; the approved desktop-permission retry passed.

### Status

**Phase 20 complete.** The Sources navigation now exposes all 106 selected entries with accurate A=40, B=63, C=3 and acquisition counts. Search and filters are available without widening the executable source boundary. `npm run check` passed 29 test files / 147 tests with 93.06% statements, 83.13% branches, 94.24% functions, and 95.23% lines; Electron E2E and rendered screenshot inspection also passed.

## Phase 21: Paper-specific llm-wiki L1 analysis

### Goal

When a selected discovery item is a paper, place its user-initiated analysis directly after the paper summary and generate that artifact with an evidence-bounded adaptation of llm-wiki's `Paper_Note_L1` template; preserve the existing generic analysis contract for repositories and other item kinds.

### Execution

- [x] Record the exact L1 sections, paper-kind routing rule, evidence boundary, and renderer placement.
- [x] Add failing prompt, provenance, renderer-order, and critical Electron-flow tests.
- [x] Implement the smallest typed paper-specific prompt/version and detail-panel behavior.
- [x] Document the capability and run focused tests, the full quality gate, Electron E2E, and rendered screenshot review.

### Decisions

- Keep analysis user initiated: selecting a paper must not silently spend provider quota or launch a local agent.
- Treat every `kind: paper` record as eligible regardless of whether it came from arXiv, Hugging Face, or a later typed source adapter.
- An abstract-only result is a provisional L1-formatted analysis, not a verified full-paper deep read; unknown fields remain `[TBD]`.
- Use a distinct prompt version so stored artifacts disclose whether the llm-wiki L1 contract produced them.

### Errors encountered

- The focused RED run failed at all intended boundaries: paper prompts still used the generic five-section analysis and 1,500-token budget; stored artifacts still reported `discovery-analysis-v1`; the local-agent prompt lacked the L1 contract; and the paper result still rendered below actions as a generic analysis panel. The run completed with 6 expected failures and 48 passing regressions.
- The first restricted-sandbox Electron launch aborted before assertions at the established macOS GUI boundary (`SIGABRT` / `kill EPERM`); the desktop-permission rerun passed.
- The first rendered L1 fixture exposed raw Markdown heading markers in the detail pane. Add a dependency-free React renderer for bounded headings, lists, and tables, retain text escaping, and add renderer assertions before recapturing the accepted screenshot.
- The first restricted-network package attempt could not resolve `github.com` while Electron Builder fetched its runtime. The approved network rerun built the unsigned arm64 app and the explicit packaged-app smoke passed; no local app was replaced.
- During final closure, unrelated in-progress Sources/arXiv tests appeared in the shared dirty checkout. They currently stop repository-wide formatting on 3 untracked test files, type checking on 12 source-contract mismatches, and coverage on 16 failures / 191 passes. Do not rewrite that work from this feature; the L1-focused 55-test suite, scoped formatting, lint, production build, and current Electron E2E remain green.

### Status

**Phase 21 feature scope complete.** Typed papers from any source now use the versioned llm-wiki L1 prompt and render the resulting artifact immediately after the summary; legacy arXiv records retain a narrow compatibility fallback. The current focused suite passes 55/55, scoped formatting and lint pass, the production/MCP build passes, Electron E2E passes 1/1, and the post-analysis screenshot was inspected. The repository-wide gate is not currently green because of the separately owned Sources/arXiv work recorded above.

## Phase 22 — Honest source desks and failed-route repair

- [x] Separate arXiv Sources browsing from Today/Discover interests and fetch the newest available
      official daily batch with bounded 429 retry and non-empty-day fallback.
- [x] Replace NBER, McKinsey, and Nikkei landing pages with official RSS plus dedicated date
      enrichment where the feed omits dates.
- [x] Add NCPSD primary retries, fixed mobile fallback, and a latest-literature parser that never
      executes remote JavaScript.
- [x] Default Sources to 23 content sources and group the remaining 82 entries under Pending
      integrations.
- [x] Surface bounded real refresh errors while preserving cached content.
- [ ] Repair the installed-app `npx` lookup for explicit X/xapi searches; intentionally deferred by
      user direction because it widens the packaged runtime PATH/trust boundary.

Live verification on 2026-08-19 returned normalized content for all 20 non-X configured adapters:
NCPSD 4, NBER 15, McKinsey 50, Nikkei 18, and the remaining feed/Hugging Face adapters 1–100 each.
The independent source smoke returned arXiv interest=3, arXiv newest daily batch=200, and GitHub=25.
X was explicitly skipped to avoid a metered call. The full quality gate passed 41 test files / 216
tests with 91.54% statements, 80.42% branches, 92.72% functions, and 94.50% lines; production
build, Electron E2E, rendered screenshot review, local installation, and packaged-app smoke passed.

## Phase 23 — Publish the completed local-first discovery suite

- [x] Wait for the source-ingestion task to finish and read its final verification state.
- [x] Reconcile the shared worktree as the completed Phase 13–22 product scope; keep ignored build,
      coverage, Playwright, release, and test-result output outside version control.
- [x] Verify remote parity, secret hygiene, diff hygiene, the complete quality gate, and the
      high-severity dependency audit.
- [x] Commit the verified scope on `codex/local-first-discovery-suite`, push it, and confirm the
      remote ref and review handoff.

Current publish verification: `origin/main...main` was `0 0`; `npm run check` passed 41 test files /
216 tests with 91.54% statements, 80.42% branches, 92.72% functions, and 94.50% lines; the
production and MCP builds passed; `npm audit --audit-level=high` reported zero vulnerabilities.
The final Electron critical-path E2E also passed 1/1 in 5.3 seconds on the publish branch.

The first staging attempt could not create `.git/index.lock` inside the restricted workspace
sandbox. No source file or index entry changed; rerun the same scoped `git add` with the approved Git
write boundary.

The first commit attempt was stopped by the ECC secret hook because two tests assigned obvious
placeholder strings directly to credential-shaped fields. No commit was created. Replace those
literals with runtime-composed test placeholders, rerun the focused tests and secret scan, and keep
the hook enabled.

Publication handoff: commit `d1d06ed` reached `origin/codex/local-first-discovery-suite` with an
exact remote-ref match, and draft PR #5 targets `main`. The pre-push hook independently reran lint,
type checking, all 216 tests, and both production builds before accepting the push.

## Phase 24 — Explicit X research watchlist

### Goal

Replace the interest-derived X query with the user-approved, inspectable list of 22 recommended
research accounts plus `@elonmusk`, while keeping X retrieval bounded and metered.

### Execution

- [x] Add failing watchlist, adapter, source-service, and renderer tests.
- [x] Add one immutable 23-account watchlist grouped by research area.
- [x] Build one bounded `twitter.search` query per refresh and request at most 100 latest posts.
- [x] Make the X source desk independent of Interests and show the tracked handles plus metering
      boundary before the explicit search action.
- [x] Update X capability/setup documentation and run focused plus full verification.

### Decisions

- The six groups are for human inspection; all 23 `from:` clauses fit in one 500-character query,
  so one refresh remains one metered search rather than six.
- The code-owned watchlist replaces interest-keyword construction for X. Today and Discover
  interests keep their existing behavior for all other sources.
- Adding the list does not authorize a live xapi call, package installation, or the separately
  deferred installed-app `npx` path repair.

### Errors encountered

- The first Electron E2E run failed before assertions at the established restricted macOS GUI
  boundary (`SIGABRT` and `kill EPERM`). The approved desktop-permission rerun passed; no product
  change was required.

### Status

**Phase 24 complete.** X now follows the immutable 23-account watchlist and shows all six groups in
Sources. One refresh builds one 441-character query and requests at most 100 latest posts. The RED
run failed at the four intended boundaries; the focused suite then passed 26/26. `npm run check`
passed 42 test files / 218 tests with 91.38% statements, 80.16% branches, 92.78% functions, and
94.28% lines. Electron E2E passed 1/1, and both the full watchlist and scrolled `@elonmusk`
screenshots were inspected. No live xapi call, package installation, or installed-app `npx` repair
was performed.

## Phase 25 — Retain only the 22 live-verified sources

### Goal

Limit the current product to the 22 sources whose 2026-08-19 retrieval was successfully verified;
remove X and every pending integration from Sources and active refresh scheduling without deleting
historical catalog metadata or local research records.

### Execution

- [x] Add failing catalog, configured-registry, renderer, and Electron contracts for exactly 22
      retained sources and no pending/X surface.
- [x] Add one immutable retained-source allowlist and filter the product catalog to it.
- [x] Remove X from the executable configured-source registry and Today refresh scheduling.
- [x] Remove the superseded X watchlist surface and update product/capability/setup documentation.
- [x] Run focused tests, the full quality gate, Electron E2E, and rendered Sources inspection.

### Decisions

- Preserve the 105-entry raw catalog as dormant versioned metadata because “暂时不再考虑” is not
  authorization to erase history; expose only the 22 retained entries through `SOURCE_CATALOG`.
- Preserve SQLite records and source-identity compatibility. Stopping retrieval and hiding the
  directory entry must not destroy Saved items or historical analytics.
- The retained set is arXiv, GitHub, Hugging Face, and the 19 credential-free configured sources
  that produced normalized content in the prior live verification.

### Errors encountered

- The first full gate found one old normalizer test still using retired `folo:2`; moving the generic
  contract to retained OpenAI exposed that the now-unreachable X client also pulled global branch
  coverage to 79.9%. Removing the unregistered X client/test raised branch coverage above the 80%
  gate without weakening retained-source coverage.
- The first Electron launch hit the established restricted macOS GUI boundary (`SIGABRT` and
  `kill EPERM`). The approved GUI run then found one stale `Additional: 21/21 ready` assertion;
  correcting it to the actual 20 configured adapters made the complete 22-source E2E pass.

### Status

**Phase 25 complete.** `SOURCE_CATALOG` and active discovery expose exactly 22 sources (A=7, B=15),
while the raw 105-entry catalog and saved historical records remain recoverable. X, Pending
integrations, and all other candidates are absent from Sources and refresh scheduling. The focused
suite passed 78/78; `npm run check` passed 40 test files / 209 tests with 91.87% statements, 80.23%
branches, 93.35% functions, and 94.97% lines; production and MCP builds passed. Electron E2E passed
1/1, and `08-sources.png` plus `08b-source-detail.png` were inspected without layout or content
boundary regressions. No package installation or live network revalidation was performed.

## Phase 26 — Discover-centered product consolidation

### Goal

Make Discover the single user-facing research retrieval workflow, remove the overlapping Today and
Interests navigation surfaces, and let one model/agent-expanded intent search any subset of all 22
retained live-verified sources without reading the retired Interest profile.

### Execution

- [x] Add failing shared, planner, service, persistence, renderer, native-menu, and Electron
      contracts for the Discover-centered workflow and all-source selection.
- [x] Extend Discover execution, source outcomes, persisted result kinds, and migration support from
      the old arXiv/GitHub-only union to all retained source identities.
- [x] Replace the two-source control with an inspectable 22-source selector that defaults to every
      deployed source and preserve per-source success, empty, and failure states.
- [x] Make Discover the initial navigation surface; remove Today and Interests from navigation and
      native menus while preserving historical SQLite data and Saved records.
- [x] Update the product/design contract, run focused and full verification, inspect the rendered
      desktop result, and record any remaining live-source or package boundary.

### Decisions

- The 22-source retained allowlist is the only Discover source registry; raw catalog candidates and
  X remain excluded.
- The generated `discover-plan-v1` remains a bounded semantic term plan. arXiv and GitHub execute
  specialized queries; the other deployed adapters fetch bounded current records and TheRSS applies
  the same transient plan for deterministic relevance filtering and ranking.
- Removing Today and Interests is a product-surface change, not authorization to delete the legacy
  Interest profile, daily inbox, analytics history, or Saved data from SQLite.
- Discover defaults to all 22 deployed sources, but selection remains explicit and inspectable so a
  user can avoid an unnecessary source request.

### Errors encountered

- The initial all-project RED run left 28 obsolete `App.test.tsx` assumptions tied to Today,
  Interests, and automatic refresh. Replacing that test surface with 12 Discover/Saved/settings/
  analytics/Sources contracts made the renderer suite green without retaining dead product paths.
- Core review found four blockers: cross-source-only plans, substring false positives such as `ai`
  in `chair`, all-invalid batches reported as partial, and over-broad Hugging Face token forwarding.
  RED regressions were added; the final implementation also preserves CJK phrase matching, chunks
  100+ Saved lookups, and reconciles post-dedup source counts.
- The first restricted Electron launch failed at the known macOS GUI boundary (`SIGABRT` and
  `kill EPERM`); the approved desktop run passed.
- The first package build could not resolve GitHub inside the restricted network boundary. The
  approved retry downloaded the Electron builder resources and produced the unsigned arm64 app.
- The original package smoke script targeted an older installed `TheRSS Dev.app`, whose `app.asar`
  did not match the new release. Its default now targets the freshly built release app; the corrected
  smoke passed without installing or overwriting the user's app.

### Status

**Phase 26 complete.** Discover is now the default and only user-facing acquisition workflow, with
an inspectable selector derived from the exact 22 retained source IDs. arXiv/GitHub use their
specialized bounded queries; the other 20 adapters retrieve bounded recent batches and must pass a
deterministic semantic match before results enter the session. Dynamic per-source outcomes,
cross-source deduplication, configured item kinds, Saved promotion, and legacy two-source SQLite
migration are covered.

`npm run check` passed 42 files / 213 tests with 91.85% statements, 80.83% branches, 93.79%
functions, and 94.81% lines; both production builds passed. The Discover-first Electron fixture
passed 1/1 and seven screenshots were inspected across Discover, configured-source filtering,
Saved, Models, Analytics, and Sources. `npm run package:mac` produced
`release/mac-arm64/TheRSS.app`, and the corrected release-targeted package smoke passed. No live
model or 22-source search, app installation, commit, push, or publication was performed.

## Phase 27 — Apple-native Discover refinement and live-source repair

### Goal

Turn the Discover-centered product into a calmer macOS research workspace: repair live source
routes without weakening TLS, make results the primary post-search content, keep source/plan detail
inspectable through progressive disclosure, and replace decorative delay with brief truthful
feedback.

### Execution

- [x] Add RED contracts for safe source-route replacements, compact source disclosure, result-first
      ordering, bounded result motion, loading feedback, and searchable detail disclosure.
- [x] Replace only failed routes that have a currently verified credential-free HTTPS alternative;
      preserve explicit failed state for any source without one.
- [x] Refine Discover into an editorial-native search surface with compact source summary,
      result-first hierarchy, and reusable macOS-style detail disclosure.
- [x] Add honest indeterminate search feedback, reduce card chrome and unbounded stagger, and make
      Reduced Motion cover transitions as well as keyframe animations.
- [x] Run focused tests, full coverage/build, live source smoke, Electron E2E, rendered light-mode
      inspection, and package smoke without installing, committing, or pushing.

### Decisions

- Keep Newsreader for research/content headings; use the system UI stack for navigation, controls,
  statuses, metadata, and settings.
- Do not imitate Liquid Glass across the content plane. Vibrancy remains window chrome; content
  hierarchy uses restrained fills, dividers, and selected rows.
- Do not fabricate per-source completion percentages. Until typed streaming progress exists, show
  an accurate indeterminate phase and selected-source count, then expose final per-source outcomes.
- A replacement source route must pass the same HTTPS, origin, normalization, and bounded-content
  checks as the existing adapter. Disabling TLS verification is prohibited.

### Errors encountered

- Pre-implementation live smoke passed 20/22 sources. The first configured run timed out for
  科学网, 麻省理工科技评论, AIbase, and C114; the second recovered MIT Technology Review China
  and AIbase but again timed out for 科学网 and C114. Direct checks showed the shared `hub.slarker.me`
  proxy returned no bytes within 35 seconds for both routes.
- The first post-change configured-source run had transient AIbase and C114 failures. A direct Node
  request then reached C114 with HTTP 200, and the immediate full rerun passed 20/20 configured
  sources. The evidence retains both runs instead of hiding the transient failure.
- The first sandboxed package attempt could not resolve `github.com`; the approved network rerun
  downloaded the Electron build resource and produced the unsigned macOS directory package.

### Status

**Phase 27 complete.** `npm run check` passed 42 files / 219 tests with 91.51% statements and
80.56% branches; live retrieval passed all 22 sources on the final run; Electron E2E passed 1/1;
all seven light-mode captures were inspected; the unsigned, uninstalled macOS package passed its
isolated startup/preload smoke.

## Phase 28 — Local package update and main publication

### Goal

Update the reversible local development application, bring the public README in line with the
Discover-centered product and current live-source evidence, and publish the verified worktree to
GitHub `main` without force-pushing or losing remote history.

### Execution

- [x] Update and format the GitHub README.
- [x] Re-run the full quality, Electron E2E, live-source, security, and package gates.
- [x] Install the local beta with database and previous-app retention, then smoke the installed app.
- [x] Inspect and stage the authorized full worktree, scan added content for credentials, and commit.
- [x] Reconcile the patch-equivalent feature/main histories, publish through the protected-branch PR,
      and verify local/remote SHA equality.

### Status

**Phase 28 complete.** The product commit was published through protected-branch PR #6 after its
required `quality` check passed; GitHub `main` recorded it as `7227547`. The installed app and
release `app.asar` share SHA-256
`305c54ee53aa23f2dfa3c63af270c54edad95ece982e7fc4908b01e7b5ccf78e`. The database backup is
`~/Library/Application Support/therss/backups/therss-2026-08-19T21-25-28-902Z.sqlite`; the previous
app is retained at `~/Applications/TheRSS Dev.backup-2026-08-19T21-25-28-902Z.app`.

## Phase 29 — Scrollable Discover results and direct paper analysis

### Goal

Make the ranked Discover result region independently scrollable, replace the result-save text with
an accessible outline/filled star toggle, and let a user run the existing evidence-bounded
`llm-wiki-paper-l1-v1` analysis directly from a paper result card.

### Execution

- [x] Add RED renderer and Electron contracts for a bounded scroll region, reversible star state,
      paper-only Analyze placement, and direct L1 analysis.
- [x] Reuse the existing Discover promotion, triage, and analysis-artifact boundaries so direct
      analysis neither grants renderer privileges nor invents a second persistence model.
- [x] Implement the smallest renderer/CSS/API changes and keep non-paper results free of the paper
      analysis action.
- [x] Run focused tests, the full quality gate, Electron E2E, and rendered screenshot inspection.

### Decisions

- The result list, not the whole Discover search form, owns post-search scrolling so filters and
  search context remain visible while browsing a long session.
- A Discover result must be promoted to the local discovery index before analysis; the user-initiated
  Analyze action may perform that prerequisite without changing the visible star to saved.
- The direct paper action uses the currently selected analysis runner and the packaged
  `llm-wiki-paper-l1-v1` prompt; it does not read or write the llm-wiki vault at runtime.

### Status

**Phase 29 complete.** The intended RED run failed at all four new boundaries. `npm run check` now
passes 42 test files / 224 tests with 91.56% statements, 80.71% branches, 93.51% functions, and
94.44% lines; production and MCP builds pass. The authorized Electron critical path passes 1/1 and
proves non-zero result scrolling, outline/filled/reversible stars, paper-only analysis, no implicit
save on Analyze, and a persisted `llm-wiki-paper-l1-v1` artifact. The Discover results, expanded L1
analysis, filtered record, and filled-star screenshots were inspected without clipping or control
misalignment. No live provider/source call, package installation, commit, push, or publication was
performed.

### Errors encountered

- The restricted Electron launch aborted at the established macOS GUI boundary with `SIGABRT` and
  `kill EPERM`; the authorized desktop rerun reached all new scroll/star/analysis assertions.
- That rerun then found an obsolete broad text selector: analysis provenance adds a second valid
  `Codex CLI · codex-cli` label alongside Search details. Scope the old assertion to the Search
  details region instead of weakening either provenance surface.
- The first formatting check reported two changed files; scoped Prettier formatting resolved it.
- The first non-paper negative test referenced an identifier outside its Discover fixture and
  correctly returned `Unknown Discover result`. Add an explicit repository-shaped result to the
  fixture, then verify it is rejected before materialization.

## Phase 30 — Personal research context

### Goal

Add a local Personal Prompt setting that lets the user provide stable research context for more
specific Discover plan generation while keeping each search intent explicit, the generated plan
inspectable, and the full saved prompt out of logs and direct source-adapter inputs.

### Execution

- [x] Map the current Models & Agents settings surface, typed IPC, SQLite ownership, and Discover
      prompt/provenance path before choosing the interaction and storage contract.
- [x] Add RED schema, repository, planner, IPC, renderer, and Electron contracts for bounded,
      optional personal context.
- [x] Implement the smallest local persistence, settings UI, and prompt-composition changes with
      explicit enablement and privacy guidance.
- [x] Update the product/design contract and run focused tests, the full quality gate, Electron E2E,
      and rendered UI inspection.

### Initial decisions

- Personal context supplements the current Discover intent; it never replaces the per-search query
  and never reaches source adapters as an unvalidated query.
- Store the bounded plain-text setting in local SQLite, not browser storage or a cloud/account
  surface. Do not log or render it inside historical result/provenance views.
- Preserve prompt traceability with a version and input hash rather than duplicating the personal
  text into every Discover session.
- Treat a saved non-empty prompt as active and a saved empty prompt as disabled. This keeps one
  obvious source of truth instead of allowing a toggle and text field to disagree.
- New personalized-capable runs use `semantic-discover-v2` and record only an applied/not-applied
  provenance flag plus the exact composed-input hash; legacy v1 sessions remain readable.

### Errors encountered

- The added personalization-schema RED suite initially could not import the not-yet-created module;
  adding the bounded shared schema made its trim, empty-disable, size, and control-character cases
  pass.
- Two concurrent audit paths briefly produced overlapping partial persistence code. Stop the audits,
  retain one shared-schema implementation, remove the duplicates, and verify the repaired boundary
  with TypeScript before continuing.
- One provenance parser narrowing expression returned `unknown` to a boolean field. Require an
  explicit `typeof === 'boolean'` guard and default legacy records to `false`.
- Independent review found the original privacy copy overstated the source boundary: source sites
  receive planner-generated search terms, which can reflect personal context. Correct the UI and
  product/design contract, while retaining the true boundary that the full saved setting is sent
  only to the selected planner after an explicit Discover action.
- Review also caught desktop CSS specificity, permissive v2 provenance fallback, and missing clear-
  to-disable coverage. Add focused RED cases, then fix the one-column selector, require the v2 flag,
  and verify non-empty -> empty -> Discover off across renderer/repository/planner boundaries.

### Status

**Phase 30 complete.** The Personal Prompt settings surface is now anchored at the top of Models &
Agents, Discover shows whether personal context is active without echoing the private text, and the
planner/provenance path records only an applied flag plus the composed-input hash. The final
review-focused suite passed 4 files / 60 tests. `npm run check` passed 43 files / 236 tests with
91.69% statements, 81.15% branches, 93.59% functions, and 94.56% lines; production and MCP builds
passed. The
restricted Electron launch hit the established macOS GUI sandbox boundary (`SIGABRT` / `kill
EPERM`), then the authorized desktop rerun passed 1/1. Rendered inspection of
`test-results/05-personal-prompt-settings.png`,
`test-results/05b-personalized-discover-ready.png`, and
`test-results/05c-personalized-discover.png` confirmed the one-column settings hierarchy, accurate
privacy copy, active state, and personalized provenance/result layout. Independent code/security
review findings were addressed; no blocking issue remains. No live provider/source call, package
installation, commit, push, or publication was performed.

## Phase 31 — Local install and publication closure

### Goal

Build the verified current worktree, replace the existing reversible local `TheRSS Dev.app`, smoke
the installed bundle, then commit and push the complete Phase 29–30 Discover improvement set.

### Execution

- [x] Recheck the exact install target, database path, Git branch/remote, and final diff scope.
- [x] Run the reversible local installer and validate the installed bundle plus retained backups.
- [x] Review staged content for secrets and unintended artifacts.
- [x] Create one Conventional Commit for the verified Phase 29–30 worktree.
- [x] Push the protected-main-compliant branch, verify local/remote convergence, and record final
      evidence.

### Decisions

- Treat the user's follow-up as authorization to publish the complete currently verified Phase
  29–30 worktree. Generated release/test output remains ignored and outside the commit.
- Use the established `npm run install:local` workflow, which backs up SQLite, retains the previous
  app, and refuses symbolic-link or unexpected targets before replacement.
- Smoke the installed executable explicitly rather than attributing the release-directory smoke to
  the installed app.

### Status

**Phase 31 complete.** `npm run install:local` installed the unsigned arm64 build at
`/Users/dtjgp/Applications/TheRSS Dev.app`; the explicitly installed executable passed packaged
smoke. The retained SQLite backup passes `PRAGMA integrity_check`, bundle metadata is version
`0.2.0` / `dev.dtjgp.therss`, and installed/release `app.asar` files share SHA-256
`601dbfd76044970ebdbf57a369ccd8700db9ae28f48fd1d31ec477ece20dfbaa`. The staged source/test/docs
set passes whitespace and secret-pattern review; the production dependency audit reports zero
vulnerabilities. Feature commit `7b5ecb1` passed the ECC pre-push lint, typecheck, 43-file/236-test,
and production/MCP build gate. GitHub correctly refused direct protected-`main` publication, so the
same commit was pushed to `origin/codex/personalized-discover` with upstream tracking. No pull
request or merge was created without separate authorization.

### Errors encountered

- The first backup-integrity command ran inside the restricted sandbox and SQLite returned
  `unable to open database file (14)` for the external backup path. The approved read-only rerun
  returned `ok`; no database write or repair was attempted.
- The first production `npm audit` could not resolve `registry.npmjs.org` inside the network-
  restricted sandbox. The approved npm advisory-endpoint rerun completed with zero vulnerabilities.
- A combined staging/status shell command could not create `.git/index.lock` inside the restricted
  sandbox. Reissuing only the already-authorized scoped `git add task_plan.md` succeeded.
- GitHub rejected `git push origin main` with `GH006` because `main` requires a pull request and the
  `quality` status check. Do not bypass protection: create the `codex/personalized-discover` branch
  from the verified commit and push that branch instead.
- The first sandboxed `git switch -c` could not create the branch ref lock. The approved scoped
  branch-creation rerun succeeded; no existing branch or commit was rewritten.
