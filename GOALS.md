# TheRSS Goals

## Active goal: Initial version

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

## Later goals

- Signed and notarized macOS releases with verified old-to-new automatic replacement.
- Optional Zotero and llm-wiki promotion workflows.
- Optional background refresh while the application is closed.
- Learned ranking based on explicit user feedback, with explainability retained.
