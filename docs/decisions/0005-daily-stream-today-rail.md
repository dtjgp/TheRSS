# ADR 0005: Derive the Daily Stream from the current Today edition

- Status: Accepted
- Date: 2026-08-19

## Context

Today already stores a bounded daily inbox of ranked arXiv papers and GitHub repositories. The
main workspace optimizes for reading one item at a time, so it does not provide a persistent visual
overview of the whole edition. The source directory also contains configured retrieval routes that
have not been normalized, ranked, or persisted into Today.

## Decision

Add a compact `Daily Stream` rail beside the Today list-detail workspace.

- The rail is derived only from `DashboardSnapshot.items`; it does not add a database, IPC call,
  refresh path, or second source of truth.
- “Returned” means present in the current Today edition. It does not mean uniquely published on the
  dashboard date, and items are not excluded when their source publication timestamp is older.
- Entries are ordered by source publication timestamp and show source, state, and title. Summary
  counts use the exact returned records in the edition.
- The rail always summarizes all Today sources, even when the main workspace is filtered. Opening a
  stream entry restores the all-source workspace, selects the entry, and applies the same passive
  unread-to-viewed transition as selecting it from the main list.
- Saved and Discover remain separate product views. Configured-only routes remain excluded until
  their results cross the typed Today ingestion boundary.

## Consequences

- A user can scan the complete daily edition without losing the focused reading workspace.
- Selection state is owned by the Today view and synchronized between the main list and stream.
- The rail reflects persisted local data and remains available offline after a successful refresh.
- When more source types become active, the shared dashboard item contract and stream presentation
  must be extended together; a configured retrieval route alone is insufficient.
