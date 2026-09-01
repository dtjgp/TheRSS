# Notes: Apple-Native UI and Layered v6 Icon

## Current strengths

- Native hidden-inset titlebar and sidebar vibrancy.
- Hideable/resizable sidebar and resizable list-detail workspaces.
- SF Pro/system stack, system accent input, semantic colors, dark/high-contrast/forced-colors/reduced-motion support.
- Strong keyboard and evidence-state contracts.

## Current gaps

- Website-like sidebar brand lockup.
- Oversized 36-50px overview headings and 9-10px uppercase microcopy.
- Per-view action colors blur the distinction between system interaction accent and view identity.
- Idle/ready toolbar context is always a bordered pill with a dot.
- Many nested cards/pills/eyebrows; Sources is card-grid-first rather than list-detail-first.
- Native vibrancy and CSS blur may double-own materials; reduced-transparency and explicit inactive-window fallbacks are absent.

## References

- Apple HIG: Designing for macOS, Sidebars, Split Views, Materials, Color, Typography, App Icons.
- Apple Icon Composer: unmasked named layers; default/dark/mono plus clear/tinted rendering.
- Existing v5 design and packaging evidence under `docs/brand/icon-v5/`.
- Electron Builder local schema accepts legacy `.icns` or Icon Composer `.icon`.

## Evidence Log

- Prototype: `prototype.html` covers Discover, Sources, and Settings without external data or assets.
- Prototype screenshots passed after a sandbox-boundary retry: wide Discover, wide Sources, 820px Settings, and dark Discover.
- P0 RED: 8 intended failures across `AppTopbar`, `App.shell`, and style contracts.
- P0 GREEN: 3 files / 54 tests passed after the minimal production change.
- P0 full gate: `npm run check` passed 61 files / 418 tests with 90.29% statements, 80.15% branches, 93.64% functions, and 93.20% lines; all builds passed.
- P0 Electron: desktop flow passed serially with 28 durable screenshots; sidebar interaction passed serially. One parallel pointer-drag miss is recorded as a focus-contention flake.
- P1 RED: 3 intended failures for Sources list-detail and grouped-surface contracts.
- P1 GREEN: 4 focused files / 83 tests passed. Sources preserves all filters/actions/evidence and does not trigger a source request until the user selects a row.
- Final UI full gate: 61 files / 421 tests passed with 90.29% statements, 80.15% branches, 93.64% functions, and 93.20% lines; builds passed.
- Final serial Electron E2E: desktop plus sidebar 2/2 passed after focus/stepped-drag verifier hardening. Durable final screenshots cover wide/narrow/dark/forced colors/reduced motion and the final Sources list-detail.
- Diff review: no package dependency, SQLite, IPC, main/preload, source/provider, credential, or network boundary change; owned TS/TSX files remain <=800 lines.
- Icon selection revision: the exact 2026-09-01 user attachment is preserved byte-for-byte as `assets/brand/therss-icon-v6-mono-selected-source.png` (SHA-256 `5666b29794eac4e513bbf1c7935222bcde096d3f8e2271893d612f92e2660009`). Adding an opaque Alpha channel changed zero RGB pixels; the derived 1024px RGBA master is legible at 16/32/64/128.
- Package: the selected RGBA master equals `build/icon.png` (SHA-256 `024d9c83991a37d050902087267ea446e92eea0efe1bdb15b27b556a7672b5e4`); `package:mac` passed after the expected network-enabled retry; plist/resource checks passed; Quick Look renders the packaged ICNS correctly at 16/32/256; package smoke passed.
- Final full gate after all code/smoke updates passed again: 61 files / 421 tests with the same >=80% coverage and all builds green.
- Recoverable selected-icon install completed at `/Users/dtjgp/Applications/TheRSS Dev.app`. The first install request correctly stopped because the installer compares `app.asar` and this was an icon-only resource change; the reviewed `--force` path then retained the prior app and database backup. Installed/release app and icon hashes match, immutable read-only database integrity is `ok`, and installed-app fixture smoke passed.
- README publication refresh: replaced the hero screenshot with the final Discover results workspace and documented the Apple-native hierarchy, Sources list-detail layout, selected icon, accessibility fallbacks, and 2026-09-01 verification counts.
- Pre-commit publication gate: `npm run check` passed 61 files / 421 tests with all coverage dimensions >=80%; Electron E2E passed 2/2; `npm audit --audit-level=high` found 0 vulnerabilities; `git diff --check` and scoped secret scan passed.
- Git publication route: current `main` and `origin/main` were equal at `f0c3b96` with divergence `0/0`; the reviewed scope moved to `codex/apple-native-ui-icon` because direct `main` publication is protected. Feature commit `9d0a214` was pushed successfully; the remote pre-push gate repeated lint, typecheck, 61/421 tests, and build successfully. PR/merge/release remain outside this request.
