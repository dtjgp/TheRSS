# ADR 0004: Separate configured retrieval from Today/Discover ingestion

- Status: Accepted
- Date: 2026-08-19

## Context

The source directory now contains sources whose public endpoint or external command has been
validated, while the persisted Today and Discover domain still supports only arXiv papers and
GitHub repositories. Calling every validated endpoint an active Today source would overstate the
product behavior and would bypass the existing typed ranking and storage contracts.

## Decision

Add a `configured` acquisition state between `active` and the planning states.

- `active`: the adapter is wired into Today or Discover and its normalized items are persisted and
  ranked.
- `configured`: TheRSS owns a fixed, executable retrieval definition with bounded input/output and
  an explicit trust boundary, but the result is not yet part of Today or Discover.
- `rsshub_candidate`: a possible route exists but is not in the executable configuration registry.
- `adapter_required`: a source-specific adapter or credential workflow is still required.

The configured-source registry is code-owned, validates HTTPS/fixed hosts at startup, and supports
four transport families:

1. RSS/Atom or RSSHub feeds retrieved through the bounded HTTP reader.
2. Public landing responses retrieved as bounded untrusted HTML or JSON for later source-specific
   parsing.
3. Hugging Face public structured APIs for models, datasets, and daily papers.
4. X search through the local xapi CLI, always checking the action schema before calling it and
   never invoking through a shell.

OpenAlex is removed from the selected directory. ENTSO-E remains `adapter_required` until a user
token exists. GitHub remains `active`; an optional token is read in Electron main only.

## Consequences

- The directory can accurately show which routes are ready for executable probing without
  claiming they already influence the daily inbox.
- A later migration must define normalized item semantics, ranking, storage, source-run status,
  and UI filters before promoting a configured source to `active`.
- RSSHub endpoints are operational dependencies, not authoritative evidence. Result links and
  source identity must be retained so users can inspect the original publisher.
- Feed, page, API, and CLI output remain untrusted and must never be rendered as remote HTML.
