# TheRSS Goals

## Completed goal: Core reliability updates

### Objective

Close the highest-risk gaps behind the Discover-centered personal beta: accurate release evidence,
idempotent and auditable local replacement, cancelable/recoverable Discover execution, reopenable
analysis history with stale detection, and bounded local unified search.

### Observable success criteria

- Identical packaged/installed builds do not create duplicate app/database backups; successful
  replacement has one structured receipt and preserves an existing database.
- One renderer owns at most one Discover run. Planning, model/CLI execution, and source HTTP receive
  the same cancellation signal; completed source outcomes remain distinct and retryable without
  rerunning the planner or successful sources.
- Historical analysis artifacts reopen by immutable ID and are classified against the current
  source hash without overwriting old evidence.
- Command-F searches bounded Saved, Discover, and analysis fields in local SQLite without a model,
  source adapter, embedding, telemetry, or network request.

### Verifiers

- Focused RED/GREEN installer, Discover, storage/migration, analysis, local-search, renderer, menu,
  and preload-boundary tests
- `npm run check`
- `npm run test:e2e`
- `npm audit --audit-level=high`
- `npm run package:mac` and `npm run smoke:package`
- scoped diff, secret/debug, architecture, and rollback review

### Stop condition and completion evidence (2026-08-26)

The goal is complete in source/package scope: `npm run check` passed 60 files / 402 tests with
90.29% statements, 80.15% branches, 93.64% functions, and 93.20% lines; Electron E2E passed 2/2;
the production dependency audit found zero vulnerabilities; the unsigned arm64 package and package
smoke passed; isolated install/migration/search tests passed. The packaged `app.asar` is
`80d54e0b63fb900fa2b536c3fb9b72681fbe248edd6fde9b047feeb24d246005`.

Live app replacement, commit, push, PR, release publication, live provider/source access, and real
llm-wiki writes were deliberately not performed by this goal.

## Completed goal: Development workflow hardening

### Objective

Make the agreed Feature Intake → Capability Contract → uncertainty reducer → frozen acceptance →
TDD → verification → independent review → evidence-closeout workflow executable, and repair the
current objective structural violations without changing product behavior.

### Observable success criteria

- `AGENTS.md` routes non-trivial work through one canonical workflow and reusable change contract.
- The workflow distinguishes UI prototypes, technical spikes, and failing-test reproduction.
- Acceptance intent cannot be weakened silently, and independent diff review is an explicit gate.
- An automated architecture check enforces the owned-source line limit in `npm run check`.
- Current owned TypeScript/TSX files satisfy the enforced limit without weakening public APIs,
  SQLite migrations, evidence boundaries, or renderer behavior.

### Verifiers

- Focused RED/GREEN architecture-policy and affected-feature tests
- `npm run check:architecture`
- `npm run check`
- `npm run test:e2e`
- storage/security/diff review and final source-size inventory

### Stop condition

The goal is complete when the workflow and template are durable, automated structural checks pass,
all current violations in their enforced scope are repaired, full checks and Electron E2E pass, and
judgment-only residual risks are recorded rather than silently treated as compliant.

### Completion evidence (2026-08-25)

- Canonical workflow: `docs/DEVELOPMENT_WORKFLOW.md`; reusable contract:
  `docs/templates/CHANGE_CONTRACT.md`.
- `npm run check:architecture` enforces the 800-line owned TypeScript/TSX boundary and passes.
- `npm run check` passed 54 files / 330 tests with 90.46% statements, 80.59% branches, 94.05%
  functions, and 93.37% lines; all builds passed.
- Electron E2E passed 2/2 outside the restricted desktop sandbox.
- Production dependency audit reported zero vulnerabilities; added-line secret and debug scans were
  clean.
- No product behavior, SQLite schema, package/install state, Git commit, push, or publication was
  changed by this goal.

## Completed goal: Discover-centered retrieval

### Objective

Replace the overlapping Today/Interests/Discover product surfaces with one explicit Discover
workflow that uses a configured model, Codex, or Claude Code to plan a bounded search across any
subset of all 22 retained live-verified sources.

### Observable success criteria

- The app opens directly to Discover and exposes no Today or Interests navigation/menu surface.
- Discover defaults to the exact 22-source retained registry and supports inspectable source
  selection without accepting dormant catalog entries.
- arXiv/GitHub execute specialized queries; the other deployed adapters retrieve bounded recent
  records and only return deterministic semantic matches.
- Each selected source records an independent healthy, no-result, or failed outcome; partial
  sessions preserve successful results.
- Configured-source result kinds survive SQLite round-trip and Saved promotion.
- Existing Interest, Today, Saved, analysis, and analytics records remain recoverable.

### Verifiers

- Focused shared/core/storage/renderer tests showing RED then GREEN
- `npm run check`
- `npm run test:e2e`
- rendered Discover, Saved, and Sources inspection
- `npm run smoke:package`

### Stop condition

The goal is complete when the focused and full gates pass, the rendered desktop flow confirms the
five-surface navigation and 22-source Discover selector, and any live-provider/source check not run
is reported as an explicit opt-in boundary.

## Completed goal: Initial version

### Objective

Publish a runnable initial version of TheRSS that gives one research user a personalized daily inbox of arXiv papers and GitHub repositories and lets the user request deeper analysis through configured models or shared Codex/Claude/DeepSeek agent tooling.

### Observable success criteria

- Interest settings support arXiv categories/keywords/exclusions and GitHub keywords/topics/languages.
- Refresh produces normalized, deduplicated items from both source classes.
- Ranking exposes human-readable match reasons.
- Today view supports source filtering and triage state changes.
- Selected items can create and receive analysis artifacts with provenance.
- Model configuration supports at least OpenAI-compatible and Anthropic-compatible protocols without plaintext secret persistence.
- One local MCP server exposes read-only discovery/analysis-context tools by default.
- Development supports hot reload and a documented local installed-beta refresh command.
- CI and local release gates cover lint, type check, tests, coverage, build, and dependency audit.
- The verified source is pushed to GitHub under `TheRSS`.

### Verifiers

- `npm run check`
- `npm run test:coverage`
- `npm run test:e2e`
- `npm run build`
- `npm audit --audit-level=high`
- packaged-app smoke check
- requirement traceability audit in `docs/REQUIREMENTS_TRACEABILITY.md`
- `git ls-remote origin` after publication

### Stop condition

The goal is complete only when every explicit founding requirement has current executable or remote evidence, all release gates pass, and no required capability remains documented as planned-only.

### Completion evidence (2026-08-15)

- Public repository: <https://github.com/dtjgp/TheRSS>
- Local and remote `main` initially matched at `c41e63dce75eee258f9325ef20e23d5ad25a7380`.
- Initial publication CI passed: <https://github.com/dtjgp/TheRSS/actions/runs/31894821844>.
- `npm run update:local` completed the remote pull, locked install, release gates, database backup, packaging, and recoverable application replacement.
- The requirement-by-requirement local evidence remains recorded in `docs/REQUIREMENTS_TRACEABILITY.md`.

## Later goals

- Signed and notarized macOS releases with verified old-to-new automatic replacement.
- Optional Zotero promotion. Confirmation-gated llm-wiki paper promotion is implemented; broader
  Topic/Method writer scope remains pending explicit governance approval.
- Optional background refresh while the application is closed.
- Learned ranking based on explicit user feedback, with explainability retained.
