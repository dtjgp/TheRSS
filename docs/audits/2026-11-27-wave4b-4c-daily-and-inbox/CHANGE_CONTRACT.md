# TheRSS Change Contract — Wave 4B Versioned Daily Papers Contract & Wave 4C P1-3 Inbox Capture

## Feature Intake

- User outcome:
  1. **Wave 4B (Daily Papers versioned contract)**: Allow `LlmWikiDaily` to consume a strict versioned JSON export (`ArXiv_Daily_<date>.json`, `schemaVersion: 1`) ahead of fragile Markdown regex parsing while smoothly falling back to existing `ArXiv_Daily_<date>.md` digests.
  2. **Wave 4C (`P1-3` non-paper Inbox capture)**: Enable confirmation-gated capture of non-paper Discover/Saved items (GitHub repositories, Hugging Face models/datasets, research news/articles) into `llm-wiki/Inbox/` with explicit preview, governance scope verification (`therss-inbox-capture`), native confirmation alert, atomic `wx` write, audit record, and SQLite receipt persistence.
- Observed problem/evidence:
  1. `LlmWikiDaily` currently relies solely on Markdown heading/table/bullet regexes in `ArXiv_Daily_<date>.md`, which can silently break on editorial formatting shifts.
  2. `LlmWikiPromotionService` intentionally restricts full-text promotion to arXiv papers (`source === 'arxiv' && kind === 'paper'`), leaving valuable repositories and technical articles without a governed handoff into `llm-wiki/Inbox/`.
- Product fit and relevant non-goal:
  - Fits `PRODUCT.md` and `GOALS.md` Wave 4B/4C scope.
  - Non-goals: No silent modification of `/Users/dtjgp/Obsidian/llm-wiki` (governance registration of `therss-inbox-capture` in `Automation_Runtime_Scopes.json` stays explicit and fail-closed); no direct Topic/Method writes for non-papers; no automated live vault writes in tests.
- Alternatives considered, including no change: Continuing with Markdown-only parsing leaves Daily Papers coupled to prose formatting; allowing unguarded writes to `Inbox/` without `Automation_Runtime_Scopes.json` verification would violate `llm-wiki` `Vault_Write_Governance.md`.
- Cost: Low-medium implementation, additive SQLite table (`llm_wiki_inbox_receipts`), zero external dependencies, zero live network calls.
- Boundary changes:
  - Shared Zod contracts (`src/shared/llmWikiDaily.ts`, `src/shared/llmWikiInbox.ts`)
  - Additive SQLite table `llm_wiki_inbox_receipts` (`src/core/storage/researchSchema.ts`, `src/core/storage/llmWikiInboxStore.ts`)
  - Typed preload/IPC channels for `llm-wiki:inbox-preview`, `llm-wiki:inbox-confirm`, `llm-wiki:inbox-cancel`, `llm-wiki:inbox-latest`
  - Native AppKit reader action (`Preview llm-wiki Inbox capture`) + preview/confirm sheet (`NativeModals` + `inboxModal.ts`)
- Kill criterion: Any breach of symlink/path safety, governance fail-closed checks, existing paper promotion invariants, coverage >=80%, or 800-line owned source cap.
- Decision: proceed

## Capability Contract

- Objective: Ship versioned JSON v1 Daily Papers ingestion (with Markdown fallback) and governed, confirmation-gated non-paper Inbox capture end-to-end across core, SQLite, IPC/preload, and Native AppKit UI.
- Goals:
  1. `llmWikiDailyExportV1Schema` + `LlmWikiDaily` JSON v1 priority read with fail-closed validation and Markdown fallback.
  2. `LlmWikiInboxService`, `LlmWikiInboxAdapter`, `LlmWikiInboxStore`, IPC/preload wiring, and Native AppKit reader + modal confirmation workflow.
  3. Keep `src/main/index.ts` and all owned `src/` files strictly <= 800 lines by extracting `src/main/llmWikiRuntimeWiring.ts` and `src/main/appkit/inboxModal.ts`.
- Non-goals:
  - No edits to external `/Users/dtjgp/Obsidian/llm-wiki` files.
  - No Deferred items (Apple signing/notarization, Zotero, background refresh, cloud sync, 83 dormant sources).
- Interfaces and public API invariants:
  - Existing `LlmWikiDailySnapshot` consumers remain 100% compatible (optional `contractSource: 'json-v1' | 'markdown-legacy'` on `edition`).
  - Existing paper promotion (`previewLlmWikiPromotion` / `confirmLlmWikiPromotion` / `cancelLlmWikiPromotion` / `getLatestLlmWikiPromotion`) remains 100% unchanged.
  - New `TheRSSApi` inbox capture methods are additive and validated at IPC boundaries.
