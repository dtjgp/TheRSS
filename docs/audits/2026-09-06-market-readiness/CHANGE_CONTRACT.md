# TheRSS market-readiness contract

## Feature Intake

- User objective: implement every finding in the current beauty/interaction audit and bring the product to market-release quality. The user explicitly authorized the modifications and the work needed to complete this goal.
- Baseline: clean `main` at `f9bc6a2`; branch `codex/market-readiness`. Current-run AppKit audit captured 27 fixture screenshots and passed 12 workflow groups. Selected baseline captures and the notification geometry probe are retained in `baseline/`.
- Observed problems: notices shift content 38pt; disabled search lacks recovery; analysis follows nonessential metadata; narrow windows have nested scrolling; local search cannot reopen its local context; metadata is hard to scan; provider actions/validation lack hierarchy; empty filters lack recovery. Additional audit items cover shell spacing, consistent secondary actions, source-picker navigation and daily-value density.
- Product fit: complete the existing single-user, local-first macOS research workflow. Preserve source evidence, explicit network/analysis actions, protected credentials and confirmed exports. Public distribution is the goal; account sync, autonomous research, extra platforms and new data providers are not implied.
- Alternatives: leave current behavior, introduce another UI stack, or improve the AppKit interface and existing services. Choose AppKit and bounded service additions; no visual dependency or generated imagery is needed.
- Cost: UI/state/routing tests, native accessibility and layout work, release engineering and current-source verification. Avoid paid calls and purchases unless needed and their concrete scope is established. Public source reads and local fixture verification are within the accepted goal.
- Kill criterion: lost reading position/data, hidden evidence, unintended network execution, credential exposure, incompatible installation, or an unverified market-ready claim.

## Capability Contract

- Complete all eight audit findings and the associated visual refinements, with real native screenshots and behavioral checks.
- Preserve `3 / 2 / 7`, system fonts/symbols/colors, source identifiers, provenance, deterministic ranking and complete research text. Existing external titles are never rewritten for taste.
- Navigation may now enter a specific local Saved item, persisted Discover session/item, or immutable analysis from local search. This is an expressly authorized extension of the previous audit proposal. Search results retain their distinct records and stale/missing outcomes.
- A compact native reading mode may replace inefficient stacked panes at narrow widths. It must preserve selection, list position, keyboard access, return navigation and a user-visible way to switch modes. Wide workspaces retain resizable list/detail behavior.
- Feedback must not change the reading viewport geometry. Success feedback can expire; errors must remain recoverable and understandable. Native accessibility notifications must accompany relevant status changes without stealing focus.
- SQLite and the validated window API continue to own data. New local record lookups are bounded, typed and read-only. No model execution is triggered by local navigation or filtering.
- Failure states remain distinct: no records, no matching filter, missing local record, failed load, partial retrieval, cancellation, stale analysis and unavailable runner.
- Rollback: exact source commits plus the existing verified app/database backup workflow; no destructive cleanup of real user data. Any schema change needs explicit migration/rollback evidence before release.
- Scope: affected AppKit controls/presenters, shared/local service contracts, tests, fixture/native smoke scripts, compatibility API wiring when needed, product/release/support/privacy documentation and distribution verification.
- Writeback: this contract, `task_plan.md`, `GOALS.md`, product/architecture documents where behavior changes, release evidence and remaining external gates.

## Uncertainty Reducer

- UI/interaction: failing behavior tests plus the existing disposable AppKit host. Narrow reading mode is rendered and exercised before its acceptance replaces old stacked-layout assertions.
- Routing: a typed record-target spike must reopen actual persisted snapshots/artifacts without mutating source data or invoking a provider.
- Release: inspect signing identity, package/update code, CI, dependency advisories, source health and install/recovery evidence. Missing signing credentials are an external release gate, not a reason to stop independent implementation.
- These checks do not prove research correctness, every future source's availability, or full accessibility from screenshots alone.

## Frozen Acceptance Contract

