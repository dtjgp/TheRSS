# TheRSS Product Capability

## Capability

TheRSS enables a single research user to express a research question in natural language, ask a
configured model, Codex, or Claude Code to expand it into an inspectable plan, and search exactly 22
live-verified research sources through one Discover workflow. arXiv and GitHub execute bounded
source-specific queries; the 19 fixed RSS/HTML routes and Hugging Face return bounded recent
records that TheRSS filters and ranks locally against the same transient plan. Every result retains
typed provenance and an independent source outcome. Deeper item analysis retains model/tool
provenance without copying secrets.

## User promise

- One explicit Discover search instead of separate paper, repository, feed, and model-hub routines.
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
- The current Discover intent, selected sources, expanded terms, and ranking reasons are inspectable.
- Agent writes and external exports require explicit confirmation.
- Account login and cross-device synchronization are deferred until the user explicitly reopens that product decision.
- The initial release must not depend on a paid Apple Developer Program membership.

## Current initial surfaces

1. **Discover** — the primary semantic expansion search through the configured model provider,
   Codex CLI, or Claude Code. The user can search any subset of all 22 deployed sources, inspect the
   executed plan and each source outcome, and filter the persisted result session by record type
   without rerunning the model or adapters. Source selection is summarized until requested; after a
   run, ranked records precede a collapsed plan/provenance/source-outcome inspector.
2. **Saved** — one persisted shelf for explicitly retained research signals from every active source.
3. **Models & Agents** — one model provider profile, direct bounded Codex/Claude CLI analysis, plus documented read-only MCP setup.
4. **Data Analytics** — local Discover result-volume reporting, preserved historical Today volume, and a provenance-bearing ledger of deeply analyzed research signals.
5. **Sources** — a searchable directory containing only the 22 previously live-verified sources,
   with priority, research-axis, and provenance. Selecting a source opens an in-app rolling 30-day
   view; arXiv opens the newest available official daily batch. The larger raw catalog remains
   dormant versioned metadata and is not exposed or scheduled.

Dedicated full-item reading, operational diagnostics, source weighting, provider connection tests,
background refresh, and in-app update controls remain later surfaces. Legacy Interest profiles,
daily-inbox records, and Today analytics remain stored for compatibility but are not current
navigation surfaces or implicit launch actions.

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

- The complete intent-to-plan-to-results-to-Saved critical path works using deterministic fixtures and live opt-in sources.
- Every displayed item has a stable source identifier and at least one visible match reason.
- Duplicate URLs or sufficiently specific titles do not appear twice across active sources in the same inbox.
- A missing or failing configured model provider does not erase prior Discover sessions or Saved data; detected local Codex/Claude runners remain explicit alternatives.
- Discover rejects invalid model-generated plans before any source request, distinguishes complete,
  partial, empty, and failed outcomes per selected source, and never silently treats a browse-only
  source's unrelated recent records as semantic matches.
- Data Analytics retains historical Today refresh volume separately from explicit Discover volume,
  derives deep-analysis history only from persisted artifacts, and does not fabricate history.
- The Sources directory and Discover selector expose exactly 22 unique live-verified HTTPS sources
  (A=7, B=15, C=0); deferred catalog entries are absent from the product surface.
- No live external service is required for automated tests.
- Release gates meet or exceed 80% line, statement, branch, and function coverage for owned code.

## Open product decisions

- Whether a user should be able to save a Discover question as an optional recurring radar.
- Whether the first user interface is a standalone desktop shell only or also exposes an Obsidian companion view.
- Whether repository trend scoring should include social velocity signals that require authenticated GitHub requests.

## Implementation status

The v0.1 initial version is implemented, installed, and published at <https://github.com/dtjgp/TheRSS>. Its local, remote-update, and CI evidence is tracked in `docs/REQUIREMENTS_TRACEABILITY.md`, `GOALS.md`, and `task_plan.md`.
