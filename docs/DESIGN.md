# TheRSS Initial Design

## Status

Accepted for initial implementation on 2026-08-15. Revisit if an executable spike contradicts a major assumption.

## Context

Research discovery is fragmented across arXiv queries, GitHub search, fixed research feeds, model
hubs, and ad hoc model conversations. TheRSS provides one explicit, explainable Discover workflow
while leaving durable literature/knowledge ownership to specialized tools.

## Goals

- Expand one natural-language research intent into bounded, inspectable retrieval terms.
- Optionally tailor expansion with one locally stored, bounded Personal Prompt while keeping the
  current question primary and explicit.
- Query arXiv and GitHub with source-specific terms from that transient plan.
- Fetch 19 fixed, code-owned RSS/Atom/HTML routes plus Hugging Face models, datasets, and papers.
- Filter and rank bounded recent records from browse-only sources against the same transient plan.
- Normalize all selected sources into one explainable Discover session with independent outcomes.
- Preserve triage state and analysis provenance locally.
- Allow user-configured model analysis and one shared agent interface.
- Present saved papers and repositories in one durable Saved view.
- Allow direct, user-initiated analysis through a locally authenticated Codex or Claude CLI.
- Execute natural-language research intents through a configured model or bounded local agent, then
  run the validated plan through TheRSS source adapters without model-controlled browsing.
- Show local Discover result volume, preserved historical Today volume, and the persisted
  deep-analysis ledger without introducing telemetry.
- Expose only the 22 sources that passed the live retrieval gate, with explicit priority, research-axis, and provenance.
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
       +-- Model provider adapters
       +-- MCP server / agent request queue
