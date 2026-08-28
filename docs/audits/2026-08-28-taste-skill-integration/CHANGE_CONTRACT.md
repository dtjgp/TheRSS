# TheRSS Change Contract: taste-skill Integration

## Feature Intake

- User outcome: install the requested frontend taste skill, reconcile it with TheRSS's development rules, expose conflicts for final user judgment, then use the approved subset to improve the product.
- Observed problem/evidence: the upstream skill contains useful audit, state, motion, and accessibility guidance, but it identifies dense product UI as out of scope and includes marketing-oriented defaults that conflict with TheRSS.
- Product fit and relevant non-goal: improve clarity and polish of the single-user research desktop; do not turn it into a marketing site, generic dashboard, animated showcase, or second design-system host.
- Alternatives considered, including no change: install upstream only; copy upstream wholesale into project rules; create a scoped project adapter; do not install. The scoped adapter is the only option that preserves both user intent and project authority.
- Cost: one pinned global install; small versioned project-local skill and decision register; no runtime or external-service cost.
- Boundary changes: workflow/agent guidance only before the user decision; renderer, architecture, SQLite, IPC, security, network, dependencies, and package behavior remain frozen.
- Kill criterion: stop product edits if conflicts are unresolved, the active UI slice changes underneath this task, or a proposed improvement cannot retain evidence states and the accessibility matrix.
- Decision: proceed with pinned installation and a project-local adapter; pause at the explicit decision gate before renderer changes.

## Capability Contract

- Objective: make `design-taste-frontend` usable as bounded advisory input without allowing it to override TheRSS product, evidence, security, accessibility, TDD, or release contracts.
- Goals: verified installation; authoritative routing; progressive-disclosure adapter; adopt/adapt/reject/decision-needed matrix; concrete first-slice options.
- Non-goals: automatic dependency migration, broad redesign, font/icon replacement, marketing assets, product copy rewrite, package installation, commit, push, or publication.
- Interfaces and public API invariants: all renderer/preload/IPC/storage APIs and current navigation/keyboard behavior remain unchanged before approval.
- Data ownership and evidence semantics: source text and operational states remain owned by existing typed data and SQLite contracts; skill output is advisory analysis only.
- Failure states: ambiguous authority, hidden upstream drift, unresolved conflict applied as code, trigger collision, or accidental overlap with the active Discover change.
- Migration and rollback: remove `skills/therss-ui-improvement`, the AGENTS routing paragraph, and this task directory; uninstalling the global upstream skill is a separate explicit action.
- Observability/diagnostics: pinned commit and SHA-256; validator output; decision register; Git diff/status.
- Allowed scope: `AGENTS.md`, `skills/therss-ui-improvement/**`, and this task directory before user judgment.
- Persistent writeback: the files above.

## Uncertainty Reducer

- Change class: development-workflow integration plus future redesigned UI flow.
- Chosen artifact: invariant/conflict matrix and read-only audit of the live renderer/active Discover slice.
- Question it must answer: which upstream rules can improve TheRSS without weakening product semantics or introducing a second authority.
- What it does not prove: user visual preference, live application usability, rendered quality after implementation, or production dependency value.

## Frozen Acceptance Contract

- RED verifier and expected failure: before integration, no project-local skill or AGENTS routing exists and upstream rules can be misapplied directly.
- Focused unit/integration cases: validator accepts the project skill; no scaffold TODO remains; every reference exists; AGENTS states authority order and routing; decision register classifies each material conflict.
- Migration/rollback cases: all integration files are additive except the scoped AGENTS paragraph; product source and package files stay untouched by this phase.
- E2E/manual path: not applicable before product implementation; read-only renderer audit only.
- Screenshot/viewport/accessibility matrix: inherited for the later approved slice; no new screenshot claim in this phase.
- Security/dependency impact: no package dependency or external runtime addition.
- Package/install/live opt-in impact: global Codex skill install only; application packaging and installation remain out of scope.
- Full verifier: installed hash, `quick_validate.py`, missing-reference/TODO scan, scoped diff review, and current worktree inventory.
- Stop condition: integration verifies and the decision register is presented; stop before product UI edits until the user decides.

