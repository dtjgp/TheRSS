# TheRSS Initial Design

## Status

Accepted for initial implementation on 2026-08-15. Revisit if an executable spike contradicts a major assumption.

## Context

Research discovery is fragmented across arXiv queries, category feeds, GitHub search/trending pages, and ad hoc model conversations. TheRSS provides one daily operational inbox while leaving durable literature/knowledge ownership to specialized tools.

## Goals

- Fetch recent arXiv papers and GitHub repositories from user-defined interests.
- Fetch fixed, code-owned RSS/Atom/HTML routes, Hugging Face models/datasets/papers, and X posts through local xapi.
- Normalize all active sources into one explainable daily ranking with independent health states.
- Preserve triage state and analysis provenance locally.
- Allow user-configured model analysis and one shared agent interface.
- Present saved papers and repositories in one durable Saved view.
- Allow direct, user-initiated analysis through a locally authenticated Codex or Claude CLI.
- Expand one-off natural-language research intents through a configured model or bounded local agent, then execute the validated plan through TheRSS source adapters.
- Show local daily Today/Discover result volume and the persisted deep-analysis ledger without introducing telemetry.
- Expose the selected 106-source research directory with explicit priority, research-axis, provenance, and acquisition capability.
- Make personal development updates fast without requiring paid Apple signing.

## Non-goals

See `PRODUCT.md`. In particular: no general news reader, cloud account system, autonomous scientific claims, or Obsidian/Zotero replacement.

## Chosen stack

| Layer           | Choice                                | Rationale                                                                                |
| --------------- | ------------------------------------- | ---------------------------------------------------------------------------------------- |
| Desktop         | Electron                              | Mature local Node integration, packaging, MCP process support, and rapid renderer reload |
| UI              | React + TypeScript + Vite             | Typed, testable, fast iteration                                                          |
| Storage         | SQLite                                | Local durability, transactions, explainable queries, no server                           |
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
       +-- Discover planner / orchestrator
       +-- Ranking service
       +-- Analysis service
       +-- Local analytics aggregation
       +-- Diagnostics/update service (later)
       |
       +-- SQLite repositories
       +-- Encrypted secret store
       +-- arXiv adapter
       +-- GitHub radar adapter
       +-- fixed RSS/Atom and HTML adapters
       +-- Hugging Face API adapter
       +-- local xapi adapter
       +-- Model provider adapters
       +-- MCP server / agent request queue
