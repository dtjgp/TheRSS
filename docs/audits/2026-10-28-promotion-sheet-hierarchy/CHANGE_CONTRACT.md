# TheRSS Change Contract: llm-wiki promotion sheet hierarchy

## Feature Intake

- User outcome: in the native promotion sheet, the user sees what TheRSS will write and what blocks
  the write before the technical provenance. The sheet buttons follow the macOS sheet order.
- Observed problem/evidence: `src/main/appkit/modals.ts` shows the preview as one rich-text block.
  The block mixes the title, destination, paths, blockers, PDF SHA-256, source hash, contract hash
  and expiry. The confirm button sits in the content area. The cancel button sits in the footer.
  The busy state is a text label without a progress indicator. The receipt status is one text line.
- Product fit and relevant non-goal: improves an existing confirmation-gated flow (ADR 0008).
  It adds no capability and no new write path.
- Alternatives considered, including no change: (a) no change; (b) reorder the single rich-text
  block; (c) structured nodes with the existing native kinds. (c) gives real hierarchy at low cost.
  An in-sheet final confirmation (removing the system alert) changes ADR 0008 and is out of scope.
- Cost: implementation small / runtime none / maintenance low / external service none.
- Boundary changes: none. No IPC, SQLite, security, network, package or native bridge change.
- Kill criterion: the native layout cannot right-align the footer or the structured nodes clip in
  the sheet at the default window size.
- Decision: proceed (user approved items 1 and 2 on 2026-10-28).

## Capability Contract

- Objective: restructure the native promotion sheet content and move its actions to the footer.
- Goals:
  1. Summary block first: paper title, destination with review level, routing rationale.
  2. Blockers next, with a symbol and a bold count when present; "No blockers" when none.
  3. "Will write N files" heading with the complete intended path list.
  4. Evidence boundary.
  5. "Technical details" last: PDF page count, byte size, SHA-256, source hash, contract hash,
     expiry.
  6. Native indeterminate progress indicator while busy.
  7. Receipt: a bold, human-readable status line, then the existing receipt details.
  8. Footer row, right aligned: secondary actions, then `Cancel preview`/`Close`, then the primary
     `Write to llm-wiki…` button with primary emphasis.
- Non-goals: removing the final system alert; semantic tint for native symbols (needs a bridge
  field); Web fallback (`PaperPromotionAction.tsx`) layout; any change to preview or receipt data.
- Interfaces and public API invariants: node ids `modal-close`, `promotion-confirm`,
  `promotion-new-preview`, `promotion-receipt-text` stay. `promotion-confirm` keeps no Return
  shortcut. Document sheets keep Return on `Close`.
- Data ownership and evidence semantics: every preview and receipt field shown today stays visible
  with the same value. Nothing is shortened or rewritten. Status text maps each of the eight
  receipt statuses to a distinct phrase.
- Failure states: blocked previews (no confirm button, blockers listed), partial/failed/blocked
  receipts, error message label, busy state. All remain distinct.
- Migration and rollback: none; revert the commit.
- Observability/diagnostics: unchanged.
- Allowed scope: `src/main/appkit/modals.ts`, `src/main/appkit/modals.test.ts`,
  `scripts/smoke-native-appkit.mjs` node lookups, this contract, README/USER_GUIDE text if it names
  the old button label.
- Persistent writeback: none.

## Uncertainty Reducer

- Change class: UI flow refinement (existing flow, new layout).
- Chosen artifact: focused tests on the native node tree plus a fresh native render of the sheet.
- Question it must answer: does the native row layout right-align the footer and does the content
  stay readable in the sheet?
- What it does not prove: VoiceOver reading order beyond node order; dark-mode contrast beyond the
  system label colors already used.

## Frozen Acceptance Contract

- RED verifier and expected failure: new `modals.test.ts` cases fail because `promotion-summary`,
  `promotion-paths`, `promotion-technical`, `promotion-progress-indicator`,
  `promotion-receipt-status` do not exist and `promotion-confirm` is not in `modal-footer`.
