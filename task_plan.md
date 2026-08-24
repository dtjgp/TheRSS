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

## Status

**All 39 phases through 2026-08-24 are complete.** The current head on `main` is the personal
beta (v0.2.0): Discover-centered retrieval over the 22 live-verified sources, confirmation-gated
llm-wiki promotion, and the Apple-native design pass. Builds remain unsigned.

Active work is tracked in [`GOALS.md`](GOALS.md) under "Later goals" and in
[`docs/ROADMAP.md`](docs/ROADMAP.md) under "Deferred". Completed phase execution records live in
[`docs/history/PHASE_EXECUTION_HISTORY.md`](docs/history/PHASE_EXECUTION_HISTORY.md).

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

## Completed phase index

Full execution records: [`docs/history/PHASE_EXECUTION_HISTORY.md`](docs/history/PHASE_EXECUTION_HISTORY.md).

- Phases 0-11: governance, scaffold, discovery loop, model providers, agent integration,
  packaging, verification, GitHub publication, Saved inbox, brand alignment, and the withdrawn
  account-sync experiment.
- Phase 12: Repository cleanup and version-control preservation
- Phase 13: Star-shaped Saved toggle
- Phase 14: Agent-assisted semantic Discover
- Phase 15: Local Data Analytics
- Phase 16: Apple-native editorial inbox
- Phase 17: Apple semantic color system
- Phase 18: Apple-native product and interaction audit
- Phase 19: Apple-native interaction correctness
- Phase 20: Built-in research source catalog
- Phase 21: Paper-specific llm-wiki L1 analysis
- Phase 22: Honest source desks and failed-route repair
- Phase 23: Publish the completed local-first discovery suite
- Phase 24: Explicit X research watchlist
- Phase 25: Retain only the 22 live-verified sources
- Phase 26: Discover-centered product consolidation
- Phase 27: Apple-native Discover refinement and live-source repair
- Phase 28: Local package update and main publication
- Phase 29: Scrollable Discover results and direct paper analysis
- Phase 30: Personal research context
- Phase 31: Local install and publication closure
- Phase 32: Apple system typography
- Phase 33: Install and publish Apple typography
- Phase 34: Native macOS window shortcuts
- Phase 35: Publish native macOS shortcuts
- Phase 36: Confirmation-gated llm-wiki paper promotion
- Phase 37: Backup cleanup, database documentation, and main publication
- Phase 38: Complete product-design remediation and local beta update
- Phase 39: Remove superseded app backups and publish all work
