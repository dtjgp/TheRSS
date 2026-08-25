# TheRSS Change Contract

Copy this template into the task's durable work directory. Remove instructional placeholders before
implementation.

## Feature Intake

- User outcome:
- Observed problem/evidence:
- Product fit and relevant non-goal:
- Alternatives considered, including no change:
- Cost: implementation / runtime / maintenance / external service:
- Boundary changes: architecture / SQLite / IPC / security / network / package:
- Kill criterion:
- Decision: proceed / spike / prototype / defer / reject

## Capability Contract

- Objective:
- Goals:
- Non-goals:
- Interfaces and public API invariants:
- Data ownership and evidence semantics:
- Failure states:
- Migration and rollback:
- Observability/diagnostics:
- Allowed scope:
- Persistent writeback:

## Uncertainty Reducer

- Change class:
- Chosen artifact: interactive prototype / technical spike / failing reproduction / invariant matrix
- Question it must answer:
- What it does not prove:

## Frozen Acceptance Contract

- RED verifier and expected failure:
- Focused unit/integration cases:
- Migration/rollback cases:
- E2E/manual path:
- Screenshot/viewport/accessibility matrix:
- Security/dependency impact:
- Package/install/live opt-in impact:
- Full verifier:
- Stop condition:

### Acceptance-change log

Record any later test or acceptance edit before making it.

| Date | Contract change | Evidence/reason | Reviewer |
| ---- | --------------- | --------------- | -------- |

## Implementation Slices

1. RED:
2. Minimal GREEN:
3. Refactor:
4. Next slice gate:

## Independent Review

- Product/contract fit:
- Accidental scope or complexity:
- Test weakening:
- Input/secret/untrusted-content boundaries:
- SQLite/IPC/migration/rollback:
- Diagnostics/package/update impact:
- Findings and resolutions:

## Evidence Closeout

- Changed files:
- Deliberately untouched files:
- Focused RED/GREEN:
- `npm run check:architecture`:
- `npm run check`:
- Electron E2E/rendered evidence:
- Security/dependency/migration/package evidence:
- Live opt-in checks not run:
- Residual risks/blockers:
- Rollback path:
- Git/install/push/publication state:
