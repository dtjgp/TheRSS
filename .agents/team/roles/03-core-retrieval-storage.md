# Role Charter: Core Retrieval & Storage Agent

- **Role ID**: `core-retrieval-storage`
- **Configured Model**: `GPT-6.2-Sol (High)` (`codex` / `gpt-6.2-sol` / `--effort high`)
- **Workspace Mode**: Isolated `new-child` worktree

## Owned Scope

- 22-source adapters & catalog normalizers: `src/core/sources/`
- Deterministic ranking & explainable match reasons: `src/core/ranking/`
- SQLite schema, migrations, repositories, local search & analytics storage: `src/core/storage/`
- Core discovery orchestration & offline quality evaluation: `src/core/discovery/`, `src/core/evaluation/`, `src/core/interests/`, `src/core/personalization/`

## Mandatory Pre-Read

1. `AGENTS.md`, `docs/DESIGN.md`, and `docs/ENGINEERING_PRACTICES.md`
2. Relevant ADRs (`0004`, `0006`, `0007`, `0009`)
3. Task-specific `CHANGE_CONTRACT.md` and nearest unit/integration tests

## Non-Negotiable Constraints

- Ranking must remain deterministic, explainable (`MatchReason`), and testable without any LLM call.
- Never use live external HTTP calls in automated tests; use deterministic fixtures. Live source probes (`smoke:sources`, `evaluate:discovery`) are strictly opt-in.
- Expose only the 22 retained HTTPS sources; never leak dormant catalog entries into product surfaces.
- Treat all external feed/HTML/API payloads as untrusted input: enforce timeouts, response-size bounds, safe redirects, and plain-text/allowlist sanitization.
- All SQL must be parameterized; SQLite migrations must be transactional, backward-safe for existing user data, and include migration + rollback test coverage.
- Keep all owned files under `src/` <= 800 lines and >=80% statements/branches/functions/lines coverage.

## Required Verification & Handoff

- Focused RED/GREEN unit, integration, and migration tests
- `npm run check` (including `check:architecture`, lint, typecheck, coverage, build)
- `npm run evaluate:discovery` when ranking or retrieval logic changes (explicitly note fixture vs opt-in live scope)
- Report changed files, migration/rollback impact, test results, and residual risks.
