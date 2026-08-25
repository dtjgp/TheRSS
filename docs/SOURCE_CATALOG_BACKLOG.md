# Source Catalog Backlog

`src/shared/sourceCatalogData.json` holds 105 entries. 22 are deployed: 20 configured
adapters plus the native arXiv and GitHub clients. The remaining 83 have sat dormant with
no owner, no priority order, and no decision about whether they will ever ship.

This document exists to make that backlog decidable. It is a triage input, not a decision
record; once the calls below are made they belong in `docs/decisions/`.

## The backlog is not 83 decisions

It is one architectural decision, eleven scoped tasks, and a naming clarification.

| Group              | Count | What it actually needs                             |
| ------------------ | ----: | -------------------------------------------------- |
| `rsshub_candidate` |    72 | **One** yes/no on adopting RSSHub                  |
| `adapter_required` |    11 | Individual adapter work, each with a known blocker |
| `active` (native)  |     2 | Nothing — already shipped                          |

Treating these as 83 separate items is what has kept them undecided. Grouped, the whole
backlog resolves in one architectural call plus a short task list.

## Decision 1 — RSSHub: adopt or drop (72 entries)

All 72 carry `acquisition: "rsshub_candidate"` and the note `低摩擦RSSHub候选`. They are
low-friction only _if_ RSSHub exists as a dependency. By priority: **A 24, B 46, C 2**.

RSSHub is a third-party, self-hosted aggregator. Adopting it would mean either running an
instance or depending on a public one, which cuts directly against the product's
local-first, no-external-service posture recorded in
[`decisions/0001-electron-local-first.md`](decisions/0001-electron-local-first.md) and the
retrieval boundary in
[`decisions/0004-configured-source-retrieval-boundary.md`](decisions/0004-configured-source-retrieval-boundary.md).
It would also place an intermediary between TheRSS and every source's dated-verification
evidence, which the source-health workflow depends on.

- **If no** — delete all 72 entries. That is the single largest cleanup available here and
  it removes 69% of the catalog.
- **If yes** — one adapter unlocks 72 sources at once, and the boundary decision needs a new
  ADR before any code lands.

There is no middle option worth carrying: leaving them dormant is what produced this
document.

## Decision 2 — eleven scoped adapters

Each has a documented blocker, so these are estimable rather than open-ended. Eight are
priority A.

| Pri | Source                                       | Blocker                                                 | Domain                   |
| --- | -------------------------------------------- | ------------------------------------------------------- | ------------------------ |
| A   | U.S. Energy Information Administration (EIA) | RSS direct; API needs a free key                        | Energy statistics        |
| A   | International Telecommunication Union (ITU)  | Official RSS                                            | Telecom standards/policy |
| A   | IEEE Power & Energy Society (PES)            | Official publication entry point                        | Power/energy publishing  |
| A   | MLPerf / MLCommons Benchmarks                | Result tables/rules                                     | AI systems benchmarks    |
| A   | National Laboratory of the Rockies (NLR)     | Publications/data tooling                               | Energy systems research  |
| A   | 3GPP Specifications                          | Public specs over FTP                                   | Telecom standards        |
| A   | ENTSO-E Transparency Platform                | API token                                               | European power markets   |
| A   | International Energy Agency (IEA)            | Some data needs an account                              | Energy data/policy       |
| B   | NVIDIA Developer Technical Blog              | Official technical blog                                 | GPU/deployment           |
| B   | GSMA                                         | Official web pages/reports                              | Mobile industry          |
| C   | X (Twitter)                                  | Already rejected — failed the same-day content boundary | Social context           |

Suggested order: **EIA and ITU first.** Both are plain RSS or a free key, both are priority A,
and neither requires an account or credential storage — so they extend coverage without
touching the security boundary. 3GPP (FTP) and ENTSO-E/IEA (accounts) are materially harder
and should not be bundled with them.

X (Twitter) is already decided. It should be deleted rather than carried as priority C.

## Clarification — the two `active` entries

`official:arxiv` and `folo:10` (GitHub) are marked `acquisition: "active"` but are absent
from `CONFIGURED_SOURCE_DEFINITIONS` because they are native adapters, not configured
sources. This is correct behavior and not a defect, but it makes naive counts of the
catalog disagree with the shipped total. Any future audit should count
**20 configured + 2 native = 22**.

## Recommended sequence

1. Decide RSSHub. A "no" deletes 72 entries and shrinks the catalog to 33.
2. Delete the X (Twitter) entry, which is a decision already taken but never applied.
3. Schedule EIA and ITU as the next two adapters.
4. Leave the remaining eight priority-A adapters as an explicit, ordered backlog rather
   than dormant catalog rows.
