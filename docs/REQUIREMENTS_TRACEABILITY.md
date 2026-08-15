# Requirements Traceability

This matrix is the completion audit for the founding request. `Planned` is not completion evidence.

| ID | Requirement | Planned implementation | Required evidence | Status |
|---|---|---|---|---|
| R1 | Project exists under `Projects/TheRSS` | Repository root and governance docs | Filesystem and Git status | In progress |
| R2 | Subscribe to relevant arXiv directions and keywords | Interest rules + arXiv adapter | Unit/integration/E2E and live opt-in smoke | Planned |
| R3 | Discover interesting GitHub trends/repos | GitHub Interest Radar | Query/scoring tests, E2E, live opt-in smoke | Planned |
| R4 | Daily app shows relevant/potentially interesting items | Refresh orchestration + Today view | Critical E2E and packaged smoke | Planned |
| R5 | Analyze papers/repos with Codex or Claude Code | Shared MCP request/artifact contract | MCP integration tests and setup proof | Planned |
| R6 | Configure own model API or DeepSeek harness | Provider profiles, encrypted secrets, OpenAI-compatible/Anthropic adapters | Security/provider tests and UI E2E | Planned |
| R7 | Fast iteration and bug fixes | HMR, deterministic tests, dev install/update command | Timing/run evidence and update smoke | Planned |
| R8 | Name is TheRSS | Package/app/repository metadata | Built artifact and remote repository | In progress |
| R9 | Initial project pushed to GitHub | Repository creation and push | Remote URL, commit, `git ls-remote`, CI | Blocked by invalid local `gh` credential |
| R10 | Google-style project planning | Design doc, goals/non-goals, small changes, tests, review/release gates | Governance files and commit history | In progress |
