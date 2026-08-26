# Change Contract: Core reliability updates

## Feature Intake

- **User outcome:** current research data and evidence remain recoverable; long Discover searches can
  be stopped and resumed safely; past analyses can be reopened and recognized as stale.
- **Observed problem/evidence:** release docs drifted after PR #32; the installer has no idempotency or
  structured transaction receipt; Discover is one opaque awaited request; analysis history cannot be
  reopened with source-hash comparison.
- **Product fit and relevant non-goal:** strengthens the local-first Discover → Saved → Analysis
  critical path. It does not add sources, cloud sync, background refresh, learned ranking, or signed
  automatic updates.
- **Alternatives considered, including no change:** documentation-only correction would leave data
  and task-control risks; renderer-only cancellation would violate architecture boundaries; rerunning
  the whole Discover plan after a partial result would waste successful source work and obscure
  provenance; overwriting analysis artifacts would destroy history.
- **Cost:** moderate cross-layer implementation and maintenance; no new paid or runtime service.
- **Boundary changes:** typed IPC gains bounded operations and events; SQLite may gain additive
  indexes/queries but no destructive migration; installer gains a local receipt/lock boundary.
- **Kill criterion:** stop a slice if it requires renderer filesystem/process access, destructive
  migration, external service calls in tests, or weakening evidence-state distinctions.
- **Decision:** proceed in independently verifiable slices.

## Capability Contract

- **Objective:** close the four highest-risk reliability gaps before expanding product scope.
- **Goals:** accurate release evidence; idempotent audited installs; cancel/progress/retry Discover;
  immutable reopenable analysis history with stale detection.
- **Non-goals:** new content sources, background daemon, embeddings, mobile/cloud sync, live vault
  scope expansion, signed updater, or wholesale UI redesign.
- **Interfaces and public API invariants:** existing `searchDiscover`, Saved, analysis, promotion, and
  provider behaviors remain compatible; new renderer abilities pass only through typed preload IPC.
- **Data ownership and evidence semantics:** main owns install/process/adapter/database state;
  SQLite remains operational truth; derived artifacts retain source hashes and provenance.
- **Failure states:** install lock conflict, same-release refusal, missing database, cancel requested,
  canceled source, partial run, failed-source retry, missing historical artifact, and stale artifact
  remain explicit.
- **Migration and rollback:** additive schema/API only; retain previous app/database backups; code
  rollback must leave existing SQLite readable.
- **Observability/diagnostics:** structured local install receipt; bounded Discover progress events;
  explicit analysis current/stale state.
- **Allowed scope:** files listed in the task plan plus nearest tests and task-local evidence.
- **Persistent writeback:** repository files only in this run; live installation/publication requires
  separate authorization.

## Uncertainty Reducer

- **Change class:** release tooling plus cross-layer product behavior.
- **Chosen artifact:** invariant matrix plus focused failing tests.
- **Question it must answer:** can each behavior be enforced without broadening renderer authority or
  corrupting/overwriting existing evidence?
- **What it does not prove:** live external source latency, production signing, real vault writes, or
  causal attribution for the earlier Application Support incident.

## Frozen Acceptance Contract

- **RED verifier and expected failure:** installer tests expect same-release refusal, one completed
  receipt, and database preservation; Discover tests expect cancellation/progress/retry APIs and UI;
  analysis tests expect artifact history/reopen/stale classification. Each fails before its slice.
- **Focused unit/integration cases:** success, empty, partial, failure, cancellation race, retry subset,
  immutable history, source-hash match/mismatch, missing source, and bounded local search if included.
- **Migration/rollback cases:** existing v0.2.0 database opens unchanged; additive changes preserve
  old rows; install rehearsal operates only in a temporary fixture root.
- **E2E/manual path:** deterministic fixture Discover run emits progress, can cancel, can retry failed
  sources; analysis ledger opens a historical artifact and shows stale state.
- **Screenshot/viewport/accessibility matrix:** existing minimum/wide/200%/forced-color checks remain;
  new controls require accessible names, status text, focus, and disabled/busy semantics.
- **Security/dependency impact:** no plaintext secret/path leakage; no remote HTML; no new dependency
  unless separately justified; receipt excludes secrets and database contents.
