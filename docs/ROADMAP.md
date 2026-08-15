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
- triage states and refresh diagnostics.

Exit gate: fixture-driven critical E2E and >=80% owned-code coverage.

## M2 — Analysis loop

Deliverables:

- provider profile management;
- encrypted secret storage;
- OpenAI-compatible/DeepSeek and Anthropic adapters;
- analysis request/artifact lifecycle;
- MCP server for Codex and Claude Code;
- in-app provenance and stale-result display.

Exit gate: secret, endpoint, mock-provider, MCP, failure, and provenance tests pass.

## M3 — Personal beta

Deliverables:

- local packaged app;
- hot reload and one-command developer setup;
- separate dev bundle/data identity;
- backup, migration, install/update, and rollback script;
- diagnostics and release checklist.

Exit gate: package launches, critical smoke passes, and a test update preserves user data.

## M4 — GitHub initial publication

Deliverables:

- CI workflow;
- documented setup and screenshots;
- security/release documentation;
- GitHub repository and verified remote commit.

Exit gate: pushed commit exists remotely and CI reports the required checks.

## Deferred

- Official GitHub Trending HTML adapter.
- Learned recommendations.
- Zotero/llm-wiki promotion.
- Background helper while the app is closed.
- Signed/notarized public self-updates.
- Mobile and multi-user features.
