# TheRSS Engineering Instructions

## Product identity

TheRSS is a single-user, local-first academic discovery desktop application. Its primary outcome is a daily, explainable inbox of arXiv papers and GitHub repositories matched to the user's declared interests.

The app is not a generic news reader, an autonomous research author, or a replacement for Zotero, Obsidian, Codex, or Claude Code.

## Read first

Read in tiers. Paying the full reading cost for a typo fix is waste; skipping it for an
architectural change is worse.

**Always, before any change:**

1. This file (`AGENTS.md`)
2. The nearest feature test and source files

**Before any non-trivial feature, refactor, migration, or user-visible change:**

3. `docs/DEVELOPMENT_WORKFLOW.md`
4. Start from `docs/templates/CHANGE_CONTRACT.md` in the task's durable work directory

**Before any change to product behavior or a user-visible surface:**

5. `PRODUCT.md`
6. `GOALS.md` — current objective and stop condition

**Before architectural, storage, adapter, or security work:**

7. `docs/DESIGN.md`
8. `docs/ENGINEERING_PRACTICES.md`
9. The relevant ADR in `docs/decisions/`

**On demand only:**

- `task_plan.md` — current status and the completed-phase index
- `docs/history/PHASE_EXECUTION_HISTORY.md` — closed phase records; historical context, not
  current scope
- `notes.md` — dated investigation notes

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
- Never store plaintext secrets in the application database. Electron main may store `safeStorage` ciphertext in SQLite because the decryption key remains OS-managed; renderer, MCP, logs, exports, and source control never receive plaintext.
- Custom endpoints must be `https:` or explicitly allowed loopback `http:` URLs. Reject file, data, and other schemes.
- GitHub authentication is optional for public discovery. Never embed a developer token in a distributable build.

## Development workflow

- Classify non-trivial work and follow `docs/DEVELOPMENT_WORKFLOW.md`; do not start implementation
  until the Feature Intake, Capability Contract, uncertainty reducer, acceptance contract, verifier,
  and stop condition are explicit.
- Follow TDD: add a failing test, implement the smallest coherent behavior, refactor with tests green.
- Acceptance tests may change only when the reviewed contract changes; never weaken a test merely
  to accommodate an implementation.
- Keep changes self-contained and reviewable. Tests and documentation ship with the behavior they cover.
- Preserve a working build after every commit.
- Owned code must maintain at least 80% statements, branches, functions, and lines.
- Owned TypeScript/TSX source and test files under `src/` must remain at or below 800 lines; the
  architecture check fails closed unless a reviewed ADR defines a narrower temporary exception.
- Do not use live arXiv, GitHub, or model calls in automated tests; use deterministic fixtures and explicit opt-in smoke tests.
- Validate with `npm run check` before commit and the full release gate before publishing.

## External UI skill integration

- The globally installed `design-taste-frontend` skill is advisory and is not a second product or
  engineering authority.
- For any TheRSS UI audit, redesign, visual-polish, layout, motion, or accessibility-visible task
  that uses that upstream skill, first read `skills/therss-ui-improvement/SKILL.md` and its routed
  references.
- Repository product/evidence/security contracts, the accepted change contract, tests, and current
  rendered behavior override upstream aesthetic defaults and hard bans.
- Do not import an upstream design system, styling framework, animation library, font, icon family,
  generated image, synthetic metric, or marketing pattern without an explicit reviewed scope.
- Present unresolved taste-versus-product conflicts to the user before implementing them.

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