| ID  | Required behavior                                                                                                         | Verifier                                                                                          |
| --- | ------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------- |
| A1  | Save/Unsave/Undo and notice dismissal keep viewport, focus and selected content stable; status is accessible              | Unit state tests plus native before/after geometry and announcement checks                        |
| A2  | Each disabled search/analysis cause has a truthful, reachable recovery; input is never submitted implicitly               | Runner/source/query cases and native first-run workflow                                           |
| A3  | Core reading actions are visible before summary; evidence stays visible; applicable metadata and provenance expand intact | Ordered native scene assertions, long text, analysis race cases, actual viewport capture          |
| A4  | Narrow/zoomed users can select, read, save and return without competing stacked scroll regions                            | 1360x880, 1024x677, 820x720, 820x600 at zoom 1 and 1.5; keyboard and selection/scroll restoration |
| A5  | Local search opens exact Saved/session/analysis context, with missing/stale recovery and back navigation                  | Typed lookup/storage/boundary tests and real fixture local-search flow                            |
| A6  | Lists prioritize readable source/date/state; complete titles/reasons/score definitions remain available                   | Long Unicode, source-role, triage and ranking-invariance checks                                   |
| A7  | Provider save/test/clear have coherent hierarchy; errors point to fields; secure draft/close behavior survives            | Settings RED/GREEN, marked text, ordered secret callbacks, native focus/error checks              |
| A8  | Empty Saved and filtered lists have explicit safe recovery; failures stay separate from empty results                     | Empty/filter/retry tests, native keyboard activation                                              |
| A9  | Shell/secondary actions/typography/source picker/daily values use coherent native layout and density                      | Cross-page screenshots, source membership and exact raw-value checks                              |
| R1  | Main and AppKit tests, four-dimensional >=80% owned coverage, architecture, lint, types and build pass                    | `npm run check` and full compatibility E2E                                                        |
| R2  | Security and privacy boundaries withstand explicit review; dependency audit has no unresolved high/critical runtime risk  | Focused security tests, redacted scan, audit, independent diff review                             |
| R3  | Supported package launches on fresh and upgraded local profiles; install/rollback preserve databases and identities       | Native/control/package/MCP/credential gates, upgrade and recovery rehearsal                       |
| R4  | Current bounded source/provider smoke evidence is dated and accurately reported; failures are actionable                  | Opt-in live source smoke and explicit provider smoke with no secret logging                       |
| R5  | Distribution has signing/notarization/Gatekeeper evidence and a verified same-identity update path                        | Signed baseline and successor install/update test; fail closed without identity                   |
| R6  | Market-facing install, privacy, limitations, support and release notes match actual product behavior                      | Documentation/link review and release readiness ledger                                            |
| R7  | Reviewed intended changes reach GitHub with passing CI and verified local/remote identity                                 | Exact-path commits, protected-main PR flow, CI and remote SHA verification                        |

- Full verifier: focused RED/GREEN for each slice, `npm run check`, `npm run test:e2e`, native workflow/control screenshots, dependency/security checks, bounded live source checks, package/install/rollback and market-release gate review.
- Completion: every A/R requirement has direct current evidence. An unsigned personal beta or a subset of green tests cannot satisfy this market-release goal. Outstanding external credentials keep the goal incomplete while independent work continues.

### Acceptance-change log

| Date       | Contract change                                                                                                                                             | Evidence/reason                                                                                             | Reviewer                  |
| ---------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------- | ------------------------- |
| 2026-09-06 | All audit findings, narrow reading mode and in-app search navigation accepted; market release gates opened                                                  | User explicitly requested all improvements and market quality                                               | Current user scope        |
| 2026-09-06 | Errors persist until explicitly dismissed; update the earlier preference-error test that expected automatic disappearance                                   | A1 requires recoverable errors; success notices still expire and have separate timer coverage               | Current accepted contract |
| 2026-09-06 | Native scroll-preservation fixture explicitly expands source metadata before asserting long-content scroll                                                  | A3 now collapses supplementary fields; the short fixture can fit entirely without expansion                 | Current accepted contract |
| 2026-09-06 | Replace compact stacked-split expectations with single visible pane, explicit return, retained selection and scroll tests; keep wide divider keyboard tests | A4 authorizes compact reading navigation; native Window content size drives layout without DOM measurements | Current accepted contract |

## Implementation Slices

1. Stable feedback, runner recovery and top-level reading/metadata hierarchy.
2. Responsive reading mode, state restoration and empty-state recovery.
3. Exact local-context navigation and result presentation.
4. Settings validation/hierarchy and remaining cross-page visual consistency.
5. Reliability, security, accessibility, larger-content tests and fixes.
6. Release/support documents, package/upgrade/recovery, signed distribution and GitHub delivery.

