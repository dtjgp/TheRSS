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
- `gh auth status` reports that the active `dtjgp` token is invalid. Local implementation can continue, but GitHub repository creation/push will require re-authentication or another authorized GitHub connector.
