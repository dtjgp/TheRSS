# TheRSS Development Workflow

## Purpose

This is the canonical workflow for non-trivial TheRSS changes. It prevents an agent from turning a
plausible idea into unreviewed code, weakening tests to fit an implementation, or calling partial
evidence complete. Start from [`templates/CHANGE_CONTRACT.md`](templates/CHANGE_CONTRACT.md) and
store the completed contract with the task's durable plan and evidence.

Typos, formatting-only edits, and mechanically obvious one-line corrections may use the quick path:
read the nearest source/test, make the narrow change, run the relevant check, and review the diff.

## Change classification

Classify the change before implementation. When more than one class applies, use every required
artifact and gate.

| Change class                                         | Primary uncertainty reducer                    | Minimum verifier                                                                    |
| ---------------------------------------------------- | ---------------------------------------------- | ----------------------------------------------------------------------------------- |
| Product or cross-cutting capability                  | Feature Intake plus Capability Contract        | Focused tests, full check, relevant E2E/render/package gates                        |
| New or redesigned UI flow                            | Fixture-backed interactive prototype           | Component contract, viewport/keyboard/accessibility matrix, fresh rendered evidence |
| Architecture, storage, adapter, or security boundary | Bounded technical spike or executable contract | Integration/migration/security tests and rollback review                            |
| Bug fix                                              | Failing test or inspectable reproduction       | Regression test plus affected full gate                                             |
| Mechanical refactor                                  | Existing behavior/invariant matrix             | Unchanged public contract, focused tests, full check, diff review                   |
| Packaging or update change                           | Disposable package/install rehearsal           | Package smoke, backup/rollback and identity checks                                  |

A prototype is not mandatory for a storage refactor. A technical spike is not a substitute for
rendered evidence when the uncertainty is interaction design.

## 1. Feature Intake

Before adopting a change, record:

- user outcome and observed problem;
- fit with `PRODUCT.md`, including the relevant non-goal;
- alternatives, including doing nothing;
- engineering, runtime, maintenance, privacy, and external-service cost;
- architecture, storage, IPC, security, packaging, and migration boundaries that may change;
- a kill criterion that says when the work should stop or be removed.

Reject or defer work that lacks product fit, requires an unauthorized external boundary, or has no
credible verifier.

## 2. Capability Contract

Define one objective and one observable stop condition. Record goals/non-goals, interfaces, data
ownership, evidence semantics, failure states, migration/rollback, observability, allowed scope,
and persistent writeback. Use an ADR when a consequential architecture choice must outlive the task.

Use `GOALS.md` only for durable goals with executable verifiers. Small changes remain task-scoped.

## 3. Reduce uncertainty before production code

- UI uncertainty: build a deterministic, fixture-backed interaction prototype and review the
  information hierarchy, keyboard path, narrow/wide layouts, appearance, and failure states.
- Architecture uncertainty: run a bounded technical spike that answers one question without
  silently becoming production code.
- Defect uncertainty: reproduce with a failing test, log, screenshot, or data artifact.
- Refactor uncertainty: enumerate public APIs, persistence/migration invariants, and behavior tests
  that must remain unchanged.

Record what the artifact proves and what it does not prove. No live provider or external write is
implied by a fixture.

## 4. Freeze acceptance intent

Before implementation, define:

- RED tests and expected failure reason;
- integration and migration cases;
- E2E/manual path and required current-run screenshots;
- security, dependency, packaging, installation, and live opt-in impact;
- rollback evidence;
- exact verifier and stop condition.

Tests may change only when the reviewed contract changes or the test is proven incorrect. Record
that reason before editing the test. Never reduce an assertion merely to make an implementation pass.

## 5. Implement in small TDD slices

1. Run the focused RED verifier and record why it fails.
2. Implement the smallest coherent behavior.
3. Run the focused GREEN verifier.
4. Refactor while tests remain green.
5. Review scope before starting the next slice.

Do not add adjacent endpoints, providers, settings, migrations, or UI controls without returning to
Feature Intake. Keep public APIs stable during mechanical refactors unless the contract authorizes a
change.

## 6. Automated and rendered verification

Run gates in proportion to impact:

- focused unit/integration tests;
- `npm run check:architecture` and `npm run check`;
- `npm run test:e2e` for critical flow or renderer/main changes;
- security/dependency checks for input, secret, IPC, network, or dependency changes;
- migration and rollback checks for SQLite or durable files;
- fresh Electron screenshots and interaction inspection for user-visible changes;
- package/install/update smoke only when that surface changes;
- live providers and sources only as explicit opt-in verification.

An agent screenshot is supporting evidence, not proof of data correctness, accessibility compliance,
security, or package behavior.

## 7. Independent review and human QA

Run a separate diff review after implementation. Check product/contract fit, accidental scope,
complexity, test weakening, input validation, secrets, untrusted content, SQLite/IPC boundaries,
migration and rollback, diagnostics, packaging, and documentation.

Then perform the human black-box acceptance path. Human QA supplements the code and evidence review;
it never replaces them. Resolve critical/high findings before closeout.

## 8. Evidence closeout

Record:

- changed and deliberately untouched files;
- RED/GREEN, full-gate, E2E, rendered, security, migration, and package results;
- current versus historical or memory-derived evidence;
- opt-in checks not run;
- residual risks, blockers, and rollback path;
- Git/install/push/publication state.

Do not claim completion from a clean checkout, an agent statement, or one passing test. Installation,
Git push, release publication, live external calls, and third-party mutations remain separately
authorized actions.
