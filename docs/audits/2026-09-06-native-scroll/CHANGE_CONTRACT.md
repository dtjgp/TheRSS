# Native scroll continuity repair

## Feature Intake

- User outcome: repair the reviewed native scroll-loss defect without changing visible product scope.
- Evidence: installed a90d018, integer 39 CSS-pixel horizontal input below a 68-pixel boundary. Strict repeated synthetic AppKit sequences moved 37,37,37,38,39 pixels; one run delivered 27 of 28 nonzero packets to renderer. Original trace remains in the task-local native-trackpad-verification-20260906 record.
- Product fit: reliable navigation and reading; no source/ranking/data/analysis behavior change.
- Alternatives: retain the defect; broadly relax all stale-event checks (rejected); keep bounded semantic validity for scroll while preserving exact layout validity for discrete actions (selected). No dependencies or external service cost.
- Boundaries: one validated numeric state field at existing IPC; no new endpoint, native pointer, database migration, network operation or native event method.
- Kill criterion: reject any repair that accepts old item/window/modal input, leaks unbounded history, or weakens delta conservation to hide a failure.

## Capability Contract

- Objective: preserve every valid scroll delta through geometry-only presentation updates.
- Add `scrollRevision`, the first layout revision of the current semantic scroll context. Native events retain their existing emitted revision. Scroll may cross geometry revisions only within the current context's validated revision range; click/key/focus remains exact-revision.
- Renderer retains the last validated scroll target during same-context presentations, with current DOM identity/root, viewport/scale, visible connected control and modal guards. Initial, changed or rejected contexts wait for successful native presentation.
- Advance the scroll floor on item/view/root, viewport/scale or modal changes, and after suspension/rejection/release. Main validates the floor and known lifecycle barriers. No queue or replay is introduced.
- Observed context invalidation is permanent for that floor, even if the DOM or zoom returns to its previous value before the ACK. A bounded main-to-renderer `scroll-reset` notification requests a fresh context after a live zoom interruption; the native event ABI remains unchanged. Resize and observed DOM barriers also force revalidation.
- Scope: shared state/schema, main session, renderer projection/hook, nearest tests, native fixture regression and task evidence. Existing native binary ABI and database/provider contracts remain intact.
- Rollback: revert this repair; web fallback remains available. Existing authorization for verified main-only delivery and local replacement remains in force. User-requested removal of this task's app/database backups also remains in force; no installer-policy change.

## Uncertainty Reducer

Bug-fix RED tests model both acknowledgment windows and the native-to-main stale-layout callback. The recorded real AppKit synthetic sequence independently measures final displacement. It does not prove physical trackpad hardware/driver behavior.

## Frozen Acceptance

- Renderer: same-context deltas before and after pending layout acknowledgment are conserved, including native events from the just-applied revision; stale clicks/keys stay blocked. Initial unacknowledged, different item/root, modal, viewport/zoom, detached/hidden target, rejection and cleanup do not accept old scroll.
- Main: old layout scroll within current context succeeds; future, previous-context and wrong-control scroll fails. Lifecycle/zoom changes advance the floor; old-generation callbacks remain invalid.
- Schema: bounded positive integer floor <= layout revision; main rejects regressions and invalid floor transitions.
- Additional review RED: modal/item/root/zoom A→B→A during a pending ACK cannot revive old scroll; the real session/hook contract must recover after transient main-process zoom interruption with unchanged final viewport.
- Integration: original strict 39-pixel repeated case at high event rate is exact at 100%; 200% zoom, vertical/reverse, horizontal clamp/momentum and stop behavior remain correct.
- Gates: focused RED/GREEN; npm run check; owned bridge coverage >=80% each dimension; Electron E2E, repeated source/package synthetic regression, package/installed smoke and independent review. No live provider/source/vault operations.
- Durable native regression: extend the existing fixture-only native action with a one-pixel horizontal event, then send 39 interleaved packets without per-packet acknowledgment waits. Repeat three times below the scroll boundary and require exactly 39 CSS pixels. The native production ABI and event format remain unchanged.
- Stop: regression conserved, guard tests and required gates green, evidence recorded; commit/publish/install only under existing authorized scope. Do not relabel synthetic success as physical hardware success.

## Execution

- RED and implementation: complete; two original regression failures plus three review-boundary failures reproduced before repair.
- Full gates and independent review: passed; 491 tests, desktop 6/6, packaged matrix 13/13, dependency audit 0 vulnerabilities.
- Package/install closeout: completed with matching hashes and successful installed smoke; new backup pair moved to Trash at user request. Git publication follows the protected-main path and is verified in the final delivery record.
