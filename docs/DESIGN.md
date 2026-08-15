# TheRSS Initial Design

## Status

Accepted for initial implementation on 2026-08-15. Revisit if an executable spike contradicts a major assumption.

## Context

Research discovery is fragmented across arXiv queries, category feeds, GitHub search/trending pages, and ad hoc model conversations. TheRSS provides one daily operational inbox while leaving durable literature/knowledge ownership to specialized tools.

## Goals

- Fetch recent arXiv papers from user-defined categories and keyword queries.
- Discover new or active GitHub repositories matching user-defined keywords, topics, and languages.
- Normalize both sources into one explainable daily ranking.
- Preserve triage state and analysis provenance locally.
- Allow user-configured model analysis and one shared agent interface.
- Make personal development updates fast without requiring paid Apple signing.

## Non-goals

See `PRODUCT.md`. In particular: no general news reader, cloud account system, autonomous scientific claims, or Obsidian/Zotero replacement.

## Chosen stack

| Layer           | Choice                                | Rationale                                                                                |
| --------------- | ------------------------------------- | ---------------------------------------------------------------------------------------- |
| Desktop         | Electron                              | Mature local Node integration, packaging, MCP process support, and rapid renderer reload |
| UI              | React + TypeScript + Vite             | Typed, testable, fast iteration                                                          |
| Storage         | SQLite + FTS5                         | Local durability, transactions, explainable queries, no server                           |
| Validation      | Zod                                   | Runtime validation at external and IPC boundaries                                        |
| Tests           | Vitest + Testing Library + Playwright | Unit, integration, renderer, and critical desktop flow coverage                          |
| Agent interface | MCP over stdio                        | One tool contract consumable by Codex and Claude Code                                    |
| Packaging       | Electron Builder/compatible packaging | Local `.app` builds now; signed updater path later                                       |

## Alternatives considered

### Tauri

Smaller binaries and strong isolation are attractive, but Rust/JavaScript bridging, SQLite/plugin choices, and spawning agent tooling increase initial complexity. Rejected for the initial release; the domain packages should remain portable enough to revisit.

### Obsidian-only plugin

Excellent future companion surface, but background discovery, independent daily use, packaging of the core, and direct agent/model integration are clearer in a standalone app. Rejected as the only initial surface.

### Web/PWA

Simpler distribution but weaker local process, secret storage, MCP, filesystem, and offline integration. Rejected.

## System decomposition

```text
Renderer (untrusted UI)
       |
       | typed preload API
       v
Electron main/application services
       |
       +-- Interest service
       +-- Refresh orchestrator
       +-- Ranking service
       +-- Analysis service
       +-- Diagnostics/update service
       |
       +-- SQLite repositories
       +-- Encrypted secret store
       +-- arXiv adapter
       +-- GitHub radar adapter
       +-- Model provider adapters
       +-- MCP server / agent request queue
```

## Source strategy

### arXiv

- Use `export.arxiv.org/api/query` Atom results.
- Build queries from explicit category and keyword settings.
- Sort by submitted or updated date descending.
- Cache one response per canonical query per UTC day.
- Space consecutive requests by at least three seconds.
- Retain arXiv ID/version, title, authors, abstract, categories, published/updated timestamps, DOI/journal reference when present, abstract URL, and PDF URL.
- Never claim the abstract verifies full-paper methods or results.

Official reference: <https://info.arxiv.org/help/api/user-manual.html>

### GitHub Interest Radar

GitHub does not expose a stable official API for the website's Trending ranking. The initial version therefore implements an explicitly named Interest Radar using official repository search:

- keyword matches in name, description, topics, and optionally README metadata;
- `topic`, `language`, `created`, `pushed`, `stars`, `archived:false`, and `fork:false` qualifiers;
- authenticated search when the user configures GitHub credentials, with an unauthenticated public fallback;
- visible scoring inputs: interest match, recency, stars, and activity;
- no claim that the result reproduces GitHub Trending.

Official references:

- <https://docs.github.com/en/search-github/searching-on-github/searching-for-repositories>
- <https://docs.github.com/en/rest/search/search>

## Ranking contract

Ranking must work without an LLM. A versioned deterministic score combines:

- explicit category/topic/language match;
- keyword matches by field;
- exclusion penalties;
- recency;
- source-specific signals such as repository stars/activity;
- explicit user feedback from saved/dismissed items only after a later design review.

Every ranked item stores a list of `MatchReason` records so the UI can explain its position. Model reranking is optional and never overwrites the deterministic score.

## Data model

Initial entities:

- `InterestProfile`
- `InterestRule`
- `SourceSubscription`
- `DiscoveryItem`
- `MatchReason`
- `InboxEntry`
- `RefreshRun`
- `ModelProfile` (non-secret metadata only)
- `AnalysisRequest`
- `AnalysisArtifact`

Stable external IDs are unique per `(source, external_id)`. Source snapshots carry a content hash so derived analysis can be marked stale.

## Agent contract

Read-only tools enabled by default:

- `list_today_items`
- `search_items`
- `get_item`
- `list_analysis_requests`
- `get_analysis_context`

Confirmation-gated write tools:

- `submit_analysis_result`
- `update_triage_state`

MCP support is documented by both Codex and Claude Code:

- <https://developers.openai.com/codex/mcp/>
- <https://docs.anthropic.com/en/docs/mcp>

## Model-provider contract

Initial protocols:

- OpenAI-compatible (including DeepSeek-compatible base URL/model selection)
- Anthropic-compatible

Provider metadata is stored in SQLite; secret material is encrypted through the OS-backed secret service. Analysis artifacts store provider profile ID, model, prompt version, input source hash, timestamp, usage when available, and status.

## Security and privacy

- Context isolation enabled; Node integration disabled in renderer.
- No remote HTML execution.
- Fixed arXiv and GitHub hosts for source adapters.
- Custom model endpoints validated by scheme/host rules.
- Network requests use explicit timeouts, response-size bounds, and safe redirects.
- SQL is parameterized.
- Secrets are never returned through ordinary read APIs.
- MCP write tools require an explicit opt-in plus exact confirmation argument.

## Failure and recovery

- Each source refresh records `running`, `succeeded`, `partial`, `no_results`, or `failed`.
- A failed refresh retains the last verified inbox and surfaces diagnostics.
- Database migrations are transactional and backed up before packaged-app upgrades.
- Model/agent failure does not block deterministic discovery.

## Update channels

1. **Development** — Vite/Electron hot reload; no app reinstall.
2. **Personal beta** — one command builds and replaces a separately identified `TheRSS Dev.app`, with database backup and smoke check.
3. **Public stable** — later Developer ID signing/notarization and same-identity updater verification.

Electron requires a signed macOS application for automatic updates: <https://www.electronjs.org/docs/latest/api/auto-updater/>

## Test strategy

- Unit: query construction, parsing, normalization, scoring, state transitions, URL/security validation.
- Integration: SQLite migrations/repositories, refresh orchestration with fixture HTTP, provider adapters with mock servers, MCP tool contract.
- UI: accessible filtering, match explanations, triage, settings validation, failure states.
- E2E: first-run interest setup -> refresh fixtures -> daily inbox -> selected-item analysis request.
- Opt-in smoke: bounded live arXiv and GitHub requests; never part of deterministic CI.

## Launch plan

- M0 design and governance.
- M1 deterministic discovery and Today view.
- M2 provider and agent analysis.
- M3 local package/update beta.
- M4 GitHub publication.

Each milestone must satisfy its test and documentation gates before the next is called complete.