## Independent Review

A separate diff review was performed after implementation in the main session. It covered contract fit, state races, source integrity, IPC/storage, credential handling, process cancellation, installation/rollback and native interaction evidence. Found defects were fixed and reverified. This is not an external reviewer sign-off or completed user black-box acceptance; the report preserves those boundaries.

## Evidence Closeout

- Local acceptance scope (2026-09-07, current user instruction): the user explicitly approved backup installation, one fixed-message CLI connectivity test, GitHub push/draft PR and private vulnerability reporting, then asked to confirm the software locally without Apple paid enrollment. Complete local installation, preserved-data verification, installed-app workflows and the bounded CLI test now. Treat signing/notarization as deferred for this local acceptance, not a blocker to it. Retain the granted GitHub authorization while prioritizing this requested local check; no remote publication is needed for its stop condition. Record actual local outcomes separately from market-distribution gates and do not claim a signed release.

- Local quit acceptance: Command-Q closed the installed window but left its main process and helpers running. An isolated native fixture reproduced two `before-quit` events followed by `window-all-closed`, with no process exit. Hypothesis: re-entering `app.quit()` from the shutdown microtask races the original prevented quit. Require an actual desktop regression that requests normal quit and observes a zero-code process exit within five seconds, covering native and compatibility paths. Preserve the existing unsaved-settings decision, preference drain, in-flight work and database close order; do not replace normal shutdown with forced process termination.

- R4 follow-up (2026-09-07): all five current timeouts share `rsshub.rssforever.com`. An independent 15-second curl read of its OpenAI route received headers and only 40,540 of 525,643 bytes before timing out. The existing OpenAI source has an official `https://openai.com/news/rss.xml` endpoint that returned a complete, valid 712,661-byte RSS document in 0.29 seconds, with the same channel and first article title. Replace only the `folo:182` transport endpoint and its verification/access note; keep source identity, ranking, the 100-item cap and security boundaries. Verify actual URL selection with a failing HTTP-boundary regression, normalize the real official response, then run the full gate and repackage. Do not substitute CNBC's official candidate, which returned 403, or claim the other mirror routes recovered.

- Historical GitHub approval boundary: private vulnerability reporting was initially disabled and automatic review rejected the setting change. The user's later independent GitHub authorization superseded that blocker; enabling the setting and its readback passed, and draft PR #49 was created. No earlier rejection was bypassed.

- Non-release follow-up (2026-09-07): the user requested the remaining source, real workflow, runner and acceptance work, then deferred new paid model APIs and VoiceOver. [REMAINING_ACCEPTANCE.md](REMAINING_ACCEPTANCE.md) records the bounded official-list repairs, all-rejected source handling, real Codex/Claude calls, evidence-label/prompt/source-freshness fixes and stop conditions. [HUMAN_ACCEPTANCE.md](HUMAN_ACCEPTANCE.md) remains pending for a real reviewer; automated and assistant-operated checks do not constitute human sign-off. Existing installation and draft-PR delivery authorizations continue to cover these verified fixes.

- Source-boundary review reproduced an HTML/error response being classified as an empty arXiv feed. The parser now requires well-formed feed XML, rejects unsupported declarations/error documents, and preserves verified empty feeds. Production arXiv calls share one cancelable queue with at least three seconds between starts, matching the [official API guidance](https://info.arxiv.org/help/api/user-manual.html). Deterministic injected transports remain isolated; queue/abort tests cover real scheduling semantics without live traffic.

- 2026-09-07: supported Node 26.7.0 reproduces 41 compatibility-renderer failures because host Web Storage shadows jsdom storage. Direct jsdom has a working Storage instance; the [Vitest upstream issue](https://github.com/vitest-dev/vitest/issues/10867) confirms the boundary. Disable only host Web Storage in Vitest workers, retaining real jsdom Storage and every storage assertion. No runtime/product storage capability is removed.

- Initial current-machine signing probe: `security find-identity -v -p codesigning` returned zero valid identities. macOS 27.0 build 26A5425a; shell Node 24.13.0 is older than the project's declared 24.15 minimum and needs a supported runtime for final gates.
- Current A1-A9 and R1-R7 outcomes, exact verification evidence and remaining release gates are recorded in [REPORT.md](REPORT.md) and [verification.json](verification.json). A1-A9 are implemented and verified; the full market-release objective remains incomplete.
