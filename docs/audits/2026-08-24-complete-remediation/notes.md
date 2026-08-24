# Notes: TheRSS Complete Audit Remediation

## Evidence Ledger

- Governing product files confirm a five-surface implementation but retain Discover/Saved as the
  daily outcome; Settings is configuration rather than a research-content destination.
- Open findings come from `docs/audits/2026-08-24-software-design/audit-report.md` D5–D7/D10–D11,
  `docs/audits/2026-08-24-post-slice-a/audit-report.md` R5–R10, and the remaining-scope section of
  the Slice B implementation report. D1–D4/D8–D9 and R1–R4 are already closed and regression-tested.
- Current branch: `codex/llm-wiki-promotion-closure`, tracking its matching origin branch. Existing
  tracked renderer/E2E modifications and untracked audit evidence belong to the current design work
  and must be preserved.
- Installed baseline: `/Users/dtjgp/Applications/TheRSS Dev.app`, version `0.2.0`, bundle ID
  `dev.dtjgp.therss`, `app.asar` SHA-256
  `01da4ade39893e0c89a8f3a43a2c16d4abe4e38219488ee8849331ce23a0c094`.
- Live SQLite baseline: `/Users/dtjgp/Library/Application Support/therss/therss.sqlite`; read-only
  immutable `PRAGMA integrity_check` returned `ok` before implementation.
- UI/UX Pro Max returned a generic SaaS/Inter recommendation. It contributes scanability and
  crisp-boundary guidance only; its font, landing-page, and indigo assumptions conflict with the
  accepted Apple system typography and research-desk identity and are intentionally rejected.

## Finding Matrix

| Finding                                | Planned source boundary                                                          | Acceptance evidence                                                                     | State  |
| -------------------------------------- | -------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------- | ------ |
| Settings placement and unsaved changes | `App`, extracted `SettingsView`, native IPC/menu                                 | utility Settings entry, Command-, path, guarded navigation/window close                 | closed |
| Provider test/credential lifecycle     | shared model/API schemas, provider service, model gateway, IPC/preload, Settings | success/auth/DNS/model/timeout/protocol fixtures; no key in result/log/renderer summary | closed |
| Source timestamps and attention entry  | dashboard DTO/repository, App sidebar, Sources                                   | per-source observed-at/error, clickable attention filter, stale/failed matrix           | closed |
| Source terminology and locale          | Sources renderer + catalog presentation                                          | full research-axis names; adapter/Folo details only in provenance disclosure            | closed |
| Field accessibility and contrast       | Settings fields + renderer accessibility CSS                                     | `aria-invalid`/`aria-describedby`, alert/status, contrast/forced-color contracts        | closed |
| Resizable list/detail workspace        | Saved workspace + persistent renderer width                                      | pointer/Arrow/Home/End, persistence, narrow-window capping                              | closed |
| Window restoration                     | Electron main window-state module                                                | validated/clamped bounds, maximized restoration, corrupt-state fallback                 | closed |
| Receipt/action visual order            | Saved detail structure                                                           | action buttons remain one row; receipt renders as separate status line                  | closed |
| Visual/card density and micro labels   | Sources/Analytics/settings CSS                                                   | fewer nested card layers and minimum critical-label size                                | closed |
| Renderer/CSS maintainability           | extract Settings and split component styles                                      | App/style size reduction plus full visual regressions                                   | closed |
| Product terminology drift              | `PRODUCT.md`, `docs/DESIGN.md`, audit closure                                    | Settings/current recorded-health wording matches implementation                         | closed |

## Security Boundary

- Never expose plaintext provider secrets to the renderer, logs, exports, MCP, or source control.
- Only HTTPS and explicitly permitted loopback HTTP endpoints are valid.
- Live provider/source verification remains opt-in and is not required for deterministic tests.

## Installation Boundary

- Rebuild and install only after every code, security, accessibility, Electron, and visual gate
  passes.
- Preserve the previous app and create/check a database backup before accepting the install.

## Implementation Order

