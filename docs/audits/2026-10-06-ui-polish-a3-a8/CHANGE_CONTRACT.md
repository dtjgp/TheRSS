# Change Contract: acceptance findings A3-A8

Scope authority: on 2026-10-06 the user asked "全部完成,然后开始合并 PR" and chose to finish
A3-A8 before merging PR #58 (items 3 and 4 move to a later branch). Findings:
[appearance acceptance](../2026-10-06-appearance-acceptance/REPORT.md).

## Feature Intake

- User outcome: the remaining rendered defects of the acceptance pass are gone: plain-language
  search details, a local search that does not claim a workspace, complete preview excerpts, an
  explained empty analysis history, consistent copy, notices that stay with their workspace, and
  no toolbar constraint churn.
- Product fit: UI skill rows Feedback, Familiarity and Visual hierarchy; evidence rules keep
  ISO timestamps and provenance as recorded; distinct outcome states stay distinct.
- Alternatives: leave as recorded findings (status quo); a broader copy rewrite (rejected: no
  reviewed scope).
- Boundary changes: native presentation text and layout; one read-only SQL expression in local
  search (ellipsis on a bounded excerpt, shared by both routes); a native sidebar deselect; a
  native toolbar update guard. No schema, IPC, network, package or dependency change.
- Kill criterion: stop if a change hides a source outcome, rewrites provenance, or changes a
  stored value.

## Capability Contract

- D1 (A3): search details show the session outcome title (as in the result status), the
  recorded ISO time as a labelled `Recorded:` line, plan lines only when they have values, and
  each source as "<outcome label> · <n result(s)>" with any error text unchanged. Planner
  provenance is unchanged.
- D2 (A4): while local search shows, no sidebar workspace is selected; choosing any workspace
  ends the search (existing). A local-search excerpt cut at 300 characters ends with "…"; a
  shorter text is unchanged.
- D3 (A5): with no stored analyses, the analysis area shows the native empty state (symbol,
  title, explanation) instead of an empty list and reader. The four metrics are two pairs, so
  a narrow window wraps them 2 + 2; a nested row wraps at its natural width (`node.mm`).
- D4 (A6): an empty Discover workspace without a session shows only the empty state (no
  "Enter a research question" line); the result status reads "<title> · n of m sources
  succeeded · <date>"; a source without a recorded outcome reads "No outcome recorded yet." and
  omits the "Last recorded outcome" boundary line.
- D5 (A7): a success notice is cleared when the workspace changes; error notices stay until
  dismissed or replaced (unchanged).
- D6 (A8): toolbar items are reconfigured only when their title, help, symbol or enabled state
  changes.
- Non-goals: search scopes, window restoration, Web fallback copy (the SQL excerpt is shared by
  design), R2.
- Allowed scope: `src/main/appkit/{discover,localSearch,analytics,sources,presenter}.ts` and
  their tests, `src/core/storage/localSearchStore.ts` and its test,
  `native/appkit/{node,chrome}.mm` (row wrapping and the source-list selection), `scripts/smoke-native-appkit.mjs`, this directory, the
  acceptance report.

## Frozen Acceptance Contract

- RED D1: unit test on the details document: contains `Complete`, `Recorded: <ISO>`, "1
  result" / "0 results" with outcome labels, no `healthy`/`no_results`/`completed` tokens, no
  empty `Excluded keywords:` line.
- RED D2: presenter unit test: the sidebar has no selection while local search shows; store
  test: a 301+ character summary yields a 300-character excerpt plus "…", a short one is
  unchanged.
- RED D3: analytics unit test: no analyses -> `analytics-analyses-empty` empty state and no
  `analytics-analyses` table; metrics are two rows of two.
- RED D4: discover unit tests for the readiness line and the status text; sources unit test for
  the unrecorded state.
- RED D5: presenter unit test: a success notice disappears on navigation.
- D6: matrix run stderr has no `NSToolbarLabelStack` warning (6 before); workflow smoke passes.
- Full verifier: `npm run check`; controls smoke; workflow smoke; matrix re-run.
- Stop condition: D1-D6 verified; no existing assertion weakened beyond the log below.

### Acceptance-change log

| Date       | Contract change                                                                                                                                                                                                   | Evidence/reason                                                                                                                                                                                                                                                                           | Reviewer           |
| ---------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------ |
| 2026-10-06 | S0 status text "n of m sources complete" becomes "n of m sources succeeded" (`discover.test.ts`, workflow smoke status pattern). The count rule (healthy and no_results) is unchanged.                            | A6: "Complete · 22 of 22 sources complete" repeats the word                                                                                                                                                                                                                               | user (A6 approval) |
| 2026-10-06 | `discover.recovery.test.ts`: before the first search the readiness line is absent and the empty state shows; the empty-question line is now asserted with a retained session. The zero-sources case is unchanged. | D4 (A6) removes the duplicate hint only when the empty state explains it                                                                                                                                                                                                                  | user (A6 approval) |
| 2026-10-06 | D6 dropped: the update guard did not remove the warnings (still 6 in the matrix run) and was reverted. A8 stays open as investigated.                                                                             | Trace: warnings follow only the wide Model Provider capture in the full matrix (2 per appearance); the workflow smoke, which fails on unknown stderr, never shows them; four targeted probes (theme, resize, pane switch then close at 0/800 ms, the matrix capture sequence) showed none | implementer        |

## Verification (2026-10-06)

- RED/GREEN (unit, `acceptancePolish.test.ts`, store test): all six new cases failed for the
  intended reason (raw `completed`/`healthy`, "sources complete", the readiness line, the
  contradictory source line, the `analytics-analyses` table, a kept "Saved:" notice; no
  ellipsis) and pass after the change.
- RED/GREEN (workflow smoke): "No workspace is selected while a local search shows" failed
  (`'sources'`): the source list disallowed an empty selection. Fixed by allowing it only while
  the scene selects none. "Metric … keeps its label width at 820 pt" failed (142 pt) after the
  review; nested rows now wrap at their natural width (2 + 2, 180 pt each).
- D6: the toolbar update guard left the 6 matrix warnings unchanged and was reverted (log).
- Independent review (fresh-context reviewer), with fixes:
  1. Medium: the metric pairs never wrapped at the minimum window (each metric 142 pt, a label
     on two lines). Fixed in `node.mm` (see above).
  2. Low: success notices were cleared only by `navigate`; opening a local result and returning
     to search also change the workspace. Fixed: one `changeRoute` path.
  3. Low: test gaps. Added a recorded-source case (label, time and boundary line), an error
     notice that survives navigation, the Discover excerpt branch and the exact 300-character
     case.
  4. Nit: "not searched · 0 results" read as an observed count. A source that was not searched
     now shows "not searched" only (asserted; its RED was not run separately).
  5. Checked without change: focus and restore paths with an empty analysis list, the sidebar
     selection toggle (no nil navigation), the excerpt consumers (display only), the distinct
     evidence states.
- Final: `npm run check` exit 0 (766 main, 161 AppKit tests; coverage at least 80% on all axes);
  controls smoke 20/20; workflow smoke 16/16 without screenshots (an earlier run stopped on the
  R1 diagnostic while another app was active, and one stopped with its log overwritten); capture
  matrix 59 of 60 (one popover capture missed, R2).
- Rendered: search details read "Complete / Recorded: …" with plain outcomes; Analytics shows
  "No stored analyses" and the metrics 2 + 2 at 820 pt; empty Discover shows one hint; Sources
  shows "No outcome recorded yet."; no "Saved:" notice on Analytics.
- Not run: VoiceOver speech, the Web fallback rendering of the shared excerpt.
