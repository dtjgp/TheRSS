# TheRSS Roadmap

## M0 — Foundation

Deliverables:

- product capability;
- engineering rules and goal contract;
- architecture design and ADR;
- requirements traceability;
- security and release boundaries.

Exit gate: documents are mutually consistent and every founding requirement has an implementation/verifier path.

## M1 — Daily discovery loop

Deliverables:

- first-run interest configuration;
- arXiv query/feed adapter;
- GitHub Interest Radar adapter;
- normalization, deduplication, deterministic ranking, and match reasons;
- SQLite persistence and Today UI;
- once-per-local-day startup refresh with last-good-inbox fallback;
- triage states and persisted source health.

Exit gate: fixture-driven critical E2E and >=80% owned-code coverage.

## M2 — Analysis loop

Deliverables:

- provider profile management;
- encrypted secret storage;
- OpenAI-compatible/DeepSeek and Anthropic adapters;
- direct, user-initiated analysis artifact lifecycle;
- MCP server for Codex and Claude Code;
- dedicated Saved shelf plus bounded direct Codex/Claude CLI analysis;
- bounded semantic Discover planning through a configured model, Codex, or Claude, with TheRSS-controlled arXiv/GitHub retrieval and separate session persistence;
- in-app provider/model/prompt-version/source-hash provenance and evidence boundary.
- local Data Analytics with separated Today/Discover result volume and deep-analysis provenance history.
- searchable built-in directory exposing only the 22 sources retained by the dated deployment
  verification; current recorded health is separate, and dormant raw-catalog entries do not enter
  Sources, Today, or Discover.

Exit gate: secret, endpoint, mock-provider, read-only MCP, Discover plan/isolation/failure, analytics aggregation, and provenance tests pass. Stale-result detection remains later hardening.

## M3 — Personal beta

Deliverables:

- local packaged app;
- hot reload and one-command developer setup;
- separately named installed beta (`TheRSS Dev.app`) using the durable TheRSS data directory;
- backup, migration, install/update, and rollback script;
- documented verification and recovery checklist.

Exit gate: package launches, critical smoke passes, and a test update preserves user data.

## M4 — GitHub initial publication

Deliverables:

- CI workflow;
- documented setup and screenshots;
- security/release documentation;
- GitHub repository and verified remote commit.

Exit gate: pushed commit exists remotely and CI reports the required checks.

Status: complete on 2026-08-15. The public repository, matching remote commit, passing initial CI run, and real-remote local update were verified.

## M5 — Discover-centered retrieval

Deliverables:

- Discover as the default and only user-facing acquisition surface;
- exact 22-source selection derived from the retained registry;
- bounded arXiv/GitHub search plus deterministic semantic filtering for browse-only adapters;
- dynamic per-source outcomes and configured-source result-kind persistence;
- removal of Today/Interests navigation and automatic Interest-driven startup refresh while
  retaining historical SQLite data and analytics.

Exit gate: shared/core/storage/renderer tests, full quality gate, Electron E2E, rendered inspection,
and package smoke pass; live source/model execution remains an explicit opt-in verifier.

## Deferred

The 83 dormant `sourceCatalogData.json` entries are triaged in
[SOURCE_CATALOG_BACKLOG.md](SOURCE_CATALOG_BACKLOG.md): they reduce to one RSSHub
adopt-or-drop decision covering 72 entries, plus 11 individually scoped adapters.

- Account login and cross-device synchronization. The experimental Google Drive implementation was withdrawn on 2026-08-16; the current product contains no login or Sync surface.
- Official GitHub Trending HTML adapter.
- Learned recommendations.
- Zotero/llm-wiki promotion.
- Full-text search and stale-analysis detection.
- Source response caching/cooldown required before background refresh.
- Background helper while the app is closed.
- Signed/notarized public self-updates.
- Mobile and multi-user features.
