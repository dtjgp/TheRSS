# Engineering Practices

## Purpose

TheRSS applies published Google engineering-practice principles in a form suitable for a single-maintainer open-source project. This is a project policy, not a claim that Google provides one universal project-management template.

## Source principles

- Google states that code review should improve overall code health while allowing progress: <https://google.github.io/eng-practices/review/reviewer/standard.html>
- Google recommends small, self-contained changes, related tests in the same change, and a continuously working build: <https://google.github.io/eng-practices/review/developer/small-cls.html>
- Google review guidance covers design, functionality, complexity, testing, naming, documentation, and context: <https://google.github.io/eng-practices/review/reviewer/looking-for.html>

## TheRSS operating model

### Design before broad implementation

Cross-cutting features require a short design document or Architecture Decision Record containing:

- context and user outcome;
- goals and non-goals;
- alternatives considered;
- interfaces and data ownership;
- security/privacy implications;
- failure, migration, rollback, and observability;
- test and launch plan.

### Small changes

- One change should deliver one coherent behavior and its tests.
- Refactoring is separated from feature behavior when separation improves reviewability.
- Generated lock files and mechanical scaffolding are identified explicitly.
- Every commit keeps the app buildable and the deterministic test suite runnable.

### Review standard

A change is acceptable when it measurably improves the product/codebase and passes its relevant gates. Perfection is not required, but known correctness, security, evidence, or data-loss defects cannot be deferred as polish.

### Quality gates

| Gate | Per change | Release |
|---|---:|---:|
| Formatting/lint | Required | Required |
| Type checking | Required | Required |
| Relevant unit/integration tests | Required | Required |
| Global coverage >= 80% | Monitored | Required |
| Critical E2E | When flow changes | Required |
| Dependency audit | When dependencies change | Required |
| Security review | When boundary changes | Required |
| Package/smoke/update validation | When packaging changes | Required |

### Planning and status

- `GOALS.md` defines durable objective, verifier, and stop condition.
- `task_plan.md` tracks active execution and errors.
- `docs/ROADMAP.md` records milestones and exit gates.
- `docs/REQUIREMENTS_TRACEABILITY.md` prevents partial work from being called complete.
- ADRs under `docs/decisions/` preserve consequential technical choices.

### Incident and bug practice

- Reproduce first with a failing test or inspectable artifact.
- Fix the smallest root cause.
- Add regression coverage.
- Record user/data impact and rollback requirements.
- Use a short blameless incident note for data loss, security exposure, broken updates, or repeated source failures.
