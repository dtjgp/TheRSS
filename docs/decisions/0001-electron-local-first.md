# ADR 0001: Electron local-first architecture

- Status: Accepted
- Date: 2026-08-15

## Context

TheRSS needs a desktop UI, SQLite, secure local secrets, external feed access, local process integration for MCP/agents, and very fast personal iteration.

## Decision

Use Electron with a React/TypeScript/Vite renderer, a context-isolated preload API, main-process application services, SQLite/FTS5 storage, and an MCP stdio server that shares the domain/storage packages.

## Consequences

Positive:

- One TypeScript ecosystem for UI, feeds, providers, and agents.
- Fast renderer development and mature packaging.
- Straightforward local process and database access behind the main boundary.

Costs:

- Larger binary and memory footprint than Tauri.
- Native SQLite dependency needs Electron ABI rebuild and packaging checks.
- Reliable macOS automatic replacement updates remain gated on code signing.

## Guardrails

- No Node integration in the renderer.
- No direct database or secret access from the renderer.
- Domain/source/provider logic remains UI-independent and tested.
- A later shell migration must not require rewriting domain entities or source adapters.
