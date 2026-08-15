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
- [x] Phase 6: Complete security, quality, runtime, and requirement-by-requirement verification.
- [ ] Phase 7: Create the GitHub repository, push the verified initial version, and record release evidence.

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

## Errors encountered

- `gh auth status` reports an invalid token for the active `dtjgp` account. Continue local work; re-authenticate before repository creation/push.
- Initial `npm install` failed because `electron-vite@5.0.0` supports Vite 5–7 while the unqualified latest Vite was 8.2.1. Resolve by pinning the latest compatible Vite 7 release; do not bypass peer checks with `--force`.
- The first sandboxed development launch could not bind `::1:5173`; the approved local launch succeeded outside the network sandbox.
- npm 11 installed the Electron package without its desktop binary. Add `scripts/ensure-electron.mjs` to `postinstall`, explicitly allow the required `better-sqlite3`/`esbuild` scripts, deny the unused Windows installer script, and verify a real Electron launch.
- The first E2E run found a blank renderer because a sandboxed Electron renderer cannot load an ESM preload. Build the preload as bundled CommonJS and keep `sandbox: true` plus context isolation.
- The first local installer used a generic filesystem copy that rewrote relative Electron Framework links into invalid absolute links. Replace it with macOS `ditto`, verify the copied framework links and ICU data, retain the previous app, and add an installed-package renderer/preload smoke test.
- Parallel sandboxed smoke execution caused Electron `SIGABRT`, tsx IPC `EPERM`, and blocked registry DNS. Serial execution with the required desktop/network permissions passed; do not classify the sandbox failure as an application regression.

## Status

**Phases 0–6 complete locally; Phase 7 pending.** The v0.1 discovery, model-analysis, read-only MCP, and recoverable installed-beta loops pass their release gates. `npm run update:local` is implemented but cannot complete its `git pull --ff-only` path until a remote exists. GitHub publication remains blocked by the invalid local `gh` credential and the repository visibility choice.
