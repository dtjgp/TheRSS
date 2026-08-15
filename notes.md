# Notes: TheRSS

## User intent

- Daily discovery of relevant or potentially interesting arXiv papers.
- Daily discovery of relevant or potentially interesting GitHub repositories/trends.
- Personal interest configuration through topics and keywords.
- Selected-item analysis through Codex, Claude Code, user-supplied model APIs, or a DeepSeek harness.
- Very low-friction development updates and bug-fix iteration.
- Initial repository name: `TheRSS`.
- Project planning and quality gates should follow Google-style engineering practice.

## Confirmed local context

- Target path `/Users/dtjgp/Projects/TheRSS` was absent before this project was initialized on 2026-08-15.
- Existing llm-wiki remains a separate canonical research knowledge base; TheRSS should integrate through narrow, previewable interfaces rather than owning the vault.
- The previous RSSReader application data and updater artifacts were removed from their active paths before this project began.

## Evidence to collect

- Official Google engineering-practice guidance relevant to design review, code review, testing, and launch.
- Official arXiv API/export behavior and rate guidance.
- Official GitHub APIs that can support an explainable approximation to repository trends.
- Current Codex and Claude Code MCP/CLI integration guidance.
- Current macOS personal-development and later distribution/signing constraints.

## Research findings

### Google engineering practices

- Source: <https://google.github.io/eng-practices/>
- Review should improve overall code health while permitting steady progress.
- Small, self-contained changes are easier to review, test, merge, and roll back.
- Tests should accompany production behavior and the build should remain working after each change.
- Reviews should cover design, functionality, complexity, tests, naming, documentation, and system context.

### arXiv

- Source: <https://info.arxiv.org/help/api/user-manual.html>
- The query API returns Atom 1.0 and supports category/field queries, paging, and submitted/updated sorting.
- Consecutive calls should be spaced by about three seconds.
- The same query does not need production polling more than once per day; results should be cached.

### GitHub

- Sources: <https://docs.github.com/en/rest/search/search> and <https://docs.github.com/en/search-github/searching-on-github/searching-for-repositories>
- Repository search supports name/description/topic/README terms plus stars, forks, created, pushed, language, topic, archived, and fork qualifiers.
- Search has a distinct rate limit: currently 30 authenticated or 10 unauthenticated requests per minute for non-code search.
- GitHub provides no stable official REST endpoint for the website's Trending ranking. The initial product must label its result `GitHub Interest Radar`, not `Official Trending`.

### Agent integration

- Codex and Claude Code both support MCP servers.
- One local MCP contract can serve both clients and avoid split read/triage state.

### Electron updates

- Electron documents that macOS automatic updates require a signed application.
- The unsigned personal-beta path should use hot reload and an explicit local build/install/rollback command rather than claim silent production updates.

## Working product hypothesis

TheRSS wins by combining deterministic, provenance-preserving discovery with a deliberate handoff to stronger analysis tools. It should not attempt to replace Zotero, Obsidian, llm-wiki, Codex, or Claude Code.

## Completion-audit findings

- The first local beta required manual refresh after every new day, which did not fully prove the promise that opening the app yields the day's signal. The accepted behavior is one automatic refresh on the first configured open of each local calendar day, same-day suppression, manual retry, and preservation of the last verified inbox on failure.
- Initial analysis artifacts identified the item, model, provider, prompt version, and time but not the exact source snapshot. They now require a SHA-256 hash over every discovery field included in the prompt so later metadata changes cannot silently blur provenance.
- A successful empty source response was previously labeled the same as a non-empty success. The persisted result count now derives an explicit `no_results` dashboard state without changing the legacy status constraint.
- A process exit during `refreshing` previously left a current-day timestamp that could suppress the next startup attempt. Only terminal source states now contribute to `lastRefreshAt`, so an interrupted refresh is retried on the next open.

## Environment findings

- Node `v26.7.0`, npm `11.19.0`, Git `2.55.0`, GitHub CLI `2.97.0`, Apple Silicon macOS `26.6.2`, and Xcode are present.
- On 2026-08-15, a network-enabled `gh auth status` confirmed an active keyring login for `dtjgp` with `repo` and `workflow` scopes. `dtjgp/TheRSS` did not yet exist; repository creation still requires an explicit public/private visibility choice.

## 2026-08-15 final local release audit

- `npm run check` passed: 17 test files and 72 tests passed; global coverage was 93.17% statements, 82% branches, 97.24% functions, and 94.8% lines.
- The Electron critical-path E2E passed with desktop execution permission. The restricted-sandbox `SIGABRT`/`EPERM` launch failure was environmental and reproduced the already documented sandbox boundary.
- Live source smoke passed with arXiv=3 and GitHub=25.
- The MCP stdio smoke passed all three read-only tools and verified source-hash provenance without secret fields.
- Electron `safeStorage` encryption/decryption passed, `npm audit --audit-level=high` reported zero vulnerabilities, and tracked-file secret-pattern review found no credentials.
- `npm run install:local` backed up the existing SQLite database, retained the previous application, installed the current build, and the packaged-app smoke passed.
- The local worktree was clean at commit `85577a0` before this audit writeback. GitHub publication and CI remain the only founding-goal evidence not yet available.

## 2026-08-15 publication evidence

- The user explicitly selected public visibility. The repository was created at <https://github.com/dtjgp/TheRSS> with `main` as its default branch.
- Initial local and remote `main` matched at `c41e63dce75eee258f9325ef20e23d5ad25a7380`.
- GitHub Actions run <https://github.com/dtjgp/TheRSS/actions/runs/31894821844> passed `npm ci`, `npm run check`, and `npm audit --audit-level=high`.
- A real `npm run update:local` completed from the new remote and preserved the database/application rollback artifacts.
- The first CI run warned that v4 GitHub Actions used deprecated Node.js 20; the workflow was updated to the official current `actions/checkout@v7` and `actions/setup-node@v7` lines.
- The local update used Node.js 24.13 and emitted a non-blocking `jsdom` engine warning; project setup now documents Node.js 24.15+ or 26. The full test, coverage, build, packaging, and install gates still passed.
- The personal beta remains intentionally unsigned and currently uses Electron's default icon. Signing/notarization and release branding remain later public-distribution work, not founding-goal requirements.
