# P0-2: refresh llm-wiki status after a promotion write

## Feature Intake

- User outcome: after the user confirms an llm-wiki promotion, the native reader shows the new
  collected state without a manual Recheck. A linked note makes Open in Obsidian the primary
  action. A record-only paper tells the user how to try to add the missing note.
- Observed problem/evidence: `NativeModals.confirmPromotion` stores the receipt and does nothing
  else (`src/main/appkit/modals.ts`). `WikiStatus.select` ignores a reselection of the same arXiv
  ID, and main keeps a scan cache for up to 30 seconds. The reader can therefore show the
  pre-write state after a successful write. Source: [PRIORITIES.md](../2026-10-28-llm-wiki-status/PRIORITIES.md) item 2.
- Product fit: completes the existing read-only handoff (ADR 0012) and the existing promotion
  workflow (ADR 0008). Obsidian still owns note reading/editing.
- Alternatives: do nothing (the user must press Recheck); invalidate only the main cache (the
  reader still shows the old result until reselection); refresh the matching readers from the
  window presenter after a confirmed write (selected).
- Cost: no dependency, storage or background work. One forced bounded scan per confirmed write.
- Boundary changes: none to SQLite, IPC, preload, security or network. The existing
  `getLlmWikiStatus({ arxivId, refresh: true })` API is reused.
- Kill criterion: stop if the change needs a new IPC method, a watcher, or a cross-window event bus.
- Decision: proceed.

## Capability Contract

- Objective: a confirm attempt that ends (receipt or error) triggers one forced status recheck in
  every main-window reader that shows the same arXiv ID.
- Goals:
  - G1: Discover and Saved readers that show the promoted arXiv ID refresh with `refresh: true`.
  - G2: readers that show another paper or a non-paper item do not refresh.
  - G3: a cancelled preview does not refresh (no write occurred).
  - G4: a confirm error also refreshes, because a failed or partial write can still change disk state.
  - G5: a `recorded` status with a linked note presents Open in Obsidian as the primary action.
  - G6: a record-only status explains that no L1/L2 note exists and points to the existing
    `Preview llm-wiki promotion` action. The preview decides whether the note can be added; the
    text does not promise success.
  - G7 (added after review): a write recheck that runs while Open in Obsidian is pending does not
    leave Open or Recheck disabled.
- Non-goals: list badges, new buttons, main-side cache invalidation API, separate record windows
  (they read without cross-window updates and keep their Recheck), Web fallback renderer, vault writes.
- Interfaces: `NativeModals` accepts an optional `onPromotionSettled(arxivId)` callback.
  `NativeScreen` gains an optional `llmWikiChanged(arxivId)` method; Discover and Saved delegate
  to `ResearchReader`, which delegates to `WikiStatus.refreshIfShowing(arxivId)`. No public API change.
- Data ownership and evidence semantics: unchanged. The status remains a bounded observation with
  its check time; the receipt alone still never establishes membership.
- Failure states: the refresh uses the existing error and stale-response handling. A refresh
  failure shows the existing error text and leaves Recheck available.
- Migration and rollback: no migration. Revert the scoped source, test and doc changes.
- Observability: the existing "Checked <time>" label shows the new observation time.
- Allowed scope: `src/main/appkit/{modals,wikiStatus,reading,discover,saved,presenter,common}.ts`,
  their tests, this directory, and status docs. Preserve the uncommitted work already on
  `codex/llm-wiki-state`.
- Persistent writeback: this contract; PRIORITIES.md and GOALS.md status lines.

## Uncertainty Reducer

- Change class: small behavior change in the native UI flow (defect-like gap in an existing flow).
- Chosen artifact: failing presenter-level and unit tests with deterministic API fakes.
- Question: does a confirmed write reach the visible reader state without manual action?
- Does not prove: a live promotion, real vault scan timing, or human acceptance.

## Frozen Acceptance Contract

