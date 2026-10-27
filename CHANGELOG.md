# Changelog

All notable changes to TheRSS are recorded here.

The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and the project
follows [Semantic Versioning](https://semver.org/spec/v2.0.0.html). Entries are derived from the
Conventional Commit history on `main`.

TheRSS is currently a personal beta. Builds are unsigned; public distribution still requires a
valid Developer ID, signing, and notarization.

## [Unreleased]

## [0.4.0] - 2026-10-27

Unsigned arm64/macOS 26+ pre-release. See the
[release notes](docs/audits/2026-10-27-v0.4.0-prerelease/RELEASE_NOTES.md).

### Added

- Apple-native window structure on the AppKit route (#58): a unified toolbar with the window
  title and a local search field, a source-list sidebar with Command-1 to Command-4, native
  Discover progress with Cancel, a segmented result-kind filter, a source picker in a popover,
  kind glyphs and a Saved star in rows, native empty states, Settings in its own window, a
  read-only record window on double-click, Share and row drag to other apps, macOS system text
  styles, and display dates in the system language.

### Changed

- Local search moved from a modal sheet to the toolbar search field; Command-F focuses it (#58).
- Discover fits the window without paging; only the list and reading panes scroll (#58).
- `smoke:sources` reports each source on its own line and no longer stops at the first failure,
  so the source-health issue names the failing probe (#65).
- Production dependencies: React and react-dom 19.3.1, lucide-react 1.61.0, fast-xml-parser
  5.11.2 (#64).
- The Web desktop E2E flow has its own 90 s budget and eleven named `test.step` phases, because
  CI macOS runners took 23.7-45.0 s for the same code (#69).
- Development dependencies: Vitest and `@vitest/coverage-v8` 5.0.5, upgraded together; Dependabot
  now groups `vitest` and `@vitest/*` (#70). Playwright 1.64.1, electron-builder 26.18.0, ESLint
  10.13.0, typescript-eslint 8.72.0, Prettier 3.9.10, jsdom 30.1.3 and other minor updates (#68).

### Fixed

- Rows place the subtitle under the measured title, and Settings fits each pane and refits after
  a zoom change (#58).
- Search details, notices and Analytics show plain labels, scoped notices and an empty-state for
  analysis history (#58).
- The native smoke stderr check treats the exact Chromium dead-port process-policy line as a
  platform diagnostic, as it already did for the invalid-argument form (#69).

### Security

- Lockfile-only update for new high-severity advisories: Electron 44.9.3, Zod 4.6.7, Vite 7.3.7,
  and transitive undici and body-parser (#63).
- The Vitest 5 upgrade removes the three moderate `vitest`/`@vitest/mocker` advisories; `npm audit`
  reports 0 vulnerabilities (#70).

## [0.3.0] - 2026-09-07

Unsigned arm64/macOS 26+ pre-release. See the
[release notes](docs/audits/2026-09-07-public-prerelease/RELEASE_NOTES.md).

### Added

- Complete AppKit working interface for Discover, Saved, Sources, Data Analytics, Settings and
  local search.
- Explicit Saved snapshot update that keeps Saved time and analysis history.
- Scheduled `Source Health` workflow that re-probes arXiv, GitHub, and the configured sources
  daily and files (or updates) a `source-health` issue on regression.
- macOS CI job running the Electron end-to-end flow, an unsigned `--mac dir` package, and the
  packaged-app smoke check. These gates were previously local-only.
- This changelog.

### Changed

- README now states the coverage measurement scope (`src/core` and `src/shared`) instead of
  presenting the figure as whole-repository coverage.

## [0.2.0] - 2026-08-24

Discover-centered retrieval, llm-wiki promotion, and the Apple-native design pass.

### Added

- **Discover as the primary search workflow.** A natural-language research question is expanded
  into an inspectable, bounded plan by a configured model, Codex, or Claude Code, then executed
  by TheRSS across the 22 live-verified sources. Replaces the overlapping Today/Interests
  surfaces. (`7227547`)
- **Promote to llm-wiki** for eligible arXiv papers: exact-version PDF download, local Codex
  full-text analysis, target-path preview, and a confirmation-gated vault write covering the PDF,
  source sidecar, L2 note, Topic/Method backlinks, and audit record. (`6135737`)
- **Personal Prompt** in Settings, applied as auxiliary Discover context while the current
  question remains the primary instruction. (`715e075`)
- Expanded local-first research workflow, including the searchable Sources directory over the
  22 retained sources with separated catalog membership, dated verification, record health, and
  local cache time. (`7e24df9`)
- Collapsible sidebar with pointer and keyboard width adjustment between 184–360 px, with
  Settings pinned to the bottom application tool region. (`9243453`)

### Changed

- Adopted Apple system typography — SF Pro Text for body and controls, SF Pro Display for
  display headings. Third-party font files are no longer bundled. (`e7fb39c`)
- Completed the native design remediation pass across Discover, Saved, Sources, and Analytics,
  including forced-colors and 200% zoom handling. (`a514197`)
- Search progress reports a genuine indeterminate state rather than a synthetic completion
  percentage, and result animation honors the macOS Reduced Motion setting. (`715e075`)

### Fixed

- Restored the native macOS window-close shortcut. (`ca24931`)
- End-to-end agent fixtures now use a portable working directory. (`fc1f6ed`)

### Security

- API keys are encrypted through Electron `safeStorage`; ciphertext only in SQLite, never
  returned to the renderer. Remote model endpoints must be HTTPS, with HTTP allowed only for
  loopback addresses.

## [0.1.0] - 2026-08-15

Initial public release: the daily discovery loop, the analysis loop, the personal beta package,
and first GitHub publication (milestones M1–M4).

### Added

- Interest configuration for arXiv categories/keywords/exclusions and GitHub
  keywords/topics/languages. (`29e87d7`)
- arXiv and GitHub source adapters with normalization, deduplication, deterministic ranking, and
  human-readable match reasons. (`29e87d7`)
- SQLite persistence, the Today view, triage states, and persisted source health. (`29e87d7`)
- Provider profiles for OpenAI-compatible (including DeepSeek-compatible) and
  Anthropic-compatible protocols, with encrypted secret storage and explicit connection testing.
  (`c6e502a`)
- Read-only MCP server exposing local discovery and analysis context to Codex, Claude Code, and
  other compatible clients. (`c6e502a`)
- Dedicated Saved shelf plus bounded, user-initiated local Codex/Claude CLI analysis with full
  provenance (provider, model, prompt version, source hash, timestamp). (`c6e502a`)
- Local Data Analytics covering result volume and deep-analysis provenance history. (`85577a0`)
- Personal beta packaging, the separately named `TheRSS Dev.app` install target, and the
  backup/migrate/install/rollback scripts. (`c6e502a`)
- CI workflow covering format, lint, type check, tests, coverage, build, and dependency audit.
  (`409cdef`)

[Unreleased]: https://github.com/dtjgp/TheRSS/compare/v0.4.0...HEAD
[0.4.0]: https://github.com/dtjgp/TheRSS/compare/v0.3.0...v0.4.0
[0.3.0]: https://github.com/dtjgp/TheRSS/compare/v0.2.0...v0.3.0
[0.2.0]: https://github.com/dtjgp/TheRSS/compare/v0.1.0...v0.2.0
[0.1.0]: https://github.com/dtjgp/TheRSS/releases/tag/v0.1.0
