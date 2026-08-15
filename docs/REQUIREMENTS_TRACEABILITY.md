# Requirements Traceability

This matrix is the completion audit for the founding request. `Planned` is not completion evidence.

| ID  | Requirement                                            | Planned implementation                                                  | Required evidence                           | Status                                       |
| --- | ------------------------------------------------------ | ----------------------------------------------------------------------- | ------------------------------------------- | -------------------------------------------- |
| R1  | Project exists under `Projects/TheRSS`                 | Repository root and governance docs                                     | Filesystem and Git status                   | Verified locally                             |
| R2  | Subscribe to relevant arXiv directions and keywords    | Interest rules + arXiv adapter                                          | Unit/integration/E2E and live opt-in smoke  | Verified: tests + live arXiv=3               |
| R3  | Discover interesting GitHub trends/repos               | GitHub Interest Radar                                                   | Query/scoring tests, E2E, live opt-in smoke | Verified: tests + live GitHub=25             |
| R4  | Daily app shows relevant/potentially interesting items | Once-per-day startup/manual refresh + Today view                        | Unit, critical E2E, and packaged smoke      | Verified: unit + E2E + installed smoke       |
| R5  | Analyze papers/repos with Codex or Claude Code         | Shared read-only MCP context contract                                   | MCP integration tests and stdio smoke       | Verified locally; client setup documented    |
| R6  | Configure own model API or DeepSeek harness            | Provider profiles, encrypted secrets, source-hashed analysis artifacts  | Security/provider/provenance tests and E2E  | Verified: tests + safeStorage + installed UI |
| R7  | Fast iteration and bug fixes                           | HMR, deterministic tests, dev install/update command                    | Local install/package smoke; remote update  | Local loop verified; remote pull awaits R9   |
| R8  | Name is TheRSS                                         | Package/app/repository metadata                                         | Built artifact and remote repository        | Installed app verified; remote awaits R9     |
| R9  | Initial project pushed to GitHub                       | Repository creation and push                                            | Remote URL, commit, `git ls-remote`, CI     | Blocked by invalid local `gh` credential     |
| R10 | Google-style project planning                          | Design doc, goals/non-goals, small changes, tests, review/release gates | Governance files and commit history         | Verified locally                             |
