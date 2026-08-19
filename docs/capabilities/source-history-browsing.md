# Capability: In-app source history browsing

## Capability

The local TheRSS user can select any entry in Sources and remain inside the application while
inspecting source-provided titles, summaries, kinds, and timestamps. Most active sources use a
rolling previous 30-day local window. arXiv instead shows the newest available official daily batch
without applying the user's Interests. Catalog-only sources expose their integration state and
official website without implying that content retrieval exists.

## Constraints

- The 30-day window includes locally indexed records whose publication or update timestamp is inside
  the rolling window. It is not a guarantee that an upstream feed exposes a complete 30-day archive.
- Source detail renders bounded plain text already normalized by TheRSS. It never embeds or executes
  remote HTML.
- Opening an active source reads the local index first. When the local window is empty, non-metered
  configured sources may run one automatic source-only refresh.
- X retrieval is never automatic because xapi calls may consume balance. It requires an explicit
  user action and an interest profile that can produce a bounded search query.
- GitHub and X source-only refreshes require an interest profile because their retrieval queries are
  interest-derived. The arXiv Sources desk is intentionally independent of Interests: it queries a
  bounded official `submittedDate` day range and falls back, with spacing, to the most recent
  non-empty daily batch.
- Source-only browsing writes source history without changing Today membership, Today health, or
  append-only Today analytics.
- Failed source-only refreshes preserve and continue to show previously indexed records. The detail
  view presents the bounded adapter error instead of relabeling a failure as an empty source.
- The directory opens on the 23 content sources. The other 82 entries are grouped under Pending
  integrations so catalog membership is not mistaken for readable in-app content.

## Implementation contract

- Renderer calls typed preload methods with a validated active `DiscoverySource` identifier.
- Electron main owns retrieval and persistence; renderer receives no database, filesystem, process,
  token, or arbitrary-network access.
- The repository returns at most 200 records ordered by the newer of publication and update time.
  arXiv returns at most 200 papers from its newest available daily batch and preserves the official
  publication timestamps.
- A source detail response reports its window bounds, last local index time, returned/rejected
  counts, and whether it is cached, fetched, partial, or a verified empty response.
- Every record retains its canonical HTTPS URL so the user can optionally open the primary source in
  the system browser.

## Non-goals

- Full-page scraping, paywall bypass, browser automation, or claiming a complete publisher archive.
- Activating RSSHub-candidate or adapter-required catalog entries through a UI click.
- Adding source-detail refresh results to Today without a normal Today refresh.

## Handoff

Implemented with typed repository queries, source-only retrieval, IPC/preload, Sources UI, bounded
error reporting, and package verification. X remains explicit and metered; its packaged `npx` path
is a separate deferred runtime fix.