- Data ownership and evidence semantics:
  - Inbox notes explicitly declare `evidenceTier: 'metadata-only'` and state that only discovery metadata/summary was captured (not verified code review or reproduced claims).
  - SQLite `llm_wiki_inbox_receipts` stores only bounded validated receipts; vault files are written only after preview + native OS confirmation alert + active `automation_runtime.py` lease.
- Failure states:
  - Invalid/corrupt/symlink/unsupported-version Daily JSON fails closed (`status: 'unavailable'`).
  - Missing `therss-inbox-capture` scope in `Automation_Runtime_Scopes.json`, unsafe vault root, missing `Inbox/` directory, or existing target collision returns `ready: false` blocked preview with actionable blockers.
  - Post-preview item or `log.md` mutation blocks confirmation before writing.
- Migration and rollback: Additive table `llm_wiki_inbox_receipts` is ignored by older builds. Clean `git revert` rollback.
- Observability/diagnostics: Structured receipts in SQLite + `Automation_Conversations/` audit JSON + `log.md` append-only entry.
- Allowed scope: `src/shared/`, `src/core/integrations/`, `src/core/storage/`, `src/main/`, `src/preload/`, `docs/`, `GOALS.md`, `PRODUCT.md`, `CHANGELOG.md`.
- Persistent writeback: `GOALS.md`, `PRODUCT.md`, `CHANGELOG.md`, and this Evidence Closeout.

## Uncertainty Reducer

- Change class: Product capability + architecture/storage/IPC/security boundary.
- Chosen artifact: Executable contract & RED->GREEN unit/integration test suites covering Daily JSON v1, Inbox governance fail-closed, symlink/overwrite/TOCTOU guards, SQLite persistence, IPC boundary, and Native AppKit presenter/modal flows.
- Question it must answer: Does JSON v1 Daily Papers coexist safely with legacy Markdown, and does P1-3 Inbox capture enforce every governance, confirmation, and evidence-boundary invariant without touching the live vault in tests?
- What it does not prove: Live vault execution of `therss-inbox-capture` requires the user to explicitly register `therss-inbox-capture` in `/Users/dtjgp/Obsidian/llm-wiki/System/Configs/Automation_Runtime_Scopes.json`; human physical-keyboard/VoiceOver acceptance remains a separate human step.

## Frozen Acceptance Contract

- RED verifier and expected failure:
  1. Wave 4B RED tests in `src/core/integrations/llmWikiDaily.test.ts` and `src/shared/llmWikiDaily.test.ts` testing `llmWikiDailyExportV1Schema` and JSON v1 preference/fail-closed behavior.
  2. Wave 4C RED tests in `src/shared/llmWikiInbox.test.ts`, `src/core/storage/llmWikiInboxStore.test.ts`, `src/core/integrations/llmWikiInboxService.test.ts`, `src/core/integrations/llmWikiInboxAdapter.test.ts`, and `src/main/appkit/inboxModal.test.ts`.
- Focused unit/integration cases: All new tests + existing `llmWiki*.test.ts`, `windowApplication*.test.ts`, `reading.test.ts`, `modals.test.ts`.
- Migration/rollback cases: Additive SQLite table creation on fresh & existing DB; interrupted `running` receipt reconciliation on startup.
- E2E/manual path: Full `npm run test:e2e`, `smoke-native-appkit.mjs`, `smoke-appkit-controls.mjs`, `npm run smoke:mcp`.
- Screenshot/viewport/accessibility matrix: Native AppKit reader & modal layout verified by presenter + native smoke checks.
- Security/dependency impact: Zero new dependencies; `https:`-only URL check, `assertNoActiveNoteContent`, `assertSafeVaultRoot`, `assertSafePathChain`, `O_NOFOLLOW`, `flag: 'wx'`, trusted runtime SHA-256 verification.
- Package/install/live opt-in impact: Verified by `npm run package:mac` and `npm run smoke:package` before `v0.5.0` pre-release.
- Full verifier: `npm run check`, `npm audit --audit-level=high`, `npm run test:e2e`, `smoke-native-appkit.mjs`, `smoke-appkit-controls.mjs`, `npm run smoke:mcp`, GitHub CI (`CI/quality` + `CI/desktop`).
- Stop condition: All RED->GREEN tests pass, coverage >=80% across all 4 metrics, all owned `src/` files <=800 lines, all local & CI gates pass, independent diff review is clean.

