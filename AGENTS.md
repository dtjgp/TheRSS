# TheRSS Engineering Instructions

## Product identity

TheRSS is a single-user, local-first academic discovery desktop application. Its primary outcome is a daily, explainable inbox of arXiv papers and GitHub repositories matched to the user's declared interests.

The app is not a generic news reader, an autonomous research author, or a replacement for Zotero, Obsidian, Codex, or Claude Code.

## Read first

Before non-trivial work, read:

1. `PRODUCT.md`
2. `GOALS.md`
3. `task_plan.md`
4. `docs/DESIGN.md`
5. `docs/ENGINEERING_PRACTICES.md`
6. The nearest feature test and source files

## Evidence boundaries

- arXiv abstracts and GitHub metadata are discovery evidence only.
- Model/agent output is a derived analysis artifact and must retain provider, model/tool, prompt version, source identifier, source hash, and timestamp.
- Do not present an abstract-derived statement as a verified full-paper result.
- A failed source, partial result, no-result response, and successful refresh are distinct states.

## Architecture boundaries

- External data enters through typed source adapters.
- Domain ranking is deterministic and testable without a model provider.
- SQLite is the local operational source of truth.
- Renderer code never receives filesystem, process, database, or secret access directly.
- Main/renderer communication uses a typed preload API with schema validation at IPC boundaries.
- Codex, Claude Code, and DeepSeek-compatible harnesses share one agent contract; do not create tool-specific databases or status models.

## Security boundaries

- Treat feeds, repository metadata, README content, model endpoints, model output, and agent output as untrusted input.
- Never render remote HTML directly. Convert to bounded plain text or sanitize with an allowlist.
- Never hardcode or log API keys, tokens, credentials, prompts containing secrets, or decrypted secret values.
- Store encrypted secrets separately from the ordinary application database, using Electron `safeStorage` on supported platforms.
- Custom endpoints must be `https:` or explicitly allowed loopback `http:` URLs. Reject file, data, and other schemes.
- GitHub authentication is optional for public discovery. Never embed a developer token in a distributable build.

## Development workflow

- Follow TDD: add a failing test, implement the smallest coherent behavior, refactor with tests green.
- Keep changes self-contained and reviewable. Tests and documentation ship with the behavior they cover.
- Preserve a working build after every commit.
- Owned code must maintain at least 80% statements, branches, functions, and lines.
- Do not use live arXiv, GitHub, or model calls in automated tests; use deterministic fixtures and explicit opt-in smoke tests.
- Validate with `npm run check` before commit and the full release gate before publishing.

## Change review

Review every change for:

- design and product fit;
- user-visible correctness;
- unnecessary complexity;
- tests that fail when behavior breaks;
- clear naming and documentation;
- privacy, secret handling, untrusted content, and network constraints;
- migration, rollback, diagnostics, and update impact.

## Release boundaries

- Development and personal-beta workflows must not require paid Apple credentials.
- Unsigned macOS builds must not claim production-grade automatic replacement updates.
- Signed/notarized updater work is a later release gate and requires the first signed baseline plus a same-identity successor test.
- Git push, GitHub Release publication, and third-party mutations require the user's explicit scope; the initial repository push is authorized by the founding request.
