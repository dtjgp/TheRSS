# Task Dispatch Spec

- **Task Title**: <concise task title>
- **Assigned Role**: `<native-ui | core-retrieval-storage | ai-wiki-integration | qa-security-reviewer | release-devops>`
- **Change Contract**: `<path to docs/audits/.../CHANGE_CONTRACT.md or quick-path justification>`
- **Base Branch / Commit**: `<branch / sha>`

## Objective

<1–3 sentences describing the exact user-visible or technical outcome required.>

## Frozen Interfaces & Inputs

- <List frozen `src/shared/` schemas, IPC methods, SQLite tables, or ADRs this task must obey without changing.>

## Allowed Edit Scope

- `<explicit file or directory paths this worker may modify>`

## Explicitly Out of Scope (Do Not Touch)

- `<adjacent files, hotspot contracts, unrelated refactors, or deferred features>`

## Acceptance Criteria & RED/GREEN Plan

1. **RED**: <exact failing test or reproduction to write/run first>
2. **GREEN**: <minimal coherent implementation behavior>
3. **Invariants**: <security, evidence, coverage >=80%, <=800 lines, rollback invariants>

## Required Verification Commands

- `<focused test command>`
- `npm run check`
- `<any proportional e2e/appkit/smoke command>`

## Required Delivery Report

Return:

1. Summary of changes and exact modified file list
2. RED → GREEN and full-gate command outputs (pass/fail + counts)
3. Deliberately untouched files and checks not run (with reason)
4. Residual risks and rollback steps
