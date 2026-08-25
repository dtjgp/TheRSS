# ADR 0009: Do not expand the RSSHub dependency

- Status: Accepted
- Date: 2026-08-25

## Context

`sourceCatalogData.json` carried 72 entries marked `rsshub_candidate` — roughly two thirds of the
whole catalog — each annotated `低摩擦RSSHub候选`. They were dormant with no owner and no ship
decision, and their sheer number made the backlog look like 72 separate judgements when it was
really one.

The framing that "adopting RSSHub would introduce an intermediary" was wrong, and worth recording
because it changes the decision's basis. RSSHub is **already a production dependency**: 5 of the 20
deployed configured sources retrieve through `rsshub.rssforever.com`.

| Source                                | Endpoint                                 |
| ------------------------------------- | ---------------------------------------- |
| `folo:302` BAAI                       | `rsshub.rssforever.com/baai/hub`         |
| `folo:182` OpenAI                     | `rsshub.rssforever.com/openai/news`      |
| `folo:93` MIT Technology Review China | `rsshub.rssforever.com/mittrchina/index` |
| `folo:67` AIbase                      | `rsshub.rssforever.com/aibase/news`      |
| `folo:253` CNBC                       | `rsshub.rssforever.com/cnbc/rss`         |

That host is a public community instance, not one this project runs. So a quarter of deployed
configured retrieval already passes through a single third-party intermediary with no SLA, which
sits awkwardly against the local-first posture in ADR 0001 and the retrieval boundary in ADR 0004.

The reliability cost is observed, not theoretical. The first scheduled `Source Health` run to reach
the configured probe failed on `folo:253` — CNBC, via that same RSSHub host — while every
directly-retrieved source passed.

## Decision

Do not expand the RSSHub dependency. Delete all 72 `rsshub_candidate` entries.

Also delete `folo:2` (X/Twitter), which was already rejected for failing the same-day content
verification boundary but had been left in the catalog as priority C — a decision taken and never
applied.

The 5 existing RSSHub-backed sources stay for now. Removing working sources is a separate, larger
question about coverage, and bundling it here would conflate "do not grow this dependency" with
"tear out what already runs".

## Consequences

- The catalog drops from 105 entries to 32: 22 active plus 10 `adapter_required`.
- The `rsshub_candidate` acquisition state has no remaining members. It stays in the type union,
  since ADR 0004 defines it and historical records reference it.
- Future source growth goes through `adapter_required` work with a direct endpoint, keeping each
  source's dated verification evidence attributable to that source rather than to an aggregator.
- **Left open:** the 5 existing RSSHub-backed sources remain a single point of failure through one
  third-party host. The retry added to the source-health probe masks transient failures but does
  not remove the dependency. Whether to re-route or retire them needs its own decision.