- RED verifier and expected failure:
  - `wikiStatus.test.ts`: `refreshIfShowing` does not exist; Open has no primary emphasis;
    record-only text has no hint.
  - `wikiRefresh.test.ts`: the settle callback is never called after confirm.
  - Presenter integration: after confirm, `getLlmWikiStatus` is not called with `refresh: true`
    and the reader still shows the old state.
- Focused cases: G1–G6 above, including the error path and the cancel path.
- Migration/rollback cases: none (no durable state).
- E2E/manual path: native fixture workflow groups (`npm run check` includes the AppKit suite).
  A live promotion remains a separate user-confirmed action (P0-1).
- Screenshot/accessibility matrix: the status text stays textual; emphasis changes only the button
  style. No new screenshot is required for this behavior change; native smoke runs if available.
- Security/dependency impact: none.
- Package/install/live opt-in impact: none; no install.
- Full verifier: focused Vitest files, `npm run check`.
- Stop condition: RED then GREEN for all focused cases, `npm run check` exit 0, diff review with
  no open high-severity finding.

### Acceptance-change log

| Date       | Contract change                                                                                                                      | Evidence/reason                                                                                | Reviewer     |
| ---------- | ------------------------------------------------------------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------- | ------------ |
| 2026-10-29 | Presenter test reads the sheet from the scene `modal` tree.                                                                          | The first lookup searched only `root`; this was a test lookup error, not an acceptance change. | Agent        |
| 2026-10-29 | Added G7: a write recheck during a pending Open must not leave Open/Recheck disabled. Added a disposal case for the settle callback. | Separate diff review, low findings 1 and 2. G7 failed RED before the fix.                      | Agent review |

## Independent Review

A separate agent review of the scoped hunks found no critical, high or medium issue. It confirmed
that the preview and reader arXiv IDs are both version-free, that the ID is captured before the
preview is cleared, and that the tests fail when the wiring breaks. Its low findings were: (1) a
recheck during a pending Open could leave Open/Recheck disabled; (2) no test for the disposal
guard; (3) contract bookkeeping. All three are fixed. This is agent review, not human acceptance.

## Evidence Closeout

- Changed files: `src/main/appkit/{modals,wikiStatus,reading,discover,saved,presenter,common}.ts`,
  `src/main/appkit/wikiStatus.test.ts`, new `src/main/appkit/wikiRefresh.test.ts`, `PRODUCT.md`,
  `GOALS.md`, `docs/audits/2026-10-28-llm-wiki-status/PRIORITIES.md`, this contract.
- Deliberately untouched: IPC, preload, SQLite, the core library cache, record windows, the Web
  fallback renderer, the llm-wiki vault.
- Focused RED/GREEN: G1–G6 failed for the expected reason (no callback; reader kept the old
  state; no `refreshIfShowing`; no primary emphasis or hint), then passed. G7 failed RED
  (`enabled` was `false`), then passed. Mutation checks: removing the Saved delegation and
  removing the disposal guard each make a test fail.
- `npm run check`: exit 0 on the final code. Main suite 121 files / 838 tests (statements
  91.46%, branches 83.01%, functions 94.91%, lines 94.14%); AppKit suite 33 files / 189 tests
  (89.6%, 84.32%, 86.85%, 92.08%). Log: `test-results/p0-2-check.log`.
- Native fixture smoke (`npm run smoke:appkit`): the first run passed 14 groups. It then stopped in
  the unrelated Saved snapshot group: the app was not the active app (`appActive=0`). The retry
  passed all 16 workflow groups and 20 control groups. The retry was built before the G7 fix, so
  it does not cover G7; the unit and full gates cover G7. Logs: `test-results/p0-2-smoke-appkit*.log`.
- Live opt-in checks not run: real promotion, real vault scan after a write, human
  mouse/keyboard/VoiceOver acceptance.
- Residual risks: record windows keep showing their last observation until Recheck. The main scan
  cache is refreshed only by the forced recheck of a shown reader.
- Rollback path: revert the listed files; no data migration.
- Git/install/push/publication state: not committed, not installed, not pushed.