### Acceptance-change log

| Date       | Contract change                                        | Evidence/reason                                                                                                  | Reviewer |
| ---------- | ------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------- | -------- |
| 2026-08-28 | Accept A1-A9 and authorize F1-F4                       | The user approved the recommended desktop profile and the first Discover hardening slice; F5-F8 remain deferred. | User     |
| 2026-08-28 | Route product implementation to the active UI contract | `docs/audits/2026-08-28-external-ui-reference-refresh/CHANGE_CONTRACT.md` owns the F1-F4 RED/GREEN and verifier. | Codex    |

## Implementation Slices

1. RED: prove no existing local adapter/routing and inventory current worktree overlap.
2. Minimal GREEN: pinned install, project-local adapter, AGENTS route, and decision register.
3. Refactor: remove duplication, validate progressive disclosure, and review authority boundaries.
4. Next slice gate: user selects disputed policies and the first UI improvement.
5. Approved continuation: persist A1-A9, execute F1-F4 under the active UI contract, and close both evidence records.

## Independent Review

- Product/contract fit: pass; the adapter makes upstream guidance subordinate and explicitly excludes marketing defaults from the desktop product.
- Accidental scope or complexity: three focused references are justified by authority, taste translation, and user decision routing; the 622-word entrypoint avoids copying the upstream monolith.
- Test weakening: none; no acceptance or product test was edited by this integration task.
- Input/secret/untrusted-content boundaries: unchanged; the adapter forbids external content or generated assets from bypassing current boundaries.
- SQLite/IPC/migration/rollback: unchanged; no runtime or persistence file was touched.
- Diagnostics/package/update impact: global Codex skill install only; no `package.json`, application package, or installed beta change.
- Findings and resolutions: read-only `.agents` prevented the preferred discovery path, so the canonical project `skills/` surface plus explicit AGENTS routing was used; validator dependency and link-parser issues were resolved and recorded.
- Post-decision review: A1-A9 were persisted without adding UI dependencies or weakening product
  authority. The F1-F4 product diff is independently reviewed and verified in the active UI contract.

## Evidence Closeout

- Changed files: `AGENTS.md`; `skills/therss-ui-improvement/**`;
  `docs/audits/2026-08-28-taste-skill-integration/**`; the approved F1-F4 files recorded in the
  active UI contract; and global `/Users/dtjgp/.codex/skills/taste-skill/SKILL.md`.
- Deliberately untouched files: package/dependency files, shared/core/preload contracts,
  storage/SQLite, source adapters, providers, llm-wiki writer, packaging/updater, installed app, and
  unrelated user work.
- Focused RED/GREEN: workflow integration was artifact-validated rather than product-test driven; the precondition lacked routing, and the final AGENTS/skill/reference contract now exists.
- `npm run check:architecture`: passed after F1-F4; all owned TypeScript/TSX files remain <=800 lines.
- `npm run check`: passed 61 files / 409 tests with 90.29% statements, 80.15% branches, 93.64%
  functions, and 93.20% lines.
- Electron E2E/rendered evidence: build-first E2E passed 2/2. Fresh planning, searching, 820 px,
  dark, forced-colors, 200% terminal, and reduced-motion evidence is recorded by the active UI task.
- Security/dependency/migration/package evidence: no app dependency, migration, IPC, network, package, or beta-install change.
- Skill verification: pinned SHA-256 matched; upstream and local adapter passed `quick_validate.py`; local adapter reported `missing_refs=0`; all scoped files passed Prettier.
- Live opt-in checks not run: no provider, source, vault, or third-party write.
- Residual risks/blockers: upstream v2 remains experimental and project adapter discovery relies on
  AGENTS routing. F5-F8 are intentionally deferred, not blockers for the approved F1-F4 slice.
- Rollback path: remove the scoped AGENTS section, `skills/therss-ui-improvement/`, and this task directory. Global uninstall requires a separate explicit request.
- Git/install/push/publication state: project changes are uncommitted/unpushed; upstream skill
  installation completed; no application install, package replacement, or publication occurred.
