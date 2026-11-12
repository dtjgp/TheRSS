# Change Contract: Daily Papers empty states, local search hint, local search scope

Date: 2026-11-12, Europe/Rome. Base commit: `b1ea922`.

## Authority

On 2026-11-12 the user approved three items from the interaction review: "开始这三项, 然后检查 UI
部分, 看看是否有什么地方可以提升的". The Manager dispatch defines the minimal scope of I2, I1 and I4
below. The Manager review is in the Manager workspace (not part of this change). Commit, push,
install, release, live search/model calls and real vault writes are not authorized.

## Feature Intake

- User outcome: understand an empty Daily Papers view and how to recover; know that a local search
  result opens in TheRSS with a click or Return; find older Saved items, sessions or analyses that
  the bounded all-records search hides, and know when results are cut off.
- Observed problem/evidence:
  - I2: `src/main/appkit/dailyPapers.ts:93` renders no body when an edition has 0 papers. The status
    line exists (`src/shared/llmWikiDaily.ts:67-85`), but there is no reason or recovery text.
  - I1: `src/main/appkit/localSearch.ts:110` names only Return. A single click already opens the
    record (`native/appkit/node.mm:129-136`); the Manager confirmed this with a coordinate click.
  - I4: `src/core/storage/localSearchStore.ts:56-117` limits each kind to 25 rows and the merged
    list to 50. Newer Discover and analysis rows can hide all matching Saved items. The UI does not
    say that results were cut off.
- Product fit: PRODUCT.md surfaces 6 (Find Local Research) and Daily Papers. Non-goals respected: no
  network, model, scan trigger, schedule, history browsing or vault write.
- Alternatives: no change (keeps the gaps); a new "Open in TheRSS" button for I1 (rejected:
  duplicates the click); client-side filtering of the merged 50 rows for I4 (rejected: hides
  records outside the merged window).
- Cost: small native/Web presentation changes, one optional IPC argument, one SQL change. No
  runtime or external cost.
- Boundary changes: IPC `searchLocal` takes an optional `scope` argument that main validates with
  Zod; the response adds `scope` and `truncated`. No SQLite schema change, no migration, no new
  dependency, no network.
- Kill criterion: stop if scope cannot be applied in SQL without a migration, or if the Daily
  Papers text would need to assert a cause that the scan record does not state.
- Decision: proceed.

## Capability Contract

- Objective: the three approved slices behave as specified and are covered by tests and fresh
  rendered evidence.
- Goals:
  - I2: one shared helper gives the empty-state title and detail for `no-results`, `no-source`,
    `partial` with 0 papers, `missing`, `unavailable` and a failed read. Native and Web use it. The
    text says that Refresh rereads the local scan result and does not run the scan. `no-source` is
    never described as "no relevant papers". Date, counts, Open digest, Refresh and Back stay.
    Nothing final is shown while a read is in progress.
  - I1: native instruction text only: click or Return opens the result in TheRSS; Open original
    opens the selected result's original link.
  - I4: `searchLocal(query, scope?)` with scope `all | saved | discover | analysis`, default `all`.
    `all` keeps 25 per kind, 50 merged, the existing order and Discover de-duplication. A single
    scope returns at most 50 rows. `truncated` is a fact from LIMIT+1 per kind or a merged list
    above 50. Native shows a scope control and a truncation notice. Web keeps `all` and shows the
    truncation notice.
- Non-goals: I3, I5, I6; recent searches; Web scope control; Web I1 text; changes to
  `readLatest`; any scan trigger or history view; new buttons for opening.
- Interfaces: `TheRSSApi.searchLocal(query: string, scope?: LocalSearchScope)`. Existing one-argument
  calls keep their behavior. `LocalSearchResponse` gains required `scope` and `truncated`.
- Data ownership/evidence: SQLite remains the source; the daily scan record in llm-wiki remains the
  source of Daily Papers status. TheRSS does not infer why a batch was unavailable.
- Failure states: invalid scope rejected at IPC; search errors keep the existing message; Daily
  Papers read failure has its own explanation.