```

## Source strategy

### arXiv

- Use `export.arxiv.org/api/query` Atom results.
- Build queries from explicit category and keyword settings.
- Keep Today and Discover interest-derived. The Sources desk uses a separate bounded
  `submittedDate` day-range query, never user keywords. If arXiv has not yet formed a batch for the
  current UTC day, retry the nearest preceding non-empty day with three-second request spacing.
- Sort by submitted or updated date descending.
- The initial client sends one bounded combined query on the first eligible app open per local day or on explicit manual refresh; cross-request caching/cooldown remains required before background refresh.
- Retain arXiv ID/version, title, authors, abstract, categories, published/updated timestamps, and abstract URL. DOI/journal reference and PDF URL enrichment are deferred.
- Never claim the abstract verifies full-paper methods or results.

Official reference: <https://info.arxiv.org/help/api/user-manual.html>

### GitHub Interest Radar

GitHub does not expose a stable official API for the website's Trending ranking. The initial version therefore implements an explicitly named Interest Radar using official repository search:

- keyword matches in name, description, topics, and optionally README metadata;
- `topic`, `language`, `created`, `pushed`, `stars`, `archived:false`, and `fork:false` qualifiers;
- unauthenticated public search in the initial UI; the core adapter accepts an optional token, but credential settings are deferred;
- visible scoring inputs: interest match, recency, stars, and activity;
- no claim that the result reproduces GitHub Trending.

Official references:

- <https://docs.github.com/en/search-github/searching-on-github/searching-for-repositories>
- <https://docs.github.com/en/rest/search/search>

### Built-in source catalog

The source catalog is immutable, versioned application metadata under `src/shared`. It contains all 105 selected sources and is rendered directly as bounded plain text plus HTTPS links. Because catalog membership is not mutable operational state, it does not require a SQLite table or mutation IPC.

Every entry has a unique stable ID, priority, research axes, role, official URL, provenance, relevance reason, and one acquisition state:

- `active`: an executable TheRSS Today adapter exists; currently 23 sources;
- `rsshub_candidate`: a retained low-friction catalog candidate whose concrete route still requires verification and adapter work;
- `adapter_required`: an official source that requires a new dedicated integration.

The Sources renderer can search and filter the directory, but it cannot start arbitrary network requests. It defaults to the 23 code-owned content sources and moves the remaining 82 catalog-only records under Pending integrations. Source detail exposes bounded adapter errors rather than presenting failed refreshes as empty content. Today accepts the 23 code-owned active source identities; Discover intentionally retains its strict `arxiv | github` union. Arbitrary user-entered feeds remain out of scope.

Four sources require explicit normalizers beyond the generic feed path:

- NBER reads its official new-working-paper RSS and enriches each fixed-origin paper with official
  publication-date metadata.
- McKinsey uses the official Insights RSS directly.
- Nikkei Asia reads the official RSS and enriches fixed-origin articles with page date metadata.
- NCPSD retries the official desktop endpoint, then a fixed mobile fallback, and parses only the
  latest-literature list into bounded paper metadata without executing page JavaScript.

## Ranking contract

Ranking must work without an LLM. A versioned deterministic score combines:

- explicit category/topic/language match;
- keyword matches by field;
- exclusion penalties;
- recency;
- source-specific signals such as repository stars/activity;
- explicit user feedback from saved/dismissed items only after a later design review.

Every ranked item stores a list of `MatchReason` records so the UI can explain its position. Model reranking is optional and never overwrites the deterministic score.

## Semantic Discover contract

Discover is an explicit, one-off search surface and is not another view of the daily inbox. A configured model provider, Codex CLI, or Claude Code receives only the bounded natural-language intent and returns a strict `discover-plan-v1` JSON object. The plan is schema-validated for bounded arXiv category syntax, keywords, GitHub topics/languages, and query-count limits before any network request. The model/agent does not browse, call tools, read project files, or execute source requests.

The Discover orchestrator runs the accepted plan through the existing fixed-host arXiv and GitHub adapters, deduplicates and deterministically ranks the returned metadata, and records `healthy`, `no_results`, or `failed` per source. The session status is `completed`, `partial`, `no_results`, or `failed`. The renderer can locally filter the persisted result snapshot to all records, arXiv papers, or GitHub repositories without rerunning the model or source adapters. A saved Discover result is promoted into the common Saved shelf but remains excluded from Today unless a later daily refresh independently discovers it.

## Data Analytics contract

Data Analytics is a read-only local operational surface. It aggregates the most recent seven local calendar days while retaining lifetime summary counts and the latest 50 deep-analysis records. Today refresh and semantic Discover result volume remain separate because the former maintains the deterministic inbox and the latter is an explicit one-off search.

Search volume means returned result records, not unique newly discovered papers or repositories. Repeating a refresh may therefore count the same source record again. `SourceSearchEvent` appends only terminal Today source outcomes from this version onward; the previous `SourceRun` table retains only the latest state, so the app must not infer or backfill older Today history. Persisted Discover sessions remain directly countable. Deep-analysis totals and item history derive only from `AnalysisArtifact` joined to the corresponding `DiscoveryItem`, retaining source, title, provider/runner, model, and timestamp.

The renderer receives one typed aggregate through preload IPC. It has no direct SQLite access, analytics SDK, remote telemetry endpoint, or secret-bearing fields.

## Data model

Initial persisted entities:

- `InterestProfile`
- `DiscoveryItem`
- `SourceRun`
- `SourceSearchEvent` (append-only terminal Today result volume from the analytics release onward)
- `ModelProvider` (metadata plus OS-encrypted credential ciphertext)
- `AnalysisArtifact`
- `DiscoverSession`, `DiscoverSourceRun`, and `DiscoverResult`

Stable item IDs are derived from source identity. Every model analysis stores a SHA-256 hash of the exact discovery fields included in its prompt; automatic stale-analysis labeling is deferred.

## Agent contract

Read-only tools enabled by default:

- `list_today_items`
- `get_item`
- `get_analysis_context`

The initial server intentionally exposes no write tools. Confirmation-gated analysis submission, triage changes, and knowledge-system exports require a later design review.

The in-app local-agent path is separate from MCP. It creates a fresh bounded non-interactive Codex or Claude process for one discovery item, provides only the discovery prompt over stdin, and persists the returned artifact. It never attaches to an existing conversation or grants the renderer process access.

MCP support is documented by both Codex and Claude Code:

- <https://developers.openai.com/codex/mcp/>
- <https://docs.anthropic.com/en/docs/mcp>

## Model-provider contract

Initial protocols:

- OpenAI-compatible (including DeepSeek-compatible base URL/model selection)
- Anthropic-compatible

Provider metadata and encrypted credential ciphertext are stored in SQLite; plaintext encryption/decryption occurs only in Electron main through the OS-backed secret service. Analysis artifacts store provider profile ID/name, model, prompt version, source-snapshot hash, content, timestamp, and token usage internally. Stale state and request status are deferred.

Analysis prompt selection follows normalized item kind. `paper` records use the versioned
`llm-wiki-paper-l1-v1` contract and render their result directly after the discovery summary; every
other kind retains `discovery-analysis-v1`. The paper contract is a packaged adaptation of the live
llm-wiki `Paper_Note_L1` structure, not runtime vault access. Because the input remains discovery
metadata, the output must state `abstract-only / provisional`, retain `[TBD]` for unavailable facts,
and must not be described as a verified full-paper L1 deep read. Analysis remains user initiated.

Discover sessions persist the exact validated plan, runner/provider/model, prompt version, prompt-input hash, timestamps, per-source outcomes, and result snapshots. Generated plan text remains derived evidence; only validated fields reach source adapters.

## Security and privacy

- Context isolation enabled; Node integration disabled in renderer.
- No remote HTML execution.
- Fixed, credential-free HTTPS endpoints for HTTP source adapters; Hugging Face and GitHub tokens remain optional main-process environment inputs, while X uses local xapi.
- Custom model endpoints validated by scheme/host rules.
- Network requests use explicit timeouts, response-size bounds, and safe redirects.
- SQL is parameterized.
- Secrets are never returned through ordinary read APIs.
- The initial MCP surface is structurally read-only and opens SQLite in read-only mode.

## Failure and recovery

- Each configured source refresh records `refreshing`, `healthy`, explicit `no_results`, or `failed`; mixed source outcomes therefore remain distinguishable.
- Each terminal Today source run also appends a bounded result-count event for local analytics; interrupted `refreshing` states never become analytics events.
- A failed refresh retains the last verified inbox and surfaces diagnostics.
- An interrupted `refreshing` record is not counted as the day's completed attempt, so the next app open retries it.
- Database migrations are transactional and backed up before packaged-app upgrades.
- Model/agent failure does not block deterministic discovery.

## Update channels

1. **Development** — Vite/Electron hot reload; no app reinstall.
2. **Personal beta** — one command builds and replaces a separately identified `TheRSS Dev.app`, with database backup and smoke check.
3. **Public stable** — later Developer ID signing/notarization and same-identity updater verification.

Electron requires a signed macOS application for automatic updates: <https://www.electronjs.org/docs/latest/api/auto-updater/>

## Test strategy

- Unit: query construction, parsing, normalization, scoring, state transitions, URL/security validation.
- Integration: SQLite migrations/repositories, analytics aggregation, refresh orchestration with fixture HTTP, provider adapters with mock servers, MCP tool contract.
- UI: accessible filtering, match explanations, triage, settings validation, Data Analytics tables/history, failure states.
- E2E: first-run interest setup -> reopen -> automatic daily fixture refresh -> inbox -> analysis -> Saved -> local Codex analysis -> semantic Discover -> save result -> verify Saved promotion and Today isolation -> inspect Data Analytics counts and provenance.
- Opt-in smoke: bounded live active-source requests; X remains explicitly opt-in because xapi retrieval may be metered. Live smoke is never part of deterministic CI.

## Launch plan

- M0 design and governance.
- M1 deterministic discovery and Today view.
- M2 provider and agent analysis.
- M3 local package/update beta.
- M4 GitHub publication.

Each milestone must satisfy its test and documentation gates before the next is called complete.
