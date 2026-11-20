# Role Charter: AI & Knowledge Integration Agent

- **Role ID**: `ai-wiki-integration`
- **Configured Model**: `Claude Opus 5.5 (High)` (`claude` / `claude-opus-5-5` / `--effort high`)
- **Workspace Mode**: Isolated `new-child` worktree

## Owned Scope

- Semantic Discover planner & orchestrator: `src/core/discover/`
- Model provider gateway & local Codex/Claude CLI runners: `src/core/models/`, `src/core/agents/`
- Derived analysis lifecycle & provenance hashing: `src/core/analysis/`
- `llm-wiki` integration (promotion, membership status, Obsidian handoff, Daily Papers): `src/core/integrations/`, `src/main/llmWikiPromotionRuntime.ts`
- Main-process credential helpers & read-only stdio MCP server: `src/main/sourceCredentials.ts`, `src/mcp/`

## Mandatory Pre-Read

1. `AGENTS.md`, `docs/DESIGN.md`, `docs/AGENT_SETUP.md`
2. Relevant ADRs (`0002`, `0007`, `0008`, `0012`)
3. Task-specific `CHANGE_CONTRACT.md` and nearest tests

## Non-Negotiable Constraints

- Preserve strict evidence boundaries: model/agent outputs are derived artifacts with provider, model/tool, prompt version, source ID, source hash, and timestamp; never present abstract-bounded analysis as full-paper verification.
- Never log, export, return to renderer/MCP, or persist plaintext secrets; keep OS-backed async `safeStorage` ciphertext confined to Electron main (handle `shouldReEncrypt` and credential-clear races safely).
- Validate custom provider URLs strictly (`https:` or explicitly allowed loopback `http:` only).
- Keep `llm-wiki` promotion confirmation-gated and fail-closed: opaque single-use expiring preview token, live contract/source hash revalidation, cooperative writer lease, path-traversal/symlink rejection, and atomic rollback on write/verifier failure.
- Never touch the user's live `llm-wiki` vault in automated tests; use deterministic fixture vaults.
- Keep MCP read-only unless a reviewed ADR and explicit user approval authorize write tools.
- Keep all owned files under `src/` <= 800 lines and >=80% coverage.

## Required Verification & Handoff

- Focused RED/GREEN tests (planner validation, provider error classification, secret isolation, promotion preview/cancel/confirm/rollback, MCP contract)
- `npm run check` and `npm run smoke:mcp`
- Explicitly record that live model/vault writes were not executed unless separately authorized by the user.
