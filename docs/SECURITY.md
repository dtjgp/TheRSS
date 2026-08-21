# Security and Privacy Model

## Assets

- model API keys;
- private interest profiles and triage history;
- locally generated analysis artifacts;
- filesystem paths and agent configuration;
- integrity of source metadata and app updates.
- integrity and privacy of the external llm-wiki vault and its cooperative writer state.

## Trust boundaries

- Renderer is untrusted relative to Electron main.
- arXiv, GitHub, README/abstract text, custom model endpoints, models, and agents are untrusted external inputs.
- MCP clients are local but not implicitly authorized to write.
- llm-wiki and Zotero remain external data owners; TheRSS does not absorb their document stores.

## Initial controls

- Context isolation on; renderer Node integration off.
- Typed, allowlisted IPC methods with Zod validation.
- Plain-text rendering for remote content.
- Fixed source hosts and bounded requests.
- HTTPS for remote custom endpoints; HTTP allowed only for loopback development/local models.
- Parameterized SQLite statements.
- OS-backed encryption for secrets; no plaintext logs, exports, crash reports, fixtures, or repository history.
- No account-login, OAuth, or synchronization path is exposed in the current build.
- Data Analytics reads only the local operational database through typed IPC; no telemetry SDK, remote analytics endpoint, secret field, or analysis content is included in the aggregate.
- Read-only MCP by default; exact confirmations for state changes.
- Local-agent executable selection is allowlisted and resolved without a shell; untrusted item content is sent only through stdin.
- Claude Code analysis disables tools and session persistence. Codex analysis ignores user configuration, disables the shell tool, uses an ephemeral session and read-only sandbox, and runs from a temporary directory.
- Local-agent subprocesses receive a reduced environment, have a 120-second timeout and 2 MB output limit, and never return stderr to the renderer.
- llm-wiki promotion accepts only persisted canonical arXiv papers. The renderer sends a bounded
  item/session ID for preview and a single-use UUID for confirmation; it cannot select paths,
  metadata, process arguments, or the vault root.
- Promotion-stage Codex runs in a temporary directory with read-only sandboxing, an ephemeral
  session, ignored user configuration, and shell tooling disabled. Electron main—not Codex—owns the
  allowlisted live writes under the vault's cooperative lease.
- The adapter rejects path traversal, control characters, symlinked governance files/parents,
  existing target collisions, duplicate arXiv sidecars, stale source/contract hashes, invalid PDFs,
  missing runtime scope, and overlapping writer leases.
- Preview UUIDs are bound to the originating Electron webContents, capped, timer-expired, and
  followed by an OS-native main-process confirmation before any canonical write.
- arXiv redirects are manually bounded to official HTTPS PDF URLs and streamed under the byte cap;
  the cooperative Python runtime is executed only from hash-verified bytes staged under a pinned
  application trust baseline.
- Promotion receipts persist only bounded metadata and vault-relative paths. PDF/note content,
  prompts, stderr, absolute vault roots, and credentials are excluded from SQLite and renderer DTOs.
- Dependency lock file, automated audit, and Dependabot configuration.
- Checksums for update artifacts; signed updater required before automatic replacement is enabled.

## Security test cases

- Reject invalid/oversized interest rules and API responses.
- Reject `file:`, `data:`, credential-bearing, and non-loopback plaintext provider URLs.
- Ensure renderer cannot call undeclared IPC channels.
- Ensure secret values never appear in settings DTOs, logs, database dumps, or analysis artifacts.
- Treat prompt-injection text from abstracts/READMEs as content, never instructions.
- Assert local-agent prompts never enter command arguments and subprocess timeout/output limits fail closed.
- Assert that the initial MCP tool list contains no state-changing operation.
- Assert promotion preview/confirmation separation, stale-token rejection, source/contract drift,
  traversal and duplicate rejection, exact receipt persistence, rollback/partial audit behavior, and
  fixture-only Electron execution that never writes the real vault.
- Preserve the last good inbox after source failure or malformed responses.

## Vulnerability reporting

Until a public security channel exists, do not publish suspected credentials or exploit details in a public issue. Rotate any exposed credential immediately and document affected data, versions, remediation, and verification.
