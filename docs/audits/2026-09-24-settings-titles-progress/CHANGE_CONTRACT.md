# Change Contract: Settings section titles and native Discover progress

Scope authority: on 2026-09-24 the user asked to commit the smoke reliability work and "开始做
Settings 标题和进度条" (audit follow-ups F13 remainder and F6 in the
[UX audit](../2026-09-23-apple-native-ux/REPORT.md)).

## Feature Intake

- User outcome: Settings names its section once; a running Discover search shows native,
  truthful progress instead of a single text line.
- Observed problems:
  1. Settings shows the "Settings section" pop-up (`Personal context` / `Model provider`) and
     directly below it a 23 pt heading with the same text (`personal-title`, `provider-title`).
  2. Native Discover progress is one label ("Searching sources: n/m · source"). PRODUCT.md
     promises a three-stage Plan query -> Search selected sources -> Assemble session pipeline
     with native source progress and the latest completed-source outcome; only the Web fallback
     (`DiscoverRunStatus.tsx`) implements it. No native test covers progress rendering.
- Product fit: PRODUCT.md Discover run contract; UI skill rows Feedback and Visual hierarchy.
- Alternatives: text-only stage labels (no native progress affordance); a custom-drawn bar
  (rejected: system control exists).
- Boundary changes: one bounded `progress` node kind in the typed presentation contract; shared
  run-progress wording moves to `src/shared`. No IPC, SQLite, network or package change.
- Kill criterion: stop if truthful stage/outcome wording would need data the progress events do
  not carry.

## Capability Contract

- G1: the Settings pane headings that repeat the selected section title are removed. The
  "Local agents" sub-section heading stays.
- G2: `progress` node: `NSProgressIndicator` bar; determinate when `completed`/`total` are given
  (integers, `0 <= completed <= total`, `total >= 1`), otherwise indeterminate; accessibility
  label from `title`, accessibility value `"<completed> of <total>"` when determinate.
- G3: while a Discover run is active the native page shows a `discover-run` group: headline,
  `Step n of 3: <stage>`, the progress bar and a detail line (latest completed source outcome
  with result count, the queued count before any source finishes, or the cancellation copy).
  Planning and assembly are indeterminate; source search is determinate.
- G4: stage/headline/detail wording comes from one shared module used by the native route and
  the Web fallback; Web behaviour and its tests are unchanged.
- Non-goals: moving progress into the toolbar, changing cancellation, per-source lists.
- Allowed scope: `src/shared/discoverRunProgress.ts` (+ test), `src/renderer/src/DiscoverRunStatus.tsx`
  (import only), `src/main/appkit/{presentation,discover,settings}.ts` and tests,
  `native/appkit/node.mm`, `scripts/smoke-appkit-controls.mjs`, this directory.

## Frozen Acceptance Contract

- RED (unit): shared progress model cases (planning, searching with and without a latest
  outcome, all finished, cancel requested); presentation accepts a valid determinate/
  indeterminate `progress` and rejects `completed > total`, non-integers and progress fields on
  other kinds; Discover renders the run group for planning/searching/cancel; Settings has no
  heading equal to the selected section title.
- RED (native): controls smoke asserts `NSProgressIndicator`, determinate values, indeterminate
  state and accessibility value.
- Full verifier: `npm run check`; controls smoke (screenshots on); workflow smoke 14/14.
- Stop condition: G1-G4 verified, no existing assertion weakened.

### Acceptance-change log

| Date | Contract change | Evidence/reason | Reviewer |
| ---- | --------------- | --------------- | -------- |

## Independent Review

- Fit: G1-G4 met. Headline, stage and detail wording now come from
  `src/shared/discoverRunProgress.ts`; the Web fallback imports it and its 6 existing
  `DiscoverRunStatus` tests pass unchanged.
- Assertions: none weakened; no existing assertion edited.
- Boundaries: `progress` accepts only integer `completed <= total` on progress nodes (zod
  `superRefine`); no IPC, SQLite, network or package change.
- Behaviour change to note: the native cancellation copy changed from "Cancellation requested;
  waiting for the run to settle." to the shared "Canceling Discover search" / finished-count
  wording already used by the Web fallback.
- Accessibility: the bar exposes its title and a `"3 of 22"` value; with Reduce Motion the
  indeterminate bar does not animate (not exercised by a test: the fixture cannot toggle the
  system preference).
- Residual: the native workflow smoke still does not observe an in-flight run; progress rendering
  is covered by unit tests plus the controls-smoke fixture.

## Evidence Closeout

- Changed files: `src/shared/discoverRunProgress.ts` (+ test, new),
  `src/renderer/src/DiscoverRunStatus.tsx`, `src/main/appkit/{presentation,discover,settings}.ts`
  and tests, `native/appkit/node.mm`, `scripts/smoke-appkit-controls.mjs`.
- RED/GREEN: shared model (module missing), presentation, Discover run, cancel headline and
  Settings heading tests failed first and pass; controls smoke failed with `TRNode` instead of
  `NSProgressIndicator` and passes 10/10.
- `npm run check`: exit 0 (701 main, 110 AppKit tests; coverage above 80% on all axes). The first
  run failed only the format gate on this contract.
- Native smoke: controls with screenshots 10/10; workflow 14/14 with and without screenshots.
- Not run: package/install, VoiceOver, live providers/sources.
- Rollback: revert the slice commit. Git: uncommitted; installed app not updated.
