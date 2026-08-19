# ADR 0002: Saved inbox and bounded local-agent analysis

- Status: Accepted
- Date: 2026-08-15

## Context

The persisted `saved` triage state had no dedicated product surface. Codex and Claude Code could read TheRSS through MCP, but the in-app Analyze action could only call a configured HTTP model provider. The user needs one Saved shelf for papers and repositories and a direct, user-initiated way to analyze either source with locally authenticated Codex or Claude Code.

## Decision

- Add a Saved navigation view backed by the existing SQLite `triage_state = 'saved'` data. Keep source filtering and do not create a second bookmark database.
- Add an explicit analysis-runner selector with `Model provider`, `Codex CLI`, and `Claude Code`.
- Detect local CLIs in the application process without invoking a shell. Support normal `PATH`, common macOS installation locations, NVM installations, and explicit `THERSS_CODEX_PATH` / `THERSS_CLAUDE_PATH` overrides.
- Launch a fresh non-interactive process for every request. Do not attach to or modify an already open interactive session.
- Store local-agent output in the existing `analysis_artifact` table with runner identity, prompt version, source-snapshot hash, and timestamp.

## Security and privacy

- Renderer access remains limited to typed preload methods; runner selection is allowlisted with Zod at IPC.
- Source metadata is passed through stdin, never interpolated into a shell command or executable path.
- Claude Code runs with safe mode, no tools, no session persistence, and non-interactive permissions.
- Codex runs with user configuration ignored, an ephemeral session, a temporary working directory, read-only sandboxing, and the shell tool disabled.
- Child processes receive a small environment allowlist rather than arbitrary application secrets.
- Output is limited to 2 MB, execution to 120 seconds, and stderr is not returned to the renderer.

## Alternatives considered

- Attaching to an open Codex/Claude conversation: rejected because neither CLI exposes a stable, safe generic attachment contract for this UI action, and it would mix unrelated conversation state.
- Giving the agent the full repository or filesystem: rejected because discovery metadata is sufficient for this action and source text is untrusted.
- Creating separate Saved paper and repository stores: rejected because source type already exists on the shared discovery entity.

## Failure and recovery

- A missing, signed-out, timed-out, non-zero, empty, or oversized runner response fails only that analysis request.
- The discovery inbox and saved items remain unchanged after an analysis failure.
- Configured HTTP-provider analysis and the read-only MCP contract remain available as independent paths.

## Verification

- Unit tests cover CLI availability, argument construction, stdin isolation, missing executables, timeout, output bounds, service routing, and persisted provenance.
- Renderer tests cover the combined Saved shelf, source filtering, runner selection, and result display.
- Fixture-driven Electron E2E covers model analysis, Codex-path analysis, and saved paper/repository navigation without calling live external services.