### Acceptance-change log

| Date | Contract change | Evidence/reason | Reviewer |
| ---- | --------------- | --------------- | -------- |

## Implementation Slices

1. Wave 4B: RED tests -> implement `llmWikiDailyExportV1Schema` + `LlmWikiDaily` JSON v1 / Markdown fallback -> GREEN.
2. Wave 4C core/storage: RED tests -> implement `src/shared/llmWikiInbox.ts`, `llmWikiInboxStore.ts`, `llmWikiInboxService.ts`, `llmWikiInboxAdapter.ts` -> GREEN.
3. Wave 4C IPC/main/AppKit UI: Wire IPC/preload/`WindowApplication`/`llmWikiRuntimeWiring.ts` + `inboxModal.ts`/`modals.ts`/`reading.ts`/`presenter.ts` + presenter tests -> GREEN.
4. Full gates, diff review, merge PR, then sync `PRODUCT.md`/`GOALS.md`/`CHANGELOG.md`, build & publish `v0.5.0` unsigned pre-release, and run `npm run update:local`.

## Independent Review

- **Security & governance review**:
  - Wave 4B (`LlmWikiDaily`): `ArXiv_Daily_<date>.json` uses `readRegularFile` (`O_NOFOLLOW`, bounded bytes, vault-root containment) and strict `llmWikiDailyExportV1Schema` validation (schemaVersion `1`, YYYY-MM-DD date matching, deduped arXiv IDs, status/count consistency). Corrupt/oversized/mismatched/symlinked JSON fails closed (`status: 'unavailable'`); only `ENOENT` falls back to legacy `ArXiv_Daily_<date>.md`.
  - Wave 4C (`LlmWikiInboxAdapter` + `LlmWikiInboxService`): strictly rejects `kind === 'paper'` (routed exclusively to full-text promotion) and non-`https:` URLs; verifies `assertSafeVaultRoot`, required vault contract files, `TRUSTED_AUTOMATION_RUNTIME_SHA256`, `Inbox/` and `Automation_Conversations/` path chains, and explicit `therss-inbox-capture` scope registration (`['Automation_Conversations', 'Inbox', 'log.md']`) in `Automation_Runtime_Scopes.json`. Writes require owner-scoped single-use preview, native OS confirmation alert (`confirmInboxCapture`), active `automation_runtime.py begin/finish` lease, TOCTOU re-check of contract + `log.md`, `assertNoActiveNoteContent`, and atomic `flag: 'wx'` creation.
  - Real vault (`/Users/dtjgp/Obsidian/llm-wiki`) was inspected read-only and never mutated; `therss-inbox-capture` remains fail-closed until explicitly registered by the user in vault governance.
- **Structural & architecture review**:
  - Extracted `src/main/llmWikiRuntimeWiring.ts` and `src/main/appkit/inboxModal.ts` so `src/main/index.ts` dropped by 100+ lines and every owned file under `src/` passes `check:architecture` (`<= 800` lines).
  - SQLite migration is strictly additive (`llm_wiki_inbox_receipt` table + startup interrupted-receipt reconciliation).

## Evidence Closeout

- `npm run check`: PASS (architecture `<= 800` lines, Prettier, ESLint 0 errors, `tsc --noEmit` 0 errors, full builds).
  - Main suite: **157 files / 1,154 tests passed** (`92.49%` stmts, `84.24%` branches, `95.62%` funcs, `94.70%` lines).
  - AppKit suite: **44 files / 252 tests passed** (`89.95%` stmts, `84.14%` branches, `87.46%` funcs, `92.38%` lines).
- `npm audit --audit-level=high`: PASS (0 high/critical vulnerabilities).
- `npm run test:e2e`: **11/11 Playwright desktop E2E tests passed** (40.7s).
- `THERSS_NATIVE_DEFAULT_ONLY=1 THERSS_NATIVE_SCREENSHOTS=0 node scripts/smoke-native-appkit.mjs`: **17/17 workflow groups passed**.
- `node scripts/smoke-appkit-controls.mjs`: **20/20 component acceptance groups passed**.
- `npm run smoke:mcp`: **PASS** (`list_today_items`, `get_item`, `get_analysis_context`).
- Residual boundaries: live vault execution of `therss-inbox-capture` requires explicit registration of `therss-inbox-capture` in `/Users/dtjgp/Obsidian/llm-wiki/System/Configs/Automation_Runtime_Scopes.json`; human physical-keyboard/VoiceOver acceptance and paid Apple Developer signing/notarization remain outside automated CI.
