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
- in-app provider/model/prompt-version/source-hash provenance and evidence boundary.

Exit gate: secret, endpoint, mock-provider, read-only MCP, failure, and provenance tests pass. Stale-result detection remains later hardening.

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

## Deferred

- Official GitHub Trending HTML adapter.
- Learned recommendations.
- Zotero/llm-wiki promotion.
- Full-text search and stale-analysis detection.
- Source response caching/cooldown required before background refresh.
- Background helper while the app is closed.
- Signed/notarized public self-updates.
- Mobile and multi-user features.
