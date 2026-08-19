# Requirements Traceability

This matrix is the completion audit for the founding request. `Planned` is not completion evidence.

| ID  | Requirement                                            | Planned implementation                                                   | Required evidence                              | Status                                        |
| --- | ------------------------------------------------------ | ------------------------------------------------------------------------ | ---------------------------------------------- | --------------------------------------------- |
| R1  | Project exists under `Projects/TheRSS`                 | Repository root and governance docs                                      | Filesystem and Git status                      | Verified locally                              |
| R2  | Subscribe to relevant arXiv directions and keywords    | Interest rules + arXiv adapter                                           | Unit/integration/E2E and live opt-in smoke     | Verified: tests + live arXiv=3                |
| R3  | Discover interesting GitHub trends/repos               | GitHub Interest Radar                                                    | Query/scoring tests, E2E, live opt-in smoke    | Verified: tests + live GitHub=25              |
| R4  | Daily app shows relevant/potentially interesting items | Once-per-day startup/manual refresh + Today view                         | Unit, critical E2E, and packaged smoke         | Verified: unit + E2E + installed smoke        |
| R5  | Analyze papers/repos with Codex or Claude Code         | Shared read-only MCP plus bounded direct local CLI analysis              | Unit, E2E, live CLI, MCP and stdio smoke       | Verified locally through both CLIs            |
| R6  | Configure own model API or DeepSeek harness            | Provider profiles, encrypted secrets, source-hashed analysis artifacts   | Security/provider/provenance tests and E2E     | Verified: tests + safeStorage + installed UI  |
| R7  | Fast iteration and bug fixes                           | HMR, deterministic tests, dev install/update command                     | Local install/package smoke; remote update     | Verified: local and real-remote update passed |
| R8  | Name is TheRSS                                         | Package/app/repository metadata                                          | Built artifact and remote repository           | Verified: installed app + public repository   |
| R9  | Initial project pushed to GitHub                       | Repository creation and push                                             | Remote URL, commit, `git ls-remote`, CI        | Verified: public remote + matching SHA + CI   |
| R10 | Google-style project planning                          | Design doc, goals/non-goals, small changes, tests, review/release gates  | Governance files and commit history            | Verified locally                              |
| R11 | Dedicated saved-paper and repository shelf             | Saved navigation view backed by persisted triage state                   | Renderer unit test and Electron E2E            | Verified locally                              |
| R12 | Semantic expansion search by model, Codex, or Claude   | Validated plan + controlled arXiv/GitHub execution + separate sessions   | Unit, repository, renderer, E2E, source smoke  | Verified: fixtures + live sources             |
| R13 | Daily search and deep-analysis visibility              | Local analytics aggregate + append-only Today activity + artifact ledger | Repository, renderer, E2E, coverage, build     | Verified locally                              |
| R14 | Inspect the selected 106 research sources in TheRSS    | Typed immutable catalog + searchable/filterable Sources view             | Catalog invariants, renderer tests, E2E, build | Verified: 147 tests + Electron E2E            |
