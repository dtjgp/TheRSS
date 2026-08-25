# TheRSS Development Workflow Hardening Report

Date: 2026-08-25
Status: complete locally; not committed, installed, pushed, or published

## Outcome

The agreed workflow is now an executable project contract rather than conversational guidance.
TheRSS routes non-trivial work through Feature Intake, Capability Contract, uncertainty reduction,
frozen acceptance, TDD, automated/rendered verification, independent review, and evidence closeout.
An architecture gate now prevents owned TypeScript/TSX files above 800 lines from passing
`npm run check`.

No product behavior, public repository facade, SQLite schema, IPC contract, external service, or
package/install state changed.

## Durable workflow setup

- `AGENTS.md` defines when the workflow and template must be read.
- `docs/DEVELOPMENT_WORKFLOW.md` owns classification and the eight-stage process.
- `docs/templates/CHANGE_CONTRACT.md` is the reusable Feature Intake, Capability Contract,
  acceptance, review, and closeout artifact.
- `docs/ENGINEERING_PRACTICES.md` defines independent review and the enforced source boundary.
- `GOALS.md` and the root plan record the concrete verifier and completion state.
- `src/core/architecture/sourceFilePolicy.ts` plus `scripts/check-source-size.ts` implement the
  fail-closed line-limit check; `package.json` runs it before the existing full gate.

## Repaired objective violations

| Area               |     Before |                                                                    After | Behavior contract                                                                    |
| ------------------ | ---------: | -----------------------------------------------------------------------: | ------------------------------------------------------------------------------------ |
| llm-wiki adapter   | 1528 lines |                            90-line facade; focused modules 148–738 lines | Existing exports, preflight, lease, verifier, rollback, and disposal tests preserved |
| ResearchRepository | 1001 lines |                                679-line facade + 375-line Discover store | Public method inventory and SQLite migration behavior unchanged                      |
| App test           | 1154 lines | 405-line Discover suite + 518-line shell suite + 255-line shared fixture | Exact test-title inventory preserved                                                 |

The largest remaining enforced source is `llmWikiVaultSupport.ts` at 738 lines. Every owned
`.ts`/`.tsx` file under `src/` is now at or below 800 lines.

## TDD evidence

- RED 1: the focused policy test failed because the scanner module did not exist.
- GREEN 1: policy tests passed 2/2 after the minimal scanner implementation.
- RED 2: the live architecture CLI reported the three exact oversized files above.
- Storage GREEN: four suites, 29/29 tests.
- Renderer-test GREEN: two suites, 32/32 tests.
- llm-wiki/runtime/storage GREEN: four suites, 40/40 tests.
- Final architecture policy: passed with zero violations.

## Full verification

- `npm run check`: passed.
- Vitest: 54 files / 330 tests passed.
- Coverage: 90.46% statements, 80.59% branches, 94.05% functions, 93.37% lines.
- Formatting, ESLint, TypeScript, Electron main/preload/renderer build, and MCP build: passed.
- Electron E2E: 2/2 passed on the approved desktop-permission rerun.
- Production dependency audit: zero vulnerabilities.
- Added-line credential/private-key scan, debug-output scan, and `git diff --check`: clean.

## Independent review

- Contract fit: behavior-preserving governance and decomposition only; no adjacent feature added.
- Test integrity: no App test title was lost or added during mechanical splitting; existing
  storage/migration and llm-wiki failure-path suites remain green.
- Public surface: `ResearchRepository` public method inventory is identical; adapter exports remain
  available through the facade and TypeScript build.
- Security/data: path confinement, symlink checks, runtime hash, writer lease, exact-content
  rollback, and secret-handling code moved without semantic weakening; no schema or dependency
  change occurred.
- Module graph: facade -> prepare/confirm -> support/types; no circular adapter/support dependency.
- Review cleanup: removed an unused exported receipt-options type created during extraction.
- Critical/high findings: none remaining.

## Evidence boundaries and rollback

- No live llm-wiki write, source/provider request, package smoke, installation, Git commit, push, or
  publication was performed. These were outside the behavior-preserving scope and remain separately
  authorized or opt-in actions.
- The first sandboxed E2E launch failed before application behavior with `SIGABRT` / `kill EPERM`;
  the approved desktop rerun passed and is the accepted evidence.
- All changes remain uncommitted in the aligned local `main` working tree and can be reviewed or
  reverted through the normal Git diff; unrelated remote or installed state was untouched.