- Migration and rollback: none needed; revert the change set.
- Observability: no new logs.
- Allowed scope: `src/shared/{localSearch,llmWikiDaily,api}.ts`, `src/preload/index.ts`,
  `src/main/windowApplication.ts`, `src/core/storage/{localSearchStore,researchRepository}.ts`,
  `src/main/appkit/{localSearch,dailyPapers}.ts`, `src/renderer/src/{LocalSearchPanel,DailyPapersView}.tsx`,
  their tests and test mocks, PRODUCT.md lines for these surfaces, and this task directory.
- Persistent writeback: this contract and `REPORT.md` in this directory.

## Uncertainty Reducer

- Change class: user-visible UI flow adjustment plus an IPC/storage query boundary change.
- Artifact: failing tests (store, IPC, native presenter, Web component) and fixture-backed native
  rendering with an isolated user-data directory.
- Question: does scope reach SQL before truncation, is truncation factual, and does each empty
  state show a correct reason and recovery path?
- Not proven: real vault content, real user database volume, VoiceOver speech, physical mouse input.

## Frozen Acceptance Contract

- RED verifiers and expected failure:
  - Store: 30 newer Discover rows + 30 newer analyses + 5 older Saved rows. `all` returns no Saved
    rows and `truncated: true`; `saved` returns all 5 Saved rows and `truncated: false`. Expected
    RED: scope argument ignored and `truncated` undefined.
  - Store truncation boundaries: 0 matches; exactly 25 of one kind in `all` (not truncated); 26 of
    one kind in `all` (truncated by kind limit); 25+25+1 (merged limit; truncated); exactly 50 in a
    single scope (not truncated); 51 in a single scope (truncated).
  - Store invariants: `all` keeps Discover de-duplication and order; invalid scope throws.
  - IPC/application: invalid scope rejected; omitted scope means `all`; explicit scope forwarded.
  - Native local search: scope control renders with `all` selected; switching scope keeps the query
    and searches again with the scope; a late response for the old scope does not replace the new
    one; truncation notice appears only when `truncated` is true; scoped empty text names the
    scope; clear resets scope to `all`; Back to search results keeps scope.
  - Web local search: shows the truncation notice when `truncated` is true; still calls with the
    query only.
  - Daily Papers (shared helper, native, Web): each of the six states shows its title and detail;
    the detail includes the Refresh note; `no-source` text does not say that there are no relevant
    papers; non-empty editions show no empty state; a read in progress shows no final empty state;
    Open digest remains for edition-bearing states.
- E2E/manual path: native fixture app with isolated user data: Daily Papers empty states (fixture),
  local search with scope switches and truncation, narrow and wide windows, keyboard focus.
- Screenshot matrix: native wide (1360×880) and narrow (820×600) for local search (all, scoped,
  truncated, empty) and Daily Papers empty states; Web fallback by existing E2E.
- Security/dependency: new IPC argument validated by Zod in main; no new dependency.
- Package/install/live: not affected; not run.
- Full verifier: focused tests, `npm run check:architecture`, `npm run check`, `npm run test:e2e`,
  relevant native smoke with fixtures.
- Stop condition: all RED cases GREEN, full gates pass or have classified pre-existing failures,
  fresh native renders reviewed, report written.

### Acceptance-change log

| Date       | Contract change                                                                                            | Evidence/reason                                                             | Reviewer |
| ---------- | ---------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------- | -------- |
| 2026-11-12 | `LocalSearchResponse` gains `scope` and `truncated`; existing test mocks add them                          | Approved I4 contract change; no assertion weakened                          | Engineer |
| 2026-11-12 | `windowApplication.contract.test.ts`: main now forwards `('edge', 'all')` instead of `('edge')`            | Approved I4 default scope; adds explicit-scope and invalid-scope assertions | Engineer |
| 2026-11-12 | `dailyPapers.test.ts`: a failed read is asserted in `daily-papers-empty-*` instead of `daily-papers-error` | Approved I2 shared failure explanation; adds a no-zero-papers assertion     | Engineer |

## Implementation Slices

1. I4 store and IPC: RED store/application tests, then SQL scope and LIMIT+1.
2. I4 native and Web presentation: RED presenter/component tests, then scope control and notice.
3. I2 shared helper, native and Web: RED tests, then rendering.
4. I1 text: quick path.

## Independent Review

To be completed after implementation in `REPORT.md`.

## Evidence Closeout

See `REPORT.md` in this directory.
