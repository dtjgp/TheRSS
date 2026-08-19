# Capability: Active curated-source ingestion

## Capability

The single local TheRSS user can refresh Today once and receive one persisted, explainable edition
containing normalized records from arXiv, GitHub, and all 21 executable configured sources. Each
source reports an independent terminal outcome, and the user can scan or filter the resulting
records by their real source identity.

## Constraints

- Today remains a curated research-source inbox, not an arbitrary URL reader. Only code-owned fixed
  source definitions can run.
- `active` means an adapter crosses the complete retrieval, normalization, ranking, persistence, and
  UI boundary. Reachability alone is insufficient.
- Feed, HTML, JSON, Hugging Face, and xapi output is untrusted. It is bounded before parsing,
  converted to plain text, and never rendered as remote HTML.
- Source failures, partial normalization, verified no-results, and successful results remain
  distinct states. A failure must preserve the source's last verified local items.
- Stable source and item identifiers preserve triage, Saved, analysis provenance, and analytics
  history across upgrades.
- Secrets remain in Electron main or the external xapi credential store. They are never written to
  SQLite as plaintext, sent to the renderer/MCP, logged, or embedded in the app.
- Deterministic automated tests use fixtures. Live retrieval is an explicit smoke gate.

## Implementation contract

### Actors and surfaces

- The user triggers manual refresh or the once-per-local-day startup refresh.
- Electron main owns network/process execution and passes a typed dashboard snapshot through preload.
- Today, Saved, Daily Stream, Data Analytics, and read-only MCP consume normalized local records.
- Discover retains its current arXiv/GitHub plan and execution contract.

### States and transitions

Each enabled source transitions independently:

`idle -> refreshing -> healthy | no_results | partial | failed`

- `healthy`: a complete bounded response produced one or more normalized records.
- `no_results`: a complete bounded response produced zero valid records.
- `partial`: valid records were retained but one or more bounded entries were rejected.
- `failed`: retrieval or top-level validation failed; the last verified local edition is retained.

### Data and interfaces

- Source identity: `arxiv`, `github`, or stable `folo:<number>`.
- Item kinds: paper, repository, article, model, dataset, or post.
- Dashboard health and per-source counts are dynamic records keyed by source ID.
- A successful source refresh atomically replaces that source's daily membership while retaining
  Saved items and analysis artifacts.
- Cross-source deduplication is deterministic and provenance-safe; analytics continues to count
  returned source records rather than reconstructing unique discoveries.

### Migration and rollback

- Rebuild only legacy Today tables that contain the two-source SQLite constraint.
- Copy all rows and backfill source identity/item kind before enabling foreign keys again.
- Run `foreign_key_check` after migration.
- Personal-beta installation must create a database backup and retain the previous app for recovery.

## Non-goals

- Promoting the remaining 72 RSSHub candidates or 10 adapter-required sources.
- Allowing arbitrary user-entered feed URLs.
- Expanding semantic Discover beyond arXiv/GitHub in this migration.
- Treating feed summaries, HTML snippets, posts, or model metadata as verified scientific evidence.
- Adding cloud accounts, synchronization, background refresh while closed, or paid API requirements.

## Open questions

- Per-source enable/disable controls and source weights remain later product decisions. This release
  enables the fixed 21-source set by default.
- HTML landing pages may legitimately return `no_results` when no dated structured entries are
  present; live smoke evidence decides whether a source needs a later source-specific extractor.

## Handoff

Ready for direct implementation through TDD, followed by live-source, packaged-app, and installed-app
verification.
