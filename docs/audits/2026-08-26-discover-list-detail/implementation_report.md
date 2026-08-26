# Implementation Report: Discover list-detail workspace

Status: complete; the originally named Shell zoom residual was closed by the follow-up
`2026-08-26-zoom-sidebar-shape` slice.

## Outcome

Discover now uses a Saved-style resizable list-detail workspace. Compact rows support scanning and
roving Arrow-key selection; one persistent detail pane owns the full summary, match reasons, Saved
star, paper-only analysis, llm-wiki promotion, and typed native context menu. Filters, 24-result
progressive reveal, Search details, source outcomes, provenance, and evidence boundaries retain
their prior semantics.

## Scope

- Renderer-only presentation and transient selection state.
- No retrieval, ranking, persistence, API, IPC, SQLite, adapter, provider, credential, package, or
  update change.
- No new dependency or external component library.

## Verification

- Focused: 5 files / 63 tests passed.
- Full: `npm run check` passed 57 files / 382 tests; coverage remains above the 80% floor in all
  dimensions.
- Electron: 2/2 E2E passed outside the restricted macOS sandbox.
- Rendered: wide, 820 px, dark, forced-colors, filtered Other, Saved toggle, and Saved regression
  images accepted.
- Review: `git diff --check`, architecture size, boundary diff, and scoped secret/debug checks passed.

## Resolved follow-up

The follow-up slice proved Electron zoom reduces the renderer viewport width already tracked by
`App`. The Shell now derives an effective compact state below 760 px without overwriting the user's
manual preference or stored width. A 200% zoom/reset Electron path verifies automatic compaction and
restoration. The same slice unified the annotated navigation/result-filter radius.

## External state

No commit, install, push, publication, live provider/source request, or real llm-wiki write was
performed.