- Focused unit/integration cases:
  - every intended path in `promotion-paths`; path count in `promotion-paths-heading`;
  - hashes and PDF data only in `promotion-technical`, which comes after the paths;
  - blockers shown with count; "No blockers" when empty; blocked preview has no confirm button;
  - footer order and primary emphasis; confirm has no Return shortcut;
  - progress indicator only while busy;
  - receipt status phrase for each status.
- Migration/rollback cases: none.
- E2E/manual path: `npm run smoke:appkit` (promotion preview, cancel, write, stress).
- Screenshot/viewport/accessibility matrix: native sheet in light appearance at default size;
  symbol has an accessible title.
- Security/dependency impact: none.
- Package/install/live opt-in impact: none.
- Full verifier: `npm run check` and `npm run smoke:appkit`.
- Stop condition: all of the above pass and the rendered sheet shows the new order.

### Acceptance-change log

| Date       | Contract change                                                                           | Evidence/reason                                       | Reviewer |
| ---------- | ----------------------------------------------------------------------------------------- | ----------------------------------------------------- | -------- |
| 2026-10-28 | `modals.test.ts` path assertion moves from `promotion-preview-text` to `promotion-paths`. | The single preview text node is split by this change. | user     |
| 2026-10-28 | Native smoke reads paths from `promotion-paths` and SHA-256 from `promotion-technical`.   | Same split; the asserted content is unchanged.        | user     |

## Implementation Slices

1. RED: add the focused cases above.
2. Minimal GREEN: restructure `promotionContent()` and the footer in `modals.ts`.
3. Refactor: keep `modals.ts` small; extract text helpers only if they make the render clearer.
4. Next slice gate: item 3 (in-sheet final confirmation) needs an ADR 0008 revision first.

## Independent Review

- Product/contract fit: one fresh-context review round. Every preview and receipt field from the
  previous version is still shown with the same value; only wording changed ("PDF:" prefix,
  "No blockers", "No paths approved", status phrase instead of the raw enum).
- Accidental scope or complexity: none; the diff stays in the allowed files.
- Test weakening: none beyond the two logged locator changes.
- Input/secret/untrusted-content boundaries: same or safer. Title, rationale and evidence boundary
  are now plain labels instead of rich text with link activation. Receipts are schema-validated
  before display, so the status map cannot receive an unknown value.
- SQLite/IPC/migration/rollback: unchanged.
- Diagnostics/package/update impact: none.
- Findings and resolutions: L2 (destination label could clip) fixed with `wrap: true`. L1 (the
  empty footer spacer label may be announced by VoiceOver; below about 400 pt sheet width the row
  wrap ignores `flex`) kept as a residual risk because a fix needs a native bridge change.

## Evidence Closeout

- Changed files: `src/main/appkit/modals.ts`, `src/main/appkit/modals.test.ts`,
  `scripts/smoke-native-appkit.mjs`, this contract.
- Deliberately untouched files: `src/main/windowApplicationRuntime.ts` (system alert),
  `native/appkit/*`, Web fallback `src/renderer/src/PaperPromotionAction.tsx`, README/USER_GUIDE
  (no reference to the old label).
- Focused RED/GREEN: 13 cases failed before the change for the expected reasons (missing nodes,
  old footer); 16/16 `modals.test.ts` cases pass after it.
- `npm run check:architecture`: passed as part of `npm run check`.
- `npm run check`: exit 0; 803 unit and 175 AppKit tests passed; coverage above 80% on every metric.
- Electron E2E/rendered evidence: first local `npm run smoke:appkit` run passed all promotion steps
  (preview capture, cancel, write) and produced `test-results/appkit-native/promotion-preview.png`
  with the new order and a right-aligned footer. The run later stopped at an unrelated Saved step
  because the app lost key-window status (`appActive=0`). A second local run stopped earlier at the
  Discover source picker with the window on Sources. Both stops are local desktop-focus
  interference; the clean CI `desktop` job runs the same smoke and is the required evidence.
- Security/dependency/migration/package evidence: no dependency, IPC or storage change.
- Live opt-in checks not run: live vault write (fixture only).
- Residual risks/blockers: L1 above. The primary button rendered grey in the local capture because
  the window was inactive; the capture reports `emphasis: primary` with a 5.87:1 title contrast.
- Rollback path: revert the commit.
- Git/install/push/publication state: uncommitted on `claude/promotion-sheet-hierarchy`.
