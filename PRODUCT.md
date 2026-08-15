# TheRSS Product Capability

## Capability

TheRSS enables a single research user to open one local application each day and receive a ranked, explainable inbox of new arXiv papers and GitHub repositories that match configured research topics, keywords, and prior triage signals. The user can inspect the source, decide what matters, and invoke a configured model, Codex, Claude Code, or a DeepSeek harness for deeper analysis without copying secrets or losing provenance.

## User promise

- One daily inbox instead of separate arXiv, GitHub, and ad hoc search routines.
- Every item shows its source, publication/update time, match reasons, and current processing state.
- Analysis is user initiated and records model/tool provenance.
- Local data remains usable without a cloud account.

## Fixed constraints

- Single-user and local-first for the initial release.
- arXiv abstracts, feed content, GitHub metadata, and model output are discovery/derived evidence.
- No API key is committed, logged, exported to llm-wiki, or stored in the ordinary SQLite database.
- External HTML and feed data are untrusted and must be parsed, bounded, and sanitized.
- User interests and ranking reasons are inspectable and editable.
- Agent writes and external exports require explicit confirmation.
- The initial release must not depend on a paid Apple Developer Program membership.

## Primary surfaces

1. **Today** — ranked daily inbox with paper/repository filters and match explanations.
2. **Discover** — manual refresh, source health, and broader search.
3. **Interests** — arXiv categories, keywords, exclusions, GitHub languages/topics, and weights.
4. **Item detail** — source metadata, abstract/README summary, analysis artifacts, and handoff actions.
5. **Models & Agents** — provider profiles, connection tests, task routing, and agent availability.
6. **Diagnostics & Updates** — fetch history, failures, version, migrations, and local update controls.

## Lifecycle

`new -> matched -> ranked -> viewed -> saved | dismissed | analysis_requested -> analyzed`

Paper promotion to a knowledge system is a separate, confirmation-gated workflow.

## Non-goals for the initial release

- Replacing Zotero or Obsidian.
- Multi-user accounts, cloud sync, or social recommendations.
- Autonomous scientific claim generation.
- A general-purpose news reader.
- Mobile clients.
- Opaque vector-only ranking.
- Production-grade unsigned macOS self-replacement updates.

## Initial success metrics

- The complete refresh-to-triage critical path works using deterministic fixtures and live opt-in sources.
- Every displayed item has a stable source identifier and at least one visible match reason.
- Duplicate arXiv/GitHub items do not appear twice in the same inbox.
- A missing or failing model provider never prevents deterministic discovery.
- No live external service is required for automated tests.
- Release gates meet or exceed 80% line, statement, branch, and function coverage for owned code.

## Open product decisions

- Whether background refresh while the app is closed belongs in the first public beta.
- Whether the first user interface is a standalone desktop shell only or also exposes an Obsidian companion view.
- Whether repository trend scoring should include social velocity signals that require authenticated GitHub requests.

## Handoff

The capability is ready for architecture review. The next artifact must resolve source adapters, storage, ranking, agent interfaces, secret storage, desktop shell, testing, and update channels before feature implementation.
