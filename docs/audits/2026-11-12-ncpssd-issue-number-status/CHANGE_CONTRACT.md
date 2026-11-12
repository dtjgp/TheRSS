# Change contract: an NCPSD list with only issue numbers is not a failed source

## Feature intake

- **User outcome:** When the NCPSD (`folo:611`) latest-literature list contains only issue-numbered entries, TheRSS reports "no results" with the omission reason. It does not report a source failure, and the scheduled Source Health job does not file a regression for it.
- **Observed problem:** From 2026-11-09 to 2026-11-12, every scheduled Source Health run reported `folo:611 failed 0 normalized; rejected=6; 6 entries lack a publication month; issue numbers were not converted to dates` (runs 42571233033, 42766246609, 42970071316, 43165816987; issue #89). The page was retrieved and parsed. Every entry used an issue date such as `《经济学动态》2026年9期`. `docs/USER_GUIDE.md` states that TheRSS does not invent a date for such entries, so the omission is intended. `classifySourceBatch` returns `failed` for any batch with rejected entries and no items, so an intended omission is reported like an invalid payload. `AGENTS.md` requires failed and no-result states to stay distinct.
- **Product fit:** Source status correctness. No new source, UI control or date inference.
- **Alternatives:** (1) Convert issue numbers to dates: rejected, because the user guide forbids invented dates. (2) Change only the Source Health workflow: rejected, because the app shows the same wrong `failed` state. (3) Do nothing: the job fails daily while NCPSD lists only issue-numbered entries. Select: count policy omissions separately from invalid entries.
- **Cost and boundaries:** One optional field on `NormalizedSourceBatch`, the NCPSD normalizer, the batch classifier and its three consumers. No SQLite schema, IPC, network, package or UI change.
- **Kill criterion:** If NCPSD issue numbers later get a verified date mapping, remove the omission count for them.

## Capability contract

- **Objective:** A batch whose rejected entries are all policy omissions, and which has no items, is `no_results`. A batch with at least one invalid entry and no items stays `failed`.
- **Interfaces:** `NormalizedSourceBatch.omittedCount?: number` counts entries excluded by an evidence policy. These entries are also in `rejectedCount`, so the existing `partial` result and rejection detail for mixed lists do not change. `normalizeNcpssdDocument` sets `omittedCount` for entries that have a valid title and detail route but no publication month.
- **Evidence semantics:** Omitted entries are not normalized and get no date. The reason text is unchanged.
- **Failure states:** Discover reports `no_results` with the omission detail. Single-source refresh and daily refresh record `healthy` with the omission detail and 0 results, as they already do for an empty list (`no_results` is not a persisted source-health value). The configured-source smoke reports `no_posts`.
- **Migration/rollback:** No stored data changes. Rollback is a revert.
- **Allowed scope:** `src/core/sources/catalog/sourceNormalizer.ts` (type only), `ncpssdNormalizer.ts`, `sourceBatchStatus.ts`, `src/core/discover/discoverService.ts`, `src/core/discovery/discoveryService.ts`, their tests, and this record. The arXiv HTTP 429/timeout failures in the same runs are transient runner rate limits and are out of scope.

## Frozen acceptance contract

- **RED:** (a) The NCPSD normalizer test expects `omittedCount: 2` for two issue-numbered entries, and expects an entry with no title to be rejected but not omitted. (b) A new classifier test expects `no_results` for an all-omitted batch and `failed` when one rejected entry is not an omission. (c) The Discover test expects `no_results` for an all-omitted configured batch. (d) The daily-refresh test expects the dashboard to show `no_results`, not `failed`, for an all-omitted batch (see the acceptance change below). All fail on the current code.
- **Unchanged:** the existing all-invalid (`failed`) and partial tests keep their assertions.
- **Acceptance change (2026-11-12, before GREEN):** RED (d) expected the dashboard to show `healthy`. The repository records `healthy` with 0 results, and the dashboard snapshot derives `no_results` from that record. The visible state is therefore `no_results`, which is the objective. Test (d) now expects `no_results`. This is stricter than "not failed", not weaker.
- **Verifiers:** focused suites, `npm run check`, diff review. No live source call in automated tests.
- **Stop:** All verifiers pass. The next scheduled Source Health run is the live confirmation and is outside this change.

## Verification record (2026-11-12)

- **Reproduction:** Source Health reports for runs 42571233033 to 43165816987 show `folo:611 failed ... rejected=6; 6 entries lack a publication month`. A local fetch through the app client (fallback endpoint `https://m.ncpssd.cn/`) returned 6 entries: 4 dated `2026年N月` and 2 dated `2026年N期`. A direct request to `https://www.ncpssd.cn/` from the same host got a WAF 403, so the CI list content was not observed directly.
- **RED:** 4 new tests failed for the expected reasons: the classifier and Discover returned `failed`, the daily refresh recorded `failed`, and the normalizer returned no `omittedCount`.
- **GREEN:** focused source, Discover and discovery suites pass (146 of 146).
- **Review:** an independent diff review found no critical, high or medium findings. Applied: the classifier uses `===` so an omission count larger than the rejected count cannot hide a failure; a test asserts that an entry with an off-origin route and no month is invalid, not omitted; a code comment was corrected. Not applied (outside this scope): Discover still shows the omission detail in the red error style beside "No results", and `docs/USER_GUIDE.md` does not mention that "No items" can mean entries without a usable date.
- **Full gate:** `npm run check` exit 0 (883 + 194 tests).
- **Not run:** live configured-source smoke and the scheduled Source Health job. The arXiv HTTP 429/timeout failures in the same runs are unchanged by this change.
- **Git:** branch `fix/ncpssd-issue-number-status`, not committed, not pushed.
