# ADR 0006: Generalize Today around stable source identities

- Status: Accepted
- Date: 2026-08-19

## Context

The configured-source registry can retrieve 21 curated sources, but Today, SQLite, analytics, and the
renderer still encode a closed `arxiv | github` union. Treating raw retrieval as active would lose
normalization, ranking, failure-state, and provenance guarantees.

## Decision

- Generalize Today source identity to `arxiv`, `github`, or `folo:<number>` and add an explicit item
  kind.
- Keep semantic Discover's arXiv/GitHub contract unchanged.
- Migrate legacy Today tables transactionally, preserving item IDs and all dependent analysis data.
- A successful or verified-empty source run atomically replaces that source's daily membership; a
  failed run preserves its prior verified membership.
- Execute configured sources with bounded concurrency through transport-specific adapters. All
  normalized text is plain and bounded, all links are HTTPS, and no remote HTML reaches the renderer.
- Use dynamic source-health/count records and a compact source selector rather than adding 23 toolbar
  buttons.

## Consequences

- The same ranking, triage, Saved, analysis, analytics, and MCP paths can consume every active source.
- Existing local databases require a checked migration and package-level backup.
- Source-specific HTML extraction may still yield honest `no_results`; it must not synthesize dates
  or article records.
- The remaining candidate/adapter-required catalog entries do not become active through this ADR.
