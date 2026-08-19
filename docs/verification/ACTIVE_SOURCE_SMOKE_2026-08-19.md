# Active source verification — 2026-08-19

## Scope

This record verifies the 22 sources exposed through Discover after the Discover-centered
consolidation: 2 native adapters (`arxiv`, `github`) and 20 promoted `folo:*` adapters.

The strict same-day result follows the user's earlier acceptance rule: a source counts only when a
normalized item carries a publication timestamp in the local 2026-08-19 calendar day. Reachability,
an empty valid response, and a schema-only check do not count as same-day content.

## Result

| State                                         | Count | Sources                                                                                                                                                                                                          |
| --------------------------------------------- | ----: | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Same-day configured content confirmed         |    18 | 北京智源人工智能研究院, OpenAI, 科学网, 量子位, 麻省理工科技评论, 麦肯锡, AIbase, C114 通信网, CNBC, Hacker News, MDPI, Solidot, TechCrunch, TechPowerUp, The Nikkei 日本経済新聞, The Verge, WIRED, Huggingface |
| Reachable configured source, no same-day item |     2 | 国家哲学社会科学文献中心, National Bureau of Economic Research                                                                                                                                                   |
| Native bounded retrieval passed               |     2 | arXiv, GitHub                                                                                                                                                                                                    |

The final current-run verifier passed all 22 source jobs: 20 configured-source adapters plus the
native arXiv and GitHub clients. C114 returned 25 normalized items, 18 dated today, with zero
rejections. ScienceNet returned 20 normalized items, all dated today. This confirms retrieval and
normalization now; it does not claim that every source returns a relevant record for every Discover
question.

The first configured-source run after the route change passed 18/20 and recorded transient AIbase
timeout and C114 fetch failures. A direct bounded Node request then reached C114 with HTTP 200, and
the immediate complete rerun passed 20/20. Both outcomes are retained because a successful rerun
does not erase observed transient source risk.

During the publication gate, the earlier C114 mobile endpoint timed out twice and a direct 20-second
request also timed out. The adapter was moved to the current official HTTPS desktop home page with
two bounded attempts and the mobile page retained only as a fixed-origin fallback. The desktop
latest-news parser was covered by deterministic tests; the next complete live run passed 20/20 and
produced the C114 counts above.

## Commands and evidence

- `npm run smoke:configured-sources`: the final rerun passed 20/20; 18 sources returned at least one
  normalized item dated 2026-08-19 and 2 returned live records without a same-day item.
- `npm run smoke:sources`: arXiv targeted search returned 3 normalized items, arXiv recent retrieval
  returned 200, and GitHub returned 25.
- `npm run check`: 42 test files and 220 tests passed; statements 91.53%, branches 80.60%, functions
  93.46%, and lines 94.41%; formatting, lint, typecheck, and production build passed.
- `npm run test:e2e`: 1 Electron end-to-end test passed, including the collapsed 22-source selector,
  result-first hierarchy, expandable outcomes, Saved promotion, analytics, and Sources flow.
- `npm run package:mac`: generated the unsigned arm64 directory package. The first sandboxed attempt
  could not resolve GitHub; the approved network rerun succeeded.
- `npm run smoke:package`: the uninstalled executable at
  `release/mac-arm64/TheRSS.app/Contents/MacOS/TheRSS` opened successfully and exposed the typed
  preload API under an isolated temporary user-data directory.
- `npm run install:local`: backed up the live SQLite database, retained the previous application,
  and installed `~/Applications/TheRSS Dev.app`. Its `app.asar` SHA-256 exactly matched the release
  package, and the installed executable passed the same isolated package smoke.

## Interpretation

All 22 sources are active retrieval jobs with typed health states. “Active” means the source has a
real adapter and participates in Discover; it does not mean every source must publish every day or
return a relevant result for every query. The UI must continue to distinguish `healthy`, `partial`,
`no_results`, and `failed` instead of manufacturing content.

## Hugging Face

TheRSS retrieves three distinct public signals rather than treating the blog RSS as the whole
source:

- `/api/models`, sorted by `lastModified`;
- `/api/datasets`, sorted by `lastModified`;
- `/api/daily_papers`, with paper title, abstract, authors, and publication time.

Public reads work without a token. A token is optional for higher account rate limits and required
for gated or private resources. If one is supplied through `THERSS_HUGGINGFACE_TOKEN`, use a
dedicated fine-grained/read-only token; Electron main passes it only to the fixed Hugging Face
adapter and never returns or persists it. Never hardcode it.

Official references: [Hub API endpoints](https://huggingface.co/docs/hub/en/api),
[daily papers API](https://huggingface.co/docs/huggingface_hub/en/package_reference/hf_api#huggingface_hub.HfApi.list_daily_papers),
and [user access tokens](https://huggingface.co/docs/hub/en/security-tokens).
