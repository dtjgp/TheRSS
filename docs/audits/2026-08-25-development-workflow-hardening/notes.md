# Notes: TheRSS Development Workflow Hardening

## User decision

- Adopt the agreed eight-stage TheRSS workflow.
- Repair current framework violations that can be proven from the live checkout.

## Evidence

- Current checkout started clean on `main` at `65c6841`, aligned with `origin/main`; this task added
  only scoped working-tree files/edits.
- The existing governance required TDD, 80% coverage, change review, deterministic fixtures, and
  release gates, but did not provide one canonical Feature Intake/Capability Contract workflow.
- `npm run check` did not enforce the repository's existing 800-line source boundary.
- Objective current violations under `src/`: `src/core/integrations/llmWikiVaultAdapter.ts` (1528),
  `src/renderer/src/App.test.tsx` (1154), and `src/core/storage/researchRepository.ts` (1001).
- The existing storage-decomposition commit already preserved the facade API and recorded 328 tests
  plus Playwright 2/2, but deliberately left the Discover/items core for a focused follow-up.
- The llm-wiki adapter is a security- and data-integrity-critical boundary; its split must preserve
  fail-closed path checks, lease handling, exact rollback, and public test imports.

## Workflow setup

- `docs/DEVELOPMENT_WORKFLOW.md` is the canonical eight-stage workflow.
- `docs/templates/CHANGE_CONTRACT.md` combines Feature Intake, Capability Contract, uncertainty
  reduction, frozen acceptance, review, and closeout in one reusable artifact.
- `AGENTS.md`, `GOALS.md`, `docs/ENGINEERING_PRACTICES.md`, and the root status plan route current
  work through the new workflow.

## RED/GREEN implementation evidence

- RED 1: focused policy test failed because `sourceFilePolicy` did not exist.
- GREEN 1: policy unit tests passed 2/2 after the scanner was implemented.
- RED 2: the live architecture CLI reported exactly three oversized files.
- Storage GREEN: Discover snapshot/result persistence moved into `discoverSnapshotStore.ts`;
  `ResearchRepository` fell from 1001 to 679 lines. Four focused storage suites passed 29/29 and
  TypeScript passed.
- Renderer-test GREEN: App tests were separated by Discover versus shell/Settings/Saved concerns
  with a shared fixture module. Both suites passed 32/32; TypeScript identified and then passed
  after restoring one type-only import.
- llm-wiki GREEN: the adapter is now a 90-line facade over focused types, prepare, confirm, and
  fail-closed support modules. Four llm-wiki/runtime/storage suites passed 40/40 and TypeScript passed.
- `npm run check:architecture` now passes with every enforced source/test file at or below 800 lines.

## Final verification and review

- Final full gate: 54 test files / 330 tests passed; coverage was 90.46% statements, 80.59%
  branches, 94.05% functions, and 93.37% lines; Electron main/preload/renderer and MCP builds passed.
- Electron E2E passed 2/2 on the approved desktop-permission rerun. The initial sandbox launch
  failure was `SIGABRT` / `kill EPERM` and did not reach application behavior.
- Production `npm audit --omit=dev --audit-level=high`: zero vulnerabilities after the approved
  network retry.
- Added-line credential/private-key scan, `console.log`/`debugger` scan, and `git diff --check` were
  clean. No dependency or SQLite schema change was introduced.
- The public `ResearchRepository` method-name inventory is unchanged. The App test-title inventory
  is unchanged after the split. TypeScript plus the existing llm-wiki adapter suites preserve its
  public exports and fail-closed behavior.
- Independent review found no critical/high issue. One unused exported receipt-options type created
  during extraction was removed. Module dependencies flow facade -> prepare/confirm -> support/types;
  no adapter/support cycle was introduced.

## Residual boundaries

- No live llm-wiki promotion, source/provider request, package smoke, installation, commit, push, or
  publication was run: the refactor does not change those surfaces and those actions require
  separate authorization or opt-in evidence.
- The automated line limit intentionally covers owned `.ts`/`.tsx` files under `src/`; generated
  declarations are excluded, and any future exception requires an ADR.
- `llmWikiVaultSupport.ts` is the largest remaining enforced file at 738 lines; the new gate will
  fail before it crosses 800.