1. Settings/provider security boundary and unsaved-change guard.
2. Source truth/terminology/actionable attention.
3. Resizable workspace, window restoration, accessibility and visual polish.
4. Component/CSS/document decomposition and complete verification.
5. Figma closure, then reversible installation.

## Final Verification Evidence

- `npm run check`: 52 files / 328 tests passed.
- Coverage: 90.46% statements, 80.47% branches, 93.99% functions, 93.43% lines.
- Electron source-build E2E: 2/2 passed, including AX tree, forced colors, 200% zoom, native
  shortcuts, navigation scroll reset, sidebar/list split persistence, and window restoration.
- Production dependency audit: zero vulnerabilities.
- Installed-binary desktop E2E: 1/1 passed.
- Packaged smoke: passed against `/Users/dtjgp/Applications/TheRSS Dev.app`.
- Release and installed `app.asar` SHA-256:
  `660b14781f643a6c0a2d7cb51e53afb5472f3df6b299d079bf518537054eafa5`.
- Installed bundle: version `0.2.0`, ID `dev.dtjgp.therss`.
- Database backup and live database read-only integrity: both `ok`.
- Database backup:
  `/Users/dtjgp/Library/Application Support/therss/backups/therss-2026-08-24T14-14-54-159Z.sqlite`.
- Superseded app:
  `/Users/dtjgp/Applications/TheRSS Dev.backup-2026-08-24T14-14-54-159Z.app` was subsequently
  validated and permanently removed at the user's request.
- Figma closure: blocked before mutation by the authenticated Starter plan's MCP call limit.

## Publication Closure Notes

- The user explicitly authorized full-worktree staging and publication to GitHub `main`.
- Cleanup scope is old `TheRSS Dev.backup-*.app` bundles only. The current `TheRSS Dev.app`, live
  SQLite database, and timestamped SQLite backup remain protected.
- Do not move `.app` bundles through Trash because the previous app-cleaner integration also moved
  active Application Support, cache, and preferences. Validate exact targets, then remove only those
  explicit backup bundles.
- Cleanup found exactly one obsolete app:
  `/Users/dtjgp/Applications/TheRSS Dev.backup-2026-08-24T14-14-54-159Z.app`, bundle ID
  `dev.dtjgp.therss`, old `app.asar` SHA-256
  `01da4ade39893e0c89a8f3a43a2c16d4abe4e38219488ee8849331ce23a0c094`.
- That exact directory was permanently removed. The active app remains at
  `/Users/dtjgp/Applications/TheRSS Dev.app` with SHA-256
  `660b14781f643a6c0a2d7cb51e53afb5472f3df6b299d079bf518537054eafa5`; live and retained backup
  SQLite integrity both remain `ok`.
- The first sandboxed branch switch could not create `.git/index.lock`. The approved retry created
  `codex/complete-design-remediation` directly from the tree-identical current `origin/main` while
  preserving the full worktree.
- `codex/complete-design-remediation` starts from `origin/main` tree
  `1b99ac9cbbad49511e0638507bdbd1d3b46dbc93`. The full untracked audit set is about 12 MB; its
  largest file is about 421 KB, and all `.png` files report PNG image data.
- Final pre-publication gates: `npm run check` passed 52 files / 328 tests at 90.46% statements,
  80.47% branches, 93.99% functions, and 93.43% lines; Electron E2E passed 2/2; production npm audit
  found zero vulnerabilities; diff/secret/debug/unsafe-renderer/symlink/large-file scans were clean.
- Full-worktree commit `108777145a78aa5c1e642520789d8fb6c37408aa` was pushed to
  `codex/complete-design-remediation`. PR #15 passed required `quality` and was rebase-merged.
- GitHub `main` and `git ls-remote` both report
  `a514197d66976f1303063453f58f752d7a545bbb`. Its tree SHA
  `7cc6148753a7e624c9abcf8a94d09b8de299b47d` exactly matches the feature commit tree, proving that
  all authorized files landed despite the expected 1/1 commit-SHA divergence from rebase.
