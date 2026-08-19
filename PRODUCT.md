# TheRSS Product Capability

## Capability

TheRSS enables a single research user to open one local application each day and receive a ranked, explainable inbox from 23 active research sources: arXiv, GitHub, fixed RSS/HTML routes, Hugging Face, and X through local xapi. Items match configured research topics and keywords while retaining typed provenance and per-source health. The user can also express a one-off research intent in natural language, ask a configured model, Codex, or Claude Code to expand it into an inspectable search plan, and let TheRSS execute that plan against arXiv and GitHub. Deeper item analysis retains model/tool provenance without copying secrets.

## User promise

- One daily inbox instead of separate paper, repository, feed, model-hub, and social-search routines.
- Every item shows its source, publication/update time, match reasons, and current processing state.
- Analysis is user initiated and records model/tool provenance. Typed paper records use a
  provisional, abstract-bounded adaptation of llm-wiki's L1 paper template and never present it as
  a verified full-paper deep read.
- Semantic expansion search exposes the executed terms and per-source outcome instead of presenting opaque model answers as search evidence.
- All operational state remains local; the current release exposes no account-login or synchronization surface.

## Fixed constraints

- Single-user and local-first for the initial release.
- arXiv abstracts, feed/article text, repository/model/dataset/post metadata, and model output are discovery/derived evidence.
- No plaintext API key is committed, logged, exported to llm-wiki, returned to the renderer/MCP, or stored in SQLite. Only OS-backed encrypted ciphertext may be persisted.
- External HTML and feed data are untrusted and must be parsed, bounded, and sanitized.
- User interests and ranking reasons are inspectable and editable.
- Agent writes and external exports require explicit confirmation.
- Account login and cross-device synchronization are deferred until the user explicitly reopens that product decision.
- The initial release must not depend on a paid Apple Developer Program membership.

## Current initial surfaces

1. **Today** — ranked daily inbox with dynamic source filters, per-source health, and match explanations.
2. **Saved** — one persisted shelf for saved research signals from every active source.
3. **Discover** — explicit semantic expansion search through the configured model provider, Codex CLI, or Claude Code; TheRSS executes the validated plan against arXiv/GitHub, keeps the session separate from Today, and lets the user filter the retrieved session to all records, papers, or GitHub repositories without rerunning the search.
4. **Interests** — arXiv categories, keywords, exclusions, GitHub languages and topics.
5. **Models & Agents** — one model provider profile, direct bounded Codex/Claude CLI analysis, plus documented read-only MCP setup.
6. **Data Analytics** — local daily result-volume reporting for Today and Discover plus a provenance-bearing ledger of deeply analyzed research signals.
7. **Sources** — a searchable 105-source research directory with priority, research-axis, provenance, and content/pending modes. The default mode exposes the 23 executable sources; 82 catalog-only entries remain under Pending integrations. Selecting most active sources opens an in-app rolling 30-day view. arXiv instead opens the newest available official daily batch without applying Interests. Source-only refresh does not change Today.

Dedicated full-item reading, operational diagnostics, source weighting, provider connection tests, and in-app update controls remain later surfaces. The current version refreshes from Today and performs local updates from the documented command line.

When an interest profile exists, Today automatically refreshes once on the first open of each local calendar day. Manual refresh remains available for retries; a failed automatic refresh preserves the last verified inbox.

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
- Duplicate URLs or sufficiently specific titles do not appear twice across active sources in the same inbox.
- A missing or failing model provider never prevents deterministic discovery.
- Discover rejects invalid model-generated plans before any source request, distinguishes complete, partial, empty, and failed outcomes, and does not add results to Today.
- Data Analytics distinguishes Today refresh volume from explicit Discover volume, derives deep-analysis history only from persisted artifacts, and does not fabricate Today history predating append-only tracking.
- The Sources directory contains 105 unique HTTPS entries (A=39, B=63, C=3) and visibly distinguishes 23 active adapters, 72 RSSHub candidates, and 10 sources requiring a new adapter.
- No live external service is required for automated tests.
- Release gates meet or exceed 80% line, statement, branch, and function coverage for owned code.

## Open product decisions

- Whether background refresh while the app is closed belongs in the first public beta.
- Whether the first user interface is a standalone desktop shell only or also exposes an Obsidian companion view.
- Whether repository trend scoring should include social velocity signals that require authenticated GitHub requests.

## Implementation status

The v0.1 initial version is implemented, installed, and published at <https://github.com/dtjgp/TheRSS>. Its local, remote-update, and CI evidence is tracked in `docs/REQUIREMENTS_TRACEABILITY.md`, `GOALS.md`, and `task_plan.md`.