- **Package/install/live opt-in impact:** package smoke required; real installed app replacement,
  providers, sources, and vault remain opt-in and are not part of this implementation authorization.
- **Full verifier:** `npm run check:architecture`, `npm run check`, `npm run test:e2e`,
  `npm audit --audit-level=high`, `npm run smoke:package`, isolated installer rehearsal, diff/secret
  review.
- **Stop condition:** all first-four-slice focused and full gates pass, or an exact invariant blocker
  is recorded. Local search may defer without weakening those core outcomes.

### Acceptance-change log

| Date | Contract change | Evidence/reason | Reviewer |
| ---- | --------------- | --------------- | -------- |

## Implementation Slices

1. **RED:** add focused tests for each slice before implementation.
2. **Minimal GREEN:** add the smallest typed behavior satisfying the frozen cases.
3. **Refactor:** remove duplication and keep owned TypeScript/TSX files within architecture limits.
4. **Next slice gate:** focused tests, architecture check, and diff review are green.

## Independent Review

- **Product/contract fit:** all changes strengthen the existing Discover → Saved → Analysis path;
  no source, account, background, model-ranking, or external-write capability was added.
- **Accidental scope or complexity:** one shared Discover finalizer preserves ranking/dedup/count
  invariants; local search remains a bounded SQLite store plus one focused panel.
- **Test weakening:** no acceptance behavior was removed. One incorrect search assertion was widened
  only because cross-kind unified matches are required; all prior suites remain green.
- **Input/secret/untrusted-content boundaries:** main retains Zod IPC validation; sandboxed preload
  uses dependency-free structural guards; SQL is parameterized; model content is rendered as text.
- **SQLite/IPC/migration/rollback:** canceled session/source constraints migrate additively with
  foreign-key validation; historical artifacts remain immutable; install failure restores the prior
  app and retains the failed build/backup for inspection.
- **Diagnostics/package/update impact:** structured install receipts, per-source progress, explicit
  freshness, package hash, and recovery docs are present.
- **Findings and resolutions:** removed sandbox-incompatible preload Zod import; changed menu dispatch
  to a live-window fallback; propagated cancellation to actual resources; limited one run per
  renderer; cleaned failed lock metadata writes. No blocking finding remains.

## Evidence Closeout

- **Changed files:** scoped install tooling/tests; Discover shared/core/main/preload/renderer/storage
  behavior/tests; analysis store/service/API/UI/tests; local search store/API/menu/panel/tests; E2E;
  current product/release/recovery documentation and this audit directory.
- **Deliberately untouched files:** credentials, live database, installed app, vault, remote Git,
  package version, signing, source registry, model-provider records, and external services.
- **Focused RED/GREEN:** installer 6/6; Discover/planner/model/CLI/source cancellation and retry 89/89;
  analysis/storage/UI 28/28; local search/menu/Shell 32/32; canceled migration verified.
- **`npm run check:architecture`:** passed; all owned TypeScript/TSX files remain <=800 lines.
- **`npm run check`:** passed 60 files / 402 tests; coverage 90.29/80.15/93.64/93.20; all builds.
- **Electron E2E/rendered evidence:** 2/2 passed with deterministic temporary fixtures.
- **Security/dependency/migration/package evidence:** audit 0 vulnerabilities; added-line secret/debug
  scan clean; canceled-state migration and FK checks pass; unsigned package and smoke pass; packaged
  `app.asar` is `80d54e0b63fb900fa2b536c3fb9b72681fbe248edd6fde9b047feeb24d246005`.
- **Live opt-in checks not run:** real app install, providers, external sources, GitHub mutation, and
  llm-wiki write.
- **Residual risks/blockers:** signed/notarized distribution still requires a valid Developer ID;
  local search may need FTS5 only if data volume materially outgrows bounded scans.
- **Rollback path:** revert repository changes; additive SQLite cancellation states remain readable;
  installer keeps previous app/database backups and failed replacement artifact when applicable.
- **Git/install/push/publication state:** after separate user authorization, commit `9a9710c` was
  pushed to `codex/core-reliability-updates`, PR #33 was opened against protected `main`, and the
  installed app was replaced recoverably. Release/installed hashes match; current/backup SQLite,
  installed smoke, and installed E2E pass. PR merge and release publication remain unperformed.
