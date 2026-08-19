# Capability: Active curated-source ingestion

## Capability

The single local TheRSS user can run one explicit Discover session against any subset of arXiv,
GitHub, and all 20 executable configured sources. The session stores normalized, semantically
matched records plus an independent terminal outcome for every selected source.

## Constraints

- Discover is a curated research-source search, not an arbitrary URL reader. Only code-owned fixed
  source definitions can run.
- `active` means an adapter crosses the complete retrieval, normalization, ranking, persistence, and
  UI boundary. Reachability alone is insufficient.
- Feed, HTML, JSON, and Hugging Face output is untrusted. It is bounded before parsing,
  converted to plain text, and never rendered as remote HTML.
- Source failures, partial normalization, verified no-results, and successful results remain
  distinct states. A failure must preserve the source's last verified local items.
- Stable source and item identifiers preserve triage, Saved, analysis provenance, and analytics
  history across upgrades.
- Optional secrets remain in Electron main. They are never written to
  SQLite as plaintext, sent to the renderer/MCP, logged, or embedded in the app.
- Deterministic automated tests use fixtures. Live retrieval is an explicit smoke gate.

## Implementation contract

### Actors and surfaces

- The user explicitly starts every Discover search; application launch makes no implicit request.
- Electron main owns network/process execution and passes a typed dashboard snapshot through preload.
- Discover, Saved, Data Analytics, Sources, and read-only MCP consume normalized local records.
- arXiv/GitHub perform specialized search; the other deployed sources fetch bounded recent batches
  and require a local deterministic semantic match before entering results.

### States and transitions

Each selected Discover source ends independently as:

`healthy | no_results | partial | failed`; unselected sources remain `not_searched`.

- `healthy`: a complete bounded response produced one or more normalized records.
- `no_results`: a complete bounded response produced zero valid records.
- `partial`: valid records were retained but one or more bounded entries were rejected.
- `failed`: retrieval or top-level validation failed; the last verified local edition is retained.

### Data and interfaces

- Source identity: `arxiv`, `github`, or stable `folo:<number>`.
- Item kinds: paper, repository, article, model, dataset, or post.
- Dashboard health and per-source counts are dynamic records keyed by source ID.
- A successful Discover session persists an immutable result snapshot; explicit Saved promotion
  retains item kind, source identity, and analysis compatibility.
- Cross-source deduplication is deterministic and provenance-safe; analytics continues to count
  returned source records rather than reconstructing unique discoveries.

### Migration and rollback

- Rebuild legacy Discover source/result tables that contain the two-source SQLite constraint and
  preserve the existing Today/source tables.
- Copy all rows and backfill source identity/item kind before enabling foreign keys again.
- Run `foreign_key_check` after migration.
- Personal-beta installation must create a database backup and retain the previous app for recovery.

## Non-goals

- Promoting any deferred raw-catalog candidate beyond the retained 22-source allowlist.
- Allowing arbitrary user-entered feed URLs.
- Full-web or complete-history search for browse-only sources.
- Treating feed summaries, HTML snippets, or model metadata as verified scientific evidence.
- Adding cloud accounts, synchronization, background refresh while closed, or paid API requirements.

## Open questions

- Source weights remain a later product decision. Discover defaults to all 22 retained sources and
  lets the user explicitly narrow the current session.
- HTML landing pages may legitimately return `no_results` when no dated structured entries are
  present; live smoke evidence decides whether a source needs a later source-specific extractor.

## Handoff

Implemented through the typed Discover, configured-source, SQLite, renderer, and fixture-E2E
boundaries. Deterministic and packaged verification are release gates; live model/source execution
remains explicit opt-in evidence and must not be inferred from fixtures.