```

## Source strategy

### arXiv

- Use `export.arxiv.org/api/query` Atom results.
- Build queries from explicit category and keyword settings.
- Discover sends transient plan categories and keywords to arXiv. The Sources desk uses a separate
  bounded `submittedDate` day-range query. If arXiv has not yet formed a batch for the current UTC
  day, retry the nearest preceding non-empty day with three-second request spacing.
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

The raw source catalog is immutable, versioned application metadata under `src/shared`. It retains 105 historical candidates for recoverability, but an immutable 22-ID allowlist is the only catalog exported to the current product. Because catalog membership is not mutable operational state, it does not require a SQLite table or mutation IPC.

Every entry has a unique stable ID, priority, research axes, role, official URL, provenance, relevance reason, and one acquisition state:

- `active`: an executable TheRSS Today adapter exists; the exposed allowlist contains 22 sources;
- `rsshub_candidate`: a retained low-friction catalog candidate whose concrete route still requires verification and adapter work;
- `adapter_required`: an official source that requires a new dedicated integration.

The Sources renderer and Discover selector use only the same 22 retained sources, but neither can
start arbitrary network requests. Deferred records have no Pending surface and are not accepted by
Discover or source-only refresh. Source detail exposes bounded adapter errors rather than
presenting failed refreshes as empty content. Arbitrary user-entered feeds remain out of scope.

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

Discover is the primary explicit search surface. A configured model provider, Codex CLI, or Claude
Code receives the bounded natural-language intent plus the optional Personal Prompt and returns a
strict `discover-plan-v1` JSON object. The plan is schema-validated for bounded arXiv category
syntax, keywords, exclusions,
GitHub topics/languages, and query-count limits before any network request. The source selection is
separate validated user input. The model/agent does not browse, call tools, read project files, or
execute source requests.

The optional Personal Prompt is a singleton local setting (maximum 4,000 characters). A non-empty
saved value is included only in the selected model/Codex/Claude planning prompt; saving an empty
value disables it. The planner labels it as untrusted profile data, may use it only to tailor
terminology, priorities, and exclusions, and forbids it from changing selected sources, the JSON
contract, tool/file access, or evidence status. Source adapters receive only the validated generated
plan rather than direct access to the saved setting; the plan's search terms may reflect personal
context. Discover shows whether context is currently active, and each session provenance records
whether it was applied without automatically duplicating the saved prompt text.

The Discover orchestrator can run the accepted plan through any subset of the 22 retained source
adapters. arXiv and GitHub perform fixed-host parameterized queries. The other sources fetch only
their adapter-defined bounded recent batch; TheRSS then requires a deterministic semantic match
from the transient plan before including a record, so recency or popularity alone never turns an
unrelated feed entry into a Discover result. The orchestrator deduplicates and ranks returned
metadata, limits concurrency and the total result snapshot, and records `healthy`, `no_results`, or
`failed` per selected source while leaving unselected sources `not_searched`. The session status is
`completed`, `partial`, `no_results`, or `failed`. The renderer can filter the persisted snapshot by
record kind without rerunning the model or adapters. A saved result is promoted into the common
Saved shelf; no implicit daily inbox write occurs.

The renderer keeps the 22-source selector collapsed by default and reports the exact selected
count. While a bounded run is pending it shows an indeterminate phase rather than a fabricated
percentage. Ranked records are the first post-search content; the validated plan, provenance, and
per-source outcomes remain available in a collapsed details inspector.

## Data Analytics contract

Data Analytics is a read-only local operational surface. It aggregates the most recent seven local
calendar days while retaining lifetime summary counts and the latest 50 deep-analysis records.
Historical Today refresh volume remains separate from current Discover volume so removal of the
Today surface does not rewrite or fabricate past activity.

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
- `DiscoverPersonalizationSettings` (one optional local Personal Prompt)

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
Discover paper cards expose the same contract directly; an unsaved result is materialized as
`viewed` for stable artifact ownership without changing its Saved star.

## Confirmation-gated llm-wiki promotion

The paper-specific Analyze action above remains abstract-bounded and SQLite-owned. An eligible
`source === "arxiv" && kind === "paper"` record may separately enter `llm-wiki-promotion-v1` from
Discover or Saved. Discover supplies a bounded session ID so Electron main can materialize the
persisted source record before promotion; the renderer never supplies paper metadata or a vault
path.

Preparation resolves the configured vault root in Electron main, reads the live AGENTS/schema,
paper-ingest SOP, write-governance contract, runtime scope map, L1/L2 templates, and governed
indexes, then downloads and verifies the official arXiv PDF. `%PDF` magic, byte size, page count,
and SHA-256 must pass before analysis. Codex receives bounded extracted PDF text and live template
snapshots as untrusted content in an isolated temporary directory. It runs ephemerally with a
read-only sandbox and shell tooling disabled, returning only a strict L1/L2 note bundle. It never
writes the live vault.

The preview token is opaque, single-use, expires after 30 minutes, and binds the persisted source
hash plus live contract hash. Confirmation reloads the discovery row, reacquires/revalidates the
live contract, requires a sender-bound native confirmation, and obtains the cooperative
`therss-paper-promotion` writer lease. Electron main then applies only the validated PDF,
same-basename sidecar, one canonical L1/L2 note, 1–4 selected existing Topic/Method backlinks,
paper/root indexes, log, and audit record. Path traversal, symlinked ancestor chains, target
collisions, source/contract drift, malformed note bundles, and lease conflicts fail closed. New files
and exact mutable-file snapshots are rolled back on write/verifier failure; any unproven remainder is
reported as `partial` rather than success.

SQLite stores an append-only running/terminal receipt ledger with source/contract hashes, status,
evidence tier, exact relative paths, blockers, and timestamps. It stores no PDF text, note content,
Codex stderr, prompt, secret, or absolute vault path. MCP remains read-only; promotion is available
only through the explicit desktop UI. The current live runtime registration does not yet authorize
the required broad `Topics`/`Methods` lock scopes; live execution remains blocked until the vault
owner explicitly approves that persistent scope expansion.

Discover sessions persist the exact validated plan, runner/provider/model, prompt version, prompt-input hash, timestamps, per-source outcomes, and result snapshots. Generated plan text remains derived evidence; only validated fields reach source adapters.

## Security and privacy

- Context isolation enabled; Node integration disabled in renderer.
- No remote HTML execution.
- Fixed, credential-free HTTPS endpoints for HTTP source adapters; Hugging Face and GitHub tokens remain optional main-process environment inputs.
- Custom model endpoints validated by scheme/host rules.
- Network requests use explicit timeouts, response-size bounds, and safe redirects.
- SQL is parameterized.
- Secrets are never returned through ordinary read APIs.
- Personal Prompt text is not a credential: it is stored as bounded local operational data, never
  logged, and sent in full only to the selected planner after an explicit Discover action. Source
  sites receive the generated search terms, which may reflect that context; the UI therefore warns
  against entering secrets or confidential unpublished details.
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
- E2E: open directly to Discover -> expand and verify the 22-source selector -> execute deterministic
  arXiv/GitHub/configured-source fixtures -> filter and save a configured-source result -> verify
  result-first ordering and the collapsed search-details inspector -> preview/cancel/confirm the
  fixture-only llm-wiki paper promotion -> verify Saved triage -> inspect Sources and separated
  Discover/legacy-Today analytics.
- Opt-in smoke: bounded live requests for the retained active sources. Live smoke is never part of deterministic CI.

## Launch plan

- M0 design and governance.
- M1 deterministic discovery and Today view.
- M2 provider and agent analysis.
- M3 local package/update beta.
- M4 GitHub publication.

Each milestone must satisfy its test and documentation gates before the next is called complete.
