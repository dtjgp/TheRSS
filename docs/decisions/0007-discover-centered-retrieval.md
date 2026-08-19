# ADR 0007: Discover-centered retrieval across deployed sources

## Status

Accepted for implementation on 2026-08-19.

## Context

The user-facing Today, Interests, and Discover surfaces represented two different acquisition
models but repeated the same practical goal: finding current research signals. Meanwhile, the
retained product registry had grown to 22 live-verified sources while Discover remained hard-coded
to arXiv and GitHub.

## Decision

Discover becomes the only user-facing acquisition workflow and the default application surface.
Today and Interests leave navigation and native menus; their SQLite records remain intact for
history and compatibility. Saved, Models & Agents, Data Analytics, and Sources remain.

The Discover source selector is derived from the exact retained 22-source registry:

- arXiv and GitHub are search-capable adapters. They receive validated source-specific fields from
  the transient model/agent plan.
- Hugging Face and the 19 fixed RSS/HTML sources are browse-then-filter adapters. They return only a
  bounded adapter-defined recent batch, after which TheRSS requires a deterministic semantic match
  from the same plan before including a record.

The model or local agent never chooses arbitrary URLs, browses, invokes tools, or executes source
requests. TheRSS validates the plan and selected source IDs, owns concurrency, retrieval,
deduplication, ranking, per-source outcomes, persistence, and the global result limit.

## Invariants

- Dormant raw-catalog entries, Pending integrations, and X are not accepted by Discover.
- A browse-only record is not relevant merely because it is recent or popular.
- One source failure does not erase successful source results.
- `no_results`, `failed`, `partial`, and `completed` remain distinct.
- Discover results enter Saved only through an explicit user action.
- Migration removes obsolete two-source SQLite constraints without deleting legacy Interest,
  Today, Saved, analytics, or analysis data.

## Consequences

Searching all 22 sources is broader than the former two-source Discover flow, but it is not a claim
of full-web or complete-history search. Its coverage is the union of arXiv/GitHub queries and each
browse-only adapter's bounded recent window. Starting a search may make up to 22 controlled source
requests, so concurrency and timeouts remain bounded and the UI exposes the actual per-source
outcomes.
