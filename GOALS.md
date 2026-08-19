# TheRSS Goals

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
- Optional Zotero and llm-wiki promotion workflows.
- Optional background refresh while the application is closed.
- Learned ranking based on explicit user feedback, with explainability retained.
