# Task Spec — Slice 3B (`ai-wiki-integration` · Claude)

Read `docs/audits/2026-11-21-wave3-wiki-badges-vault-settings/CHANGE_CONTRACT.md` first.

## Owned Files (strictly stay inside these paths)

- `src/core/integrations/llmWikiLibrary.ts`
- `src/core/integrations/llmWikiLibrary.test.ts`
- `src/core/integrations/llmWikiDiagnostics.ts` (new)
- `src/core/integrations/llmWikiDiagnostics.test.ts` (new)
- `src/core/integrations/llmWikiDaily.ts`
- `src/core/integrations/llmWikiVaultAdapter.ts`
- `src/core/integrations/llmWikiVaultSupport.ts`
- `src/core/integrations/llmWikiVaultPaths.ts` (new split target)
- Existing tests under `src/core/integrations/` as needed (no weakened assertions)

## Deliverables

1. **Batch status lookup + dynamic vault root in `LlmWikiLibrary` (`llmWikiLibrary.ts`)**:
   - Add `statusBatch(candidate: LlmWikiBatchStatusRequest): Promise<LlmWikiBatchStatusResponse>` validated via `llmWikiBatchStatusRequestSchema` & `llmWikiBatchStatusResponseSchema`:
     - Calls `this.scan(request.refresh ?? false)` AT MOST ONCE per batch (zero repeated filesystem scans per paper!).
     - Resolves every unique arXiv ID in `request.arxivIds` using the same truthful semantics as `status()` (note-missing, ambiguous, recorded with level/readStatus, not-found, unavailable), isolating per-paper header errors so one malformed linked note never breaks other items in the batch.
     - If the vault scan itself fails, returns `unavailable` entries for every requested arXiv ID without throwing.
   - Support optional `resolveVaultRoot?: () => string` in `LlmWikiLibrary` options (precedence: `resolveVaultRoot?.()` -> `vaultRoot` -> `process.env.THERSS_LLM_WIKI_PATH` -> `join(homedir(), 'Obsidian', 'llm-wiki')`), automatically invalidating `this.cached` if the resolved root changes, plus an explicit `clearCache(): void` method.
2. **Read-only vault diagnostics (`llmWikiDiagnostics.ts` + `llmWikiDiagnostics.test.ts`)**:
   - Export `defaultLlmWikiVaultPath()`, `resolveLlmWikiVaultLocation({ customPath, envPath, defaultPath })`, and `diagnoseLlmWikiVault(options): Promise<LlmWikiVaultDiagnostics>` validated against `llmWikiVaultDiagnosticsSchema`.
   - Origin precedence: `env` (`THERSS_LLM_WIKI_PATH` trimmed non-empty) > `custom` (saved custom path) > `default` (`~/Obsidian/llm-wiki`).
   - Checks (strictly read-only, zero writes):
     - `vault-root`: exists, regular directory, NOT a symlink (clear error + remediation if missing, not a dir, or symlink).
     - `required-files`: regular non-symlink `AGENTS.md` and `_schema.md` present inside root.
     - `paper-directories`: regular non-symlink `raw/paper_records` and `Literature/Paper_Notes` directories present.
     - `env-override` (warning check only when `origin === 'env'` and `customPath` is also set, explaining that `THERSS_LLM_WIKI_PATH` currently overrides the saved folder).
   - Overall status: `'unavailable'` if `vault-root` fails, `'incomplete'` if any other check has `status === 'error'`, else `'ready'`.
3. **Dynamic vault root in `LlmWikiDaily` & `LlmWikiVaultAdapter`**:
   - Allow optional `resolveVaultRoot?: () => string` alongside existing `vaultRoot?: string` (100% backward compatible with all existing callers and tests).
4. **Split `llmWikiVaultSupport.ts` (currently 736 lines)**:
   - Extract path/symlink/file-safety helpers (`hashText`, `safeFilenamePart`, `assertInsideRoot`, `readRegularFile`, `assertSafePathChain`, `assertSafeParentDirectory`, `existingSidecarForArxiv`, etc.) into `src/core/integrations/llmWikiVaultPaths.ts` and re-export them from `llmWikiVaultSupport.ts` so zero existing imports break and both files are comfortably `< 500` lines.
5. **TDD & Verification**:
   - Write failing RED tests first (`llmWikiLibrary.test.ts` batch/cache/dynamic root + `llmWikiDiagnostics.test.ts`), verify RED, implement GREEN, run `npm run check` + `npm run smoke:mcp`. Keep all files <= 800 lines and >= 80% coverage. No `git push`.
