# Task Plan: TheRSS Development Workflow Hardening

## Goal

Make the agreed development workflow executable in TheRSS governance and repair current,
evidence-backed violations without changing product behavior.

## Task Contract

- Objective: Establish Feature Intake, Capability Contract, uncertainty-based validation, frozen
  acceptance intent, TDD, independent review, and evidence closeout as the project workflow.
- Evidence to read first: `AGENTS.md`, `PRODUCT.md`, `GOALS.md`, `docs/DESIGN.md`,
  `docs/ENGINEERING_PRACTICES.md`, current branch diff, storage tests, and current file metrics.
- Allowed scope: Project governance/docs, enforcement scripts/tests, and narrow behavior-preserving
  storage decomposition needed to satisfy the existing file-size boundary.
- Verifier: RED/GREEN focused tests, architecture-policy check, `npm run check`, Electron E2E,
  diff/security/storage review, and current file metrics.
- Stop condition: The workflow is documented and reusable; automated checks enforce objective
  structural rules; current owned source files satisfy the enforced limit; all relevant gates pass;
  any remaining judgment-only findings are explicitly recorded.
- Persistent writeback: This plan, `notes.md`, `implementation_report.md`, the canonical engineering
  workflow documentation, and existing project governance indexes where appropriate.

## Phases

- [x] Phase 1: Inspect governance, current branch, source structure, tests, and objective violations
- [x] Phase 2: Define the canonical change workflow and reusable intake/contract template
- [x] Phase 3: Add RED enforcement for objective architecture rules
- [x] Phase 4: Repair current violations with behavior-preserving TDD refactors
- [x] Phase 5: Run focused and full verification, review the diff, and document residual risks

## Key Questions

1. Which agreed workflow rules can be automated rather than left as prose?
2. Which current violations are objective and safely repairable in this branch?
3. How can storage decomposition preserve SQLite migration and public API behavior?

## Decisions Made

- Keep this task behavior-preserving; do not add product features, live calls, installation,
  publication, or external mutations.
- Treat UI prototypes as conditional on UI uncertainty, not a mandatory artifact for refactors.
- Preserve existing user work and the current branch history; make only working-tree changes.
- Enforce the 800-line limit across owned `.ts`/`.tsx` files under `src/`, including tests; exclude
  generated declarations and require an ADR for any temporary exception.
- Preserve `ResearchRepository`, `LlmWikiVaultAdapter`, and App test behavior through facade/test
  support modules rather than changing their consumer-facing contracts.
- Current execution is on `main` aligned with `origin/main`; do not commit, install, push, or
  publish without separate authorization.

## Errors Encountered

- The focused architecture-policy test failed RED because `sourceFilePolicy` did not exist. This was
  the intended pre-implementation failure and established the contract before the scanner.
- The first CLI check used `tsx` and hit its known sandbox IPC `EPERM`. The policy CLI now uses
  Node 24's native erasable TypeScript execution with an explicit `.ts` import, avoiding an IPC
  server rather than requesting broader permissions.
- After splitting the App tests, focused Vitest passed 32/32 but TypeScript found one missing
  `DashboardSnapshot` type import in the Discover test file. Restored the type-only import; no test
  behavior changed.
- The first full gate reached ESLint and found two type re-exports also imported into the adapter's
  local scope. Removed the unused local imports while keeping the public re-exports unchanged.
- The first Electron E2E run built successfully but both launches aborted inside the restricted
  desktop sandbox with `SIGABRT` / `kill EPERM`. The approved desktop-permission rerun passed 2/2;
  this is the established environment boundary, not an application failure.
- The sandboxed production dependency audit could not resolve `registry.npmjs.org`; the approved
  network retry completed with zero vulnerabilities.

## Status

**Complete** - The canonical workflow and template are durable, all enforced structural violations
are repaired, focused/full/Electron/security gates pass, and residual evidence boundaries are
recorded without changing product or external state.
