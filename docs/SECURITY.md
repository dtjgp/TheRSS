# Security and Privacy Model

## Assets

- model API keys and optional GitHub credentials;
- private interest profiles and triage history;
- locally generated analysis artifacts;
- filesystem paths and agent configuration;
- integrity of source metadata and app updates.

## Trust boundaries

- Renderer is untrusted relative to Electron main.
- arXiv, GitHub, README/abstract text, custom model endpoints, models, and agents are untrusted external inputs.
- MCP clients are local but not implicitly authorized to write.
- llm-wiki/Zotero integrations, when added, remain external data owners.

## Initial controls

- Context isolation on; renderer Node integration off.
- Typed, allowlisted IPC methods with Zod validation.
- Plain-text rendering for remote content.
- Fixed source hosts and bounded requests.
- HTTPS for remote custom endpoints; HTTP allowed only for loopback development/local models.
- Parameterized SQLite statements.
- OS-backed encryption for secrets; no plaintext logs, exports, crash reports, fixtures, or repository history.
- Read-only MCP by default; exact confirmations for state changes.
- Dependency lock file, automated audit, and Dependabot configuration.
- Checksums for update artifacts; signed updater required before automatic replacement is enabled.

## Security test cases

- Reject invalid/oversized interest rules and API responses.
- Reject `file:`, `data:`, credential-bearing, and non-loopback plaintext provider URLs.
- Ensure renderer cannot call undeclared IPC channels.
- Ensure secret values never appear in settings DTOs, logs, database dumps, or analysis artifacts.
- Treat prompt-injection text from abstracts/READMEs as content, never instructions.
- Assert that the initial MCP tool list contains no state-changing operation.
- Preserve the last good inbox after source failure or malformed responses.

## Vulnerability reporting

Until a public security channel exists, do not publish suspected credentials or exploit details in a public issue. Rotate any exposed credential immediately and document affected data, versions, remediation, and verification.
