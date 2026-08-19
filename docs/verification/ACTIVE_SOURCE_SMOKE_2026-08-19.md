# Active source verification — 2026-08-19

## Scope

This record verifies the 23 sources scheduled by Today after the generic-source migration:
2 native adapters (`arxiv`, `github`) and 21 promoted `folo:*` adapters.

The strict same-day result follows the user's earlier acceptance rule: a source counts only when a
normalized item carries a publication timestamp in the local 2026-08-19 calendar day. Reachability,
an empty valid response, and a schema-only check do not count as same-day content.

## Result

| State                                                               | Count | Sources                                                                                                                                                                         |
| ------------------------------------------------------------------- | ----: | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Same-day content confirmed                                          |    16 | 北京智源人工智能研究院, OpenAI, 科学网, 量子位, 麻省理工科技评论, AIbase, C114 通信网, CNBC, Hacker News, MDPI, Solidot, TechCrunch, TechPowerUp, The Verge, WIRED, Huggingface |
| Reachable but no valid same-day item                                |     4 | 国家哲学社会科学文献中心, National Bureau of Economic Research, 麦肯锡, The Nikkei 日本経済新聞                                                                                 |
| Live items returned, but not dated today in the smoke query         |     2 | arXiv, GitHub                                                                                                                                                                   |
| Adapter and current schema verified; metered live retrieval not run |     1 | X (Twitter) via xapi                                                                                                                                                            |

No configured HTTP or Hugging Face adapter ended in `failed`. C114 returned one valid same-day item
and rejected 14 entries without a usable date, so the application correctly records it as `partial`.
NBER's official RSS is reachable but its entries omit publication dates; assigning the retrieval time
would create false same-day evidence and is therefore not allowed.

## Commands and evidence

- `npm run smoke:configured-sources`: 16 sources returned at least one item dated 2026-08-19;
  4 returned `no_posts`; X was intentionally skipped without `THERSS_SMOKE_X_QUERY`.
- `npm run smoke:sources`: arXiv returned 3 normalized items and GitHub returned 25.
  The newest smoke-query dates were 2026-08-17 for arXiv and 2026-08-16 for GitHub, so neither is
  included in the strict same-day count.
- `npx -y xapi-to get twitter.search`: action status `stable`; the adapter's `raw_query`,
  `sort_by=Latest`, and `count` inputs match the current schema.
- `npm run check`: 39 test files and 186 tests passed; statements 91.89%, branches 80.56%,
  functions 93.82%, and lines 94.23%; formatting, lint, typecheck, and production build passed.
- `npm run test:e2e`: 1 Electron end-to-end test passed, including grouped Daily Stream and the
  promoted source catalog fixture.
- `npm audit --omit=dev`: 0 vulnerabilities.
- `npm run install:local`: installed `/Users/dtjgp/Applications/TheRSS Dev.app` and retained the
  previous bundle as `/Users/dtjgp/Applications/TheRSS Dev.backup-2026-08-19T13-41-13-906Z.app`.
- `npm run smoke:package`: the installed executable opened successfully and exposed the typed
  preload API under an isolated temporary user-data directory.
- Packaged and installed `app.asar` SHA-256 values matched:
  `a46a673f50de3cc87192684231908ae2d07b949917d294e0e7c3d3ea8c11a128`.

## Interpretation

All 23 sources are active scheduler jobs with typed health states. “Active” means the source has a
real adapter and participates in Today; it does not mean every source must publish every day. The UI
must continue to distinguish `healthy`, `partial`, `no_results`, `failed`, and the unexecuted X live
check instead of manufacturing content. (`no_posts` is the live-smoke label for the UI's
`no_results` state.)
