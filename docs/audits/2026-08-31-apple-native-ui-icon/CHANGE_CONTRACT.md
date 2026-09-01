# TheRSS Change Contract: Apple-Native UI and Layered v6 Icon

## Feature Intake

- User outcome: TheRSS should feel more like a native Apple/macOS research application, followed by a matching native-style app icon.
- Observed problem/evidence: current screenshots and CSS show solid platform foundations but retain a website-style brand lockup, oversized page typography, repeated card/pill/eyebrow treatments, view-colored primary actions, and a card-grid-first Sources surface. The approved v5 icon is legible and human/editorial but uses a pre-shaped textured squircle with flat baked layers and no appearance variants.
- Product fit and relevant non-goal: strengthens the local-first expert research workspace; it must not become an Apple.com marketing page, generic glass dashboard, news reader, or opaque AI surface.
- Alternatives considered, including no change: retain current UI/icon; P0 native polish only; accepted option B plus layered icon; broad Liquid Glass showcase. The accepted path is option B with restraint and staged proof.
- Cost: renderer/CSS/test/prototype/evidence work plus one icon-generation and package-validation lane; no new runtime service or external account.
- Boundary changes: renderer visual hierarchy and Sources composition may change; brand/package icon assets may change. Architecture, SQLite, IPC, security, network, providers, sources, llm-wiki, and updater remain frozen. The installed app was initially frozen; the 2026-09-01 acceptance change authorizes only a recoverable selected-icon replacement.
- Kill criterion: stop a slice if it weakens evidence states, keyboard paths, 820px/200% layouts, appearance/contrast, or package rollback, or if visual complexity requires a new runtime dependency.
- Decision: proceed in ordered UI prototype/TDD/verification slices, then icon generation and package rehearsal.

## Capability Contract

- Objective: deliver one coherent Apple-native renderer language and a layered research-signal v6 icon without changing data or product semantics.
- Goals: quieter native chrome; compact legible typography; system-accent interaction semantics; restrained grouped surfaces/materials; Sources list-detail scanning; accessible appearance fallbacks; layered icon identity with legacy package fallback.
- Non-goals: new data, model, source, analysis, account, sync, storage, IPC, network, update, marketing, or animation capability; SF Symbols migration; any installed-app change beyond the accepted recoverable selected-icon replacement; PR creation, merge, tag, or release. The README update, commit, and feature-branch push are explicitly authorized.
- Interfaces and public API invariants: existing navigation labels/destinations, preload/IPC contracts, renderer accessible names used by E2E, persisted sidebar/list widths, Command-F, menu commands, and user actions remain stable unless this contract logs a reviewed wording-only change.
- Data ownership and evidence semantics: SQLite remains operational source of truth; external titles/metadata/counts/provenance and complete/partial/no-result/failed/canceled/blocked/stale states remain unchanged.
- Failure states: overflow, clipping, lost focus, inaccessible contrast, ambiguous selection/action/status color, missing reduced-transparency fallback, broken inactive-window hierarchy, icon clipping/illegibility, package icon mismatch, or smoke failure.
- Migration and rollback: no data migration. UI rollback is the scoped renderer/test/CSS diff. Icon rollback restores v5 `assets/brand/therss-icon-v5.png` and `build/icon.png`/package configuration.
- Observability/diagnostics: semantic tests, style contracts, current-run screenshots, package plist/resource inspection, size/appearance icon matrix, and package smoke.
- Allowed scope: task-local artifacts; `PRODUCT.md` only if user-visible behavior description changes; renderer components/styles/tests and existing E2E fixtures/specs; brand/icon source and package configuration/evidence.
- Persistent writeback: contract, plan, notes, prototypes, screenshots, audit/closeout, changed UI/test files, new v6 icon provenance/package assets.

## Uncertainty Reducer

- Change class: redesigned UI flow plus packaging/icon change.
- Chosen artifact: one deterministic three-surface interactive prototype for Discover, Sources, and Settings; later one disposable `.icon`/ICNS package rehearsal.
- Question it must answer: whether the proposed hierarchy feels more macOS-native while preserving dense scanning and whether Sources list-detail remains legible at wide/narrow widths; whether layered icon assets survive Electron packaging and system presentation.
- What it does not prove: real provider/source correctness, personal aesthetic preference beyond accepted direction, App Store review, signing/notarization, updater identity, or installed-app behavior.

## Frozen Acceptance Contract

- RED verifier and expected failure: renderer/style tests must require the compact sidebar identity, system-accent primary actions/selections, quiet idle topbar context, 11px microcopy floor, reduced-transparency fallback, inactive-window treatment, compact page-title bounds, flatter grouped surfaces, and Sources list-detail semantics; current implementation fails these requirements.
- Focused unit/integration cases: sidebar brand tagline/gradient tile absent; topbar marks only working/attention states as emphasized; system accent owns primary actions and navigation selection while per-view tokens remain present; Sources exposes a labelled list and detail region with stable selected source; existing source filtering/open-content actions remain; CSS contracts cover radii, title sizes, microcopy floor, materials, reduced transparency, and inactive state.
- Migration/rollback cases: no SQLite/IPC/package migration in UI slices; v5 remains a byte-stable icon rollback source.
- E2E/manual path: launch fixture app; inspect Discover query/results and list-detail keyboard flow; Saved selection/actions; Settings personal/provider panes and local errors; Sources filter/select/detail/recent-content path; Analytics table; local search; sidebar hide/resize and 820px collapse.
- Screenshot/viewport/accessibility matrix: 1360x880 light/dark; 820x700 light; 200% zoom; forced colors; reduced motion; reduced transparency fallback inspection; active/inactive window visual comparison when callable.
- Security/dependency impact: renderer text remains React-escaped; no remote HTML, dependency, credential, IPC, network, or source change.
- Package/install/live opt-in impact: icon slice changes package inputs and requires `package:mac` plus smoke. The initial installed-app exclusion was superseded only by the 2026-09-01 accepted recoverable selected-icon replacement. The later README/commit/push request authorizes only a protected-main-compatible feature-branch push; signing, live sources/providers, llm-wiki writes, PR creation/merge, tags, and release remain out of scope.
- Full verifier: focused tests; architecture; full check/coverage/build; relevant Electron E2E and fresh screenshots; diff/secret/debug review; icon size/appearance and package plist/resource/smoke checks.
- Stop condition: all accepted UI/icon gates pass, no critical/high independent-review finding remains, and out-of-scope mutations are absent.

### Acceptance-change log

| Date       | Contract change                                                                                                            | Evidence/reason                                                                                                                                                                                                            | Reviewer   |
| ---------- | -------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------- |
| 2026-08-31 | Initial frozen contract                                                                                                    | User approved ordered execution of UI option B and icon direction I2                                                                                                                                                       | User/Codex |
| 2026-08-31 | Replace the E2E gradient-brand and fixed Discover-color assertions                                                         | P0 removes the website-style mark and assigns interaction color to the resolved macOS accent while retaining view identity elsewhere                                                                                       | Codex      |
| 2026-08-31 | Update the Settings E2E title-size oracle from 40px to 30px                                                                | The frozen P0 contract explicitly replaces marketing-scale headings with the accepted native 28-32px range; the failure proves the old oracle observed superseded behavior                                                 | Codex      |
| 2026-08-31 | Replace Sources card/article and drill-in/back test oracles with listbox/option selection and persistent detail            | The accepted P1 contract keeps source navigation and detail visible together; prior tests encoded the superseded grid-to-separate-page composition, not the data behavior                                                  | Codex      |
| 2026-08-31 | Rename the Discover workspace heading and remove its decorative eyebrow                                                    | The accepted prototype replaces marketing-style positioning with the functional `Discover research` workspace title while preserving the same search behavior                                                              | Codex      |
| 2026-08-31 | Replace the Sources marketing/count heading and uppercase detail eyebrow with functional titles; compact the summary strip | Final rendered review showed the list-detail workspace began below the initial viewport, so the native composition must prioritize the selectable list without removing evidence counts or boundaries                      | Codex      |
| 2026-08-31 | Focus the Electron window and use a stepped pointer drag in the sidebar E2E                                                | The unchanged exact-width assertion intermittently missed the first mouse move after the preceding desktop test released focus; explicit focus and steps harden the verifier without weakening behavior                    | Codex      |
| 2026-08-31 | Update the packaged smoke heading oracle to `Discover research`                                                            | The smoke reached the packaged renderer but timed out on the superseded heading; the accepted P1 wording change is already covered by unit and Electron E2E tests                                                          | Codex      |
| 2026-09-01 | Make the exact user-attached monochrome artwork the default package and recoverably installed icon                         | The user explicitly selected this version after the prior default/dark/mono exploration; preserve its original bytes as provenance, derive the 1024px RGBA package master from it, and keep prior variants as alternatives | User/Codex |
| 2026-09-01 | Refresh README and publish the verified change as a Git commit and branch push                                             | The user explicitly requested README update, commit, and push; current `main` is protected, so create and push `codex/apple-native-ui-icon` without creating or merging a PR absent separate authorization                 | User/Codex |

## Implementation Slices

1. RED: prototype-backed P0 renderer/style assertions.
2. Minimal GREEN: native chrome, typography, color roles, material/accessibility fallbacks.
3. Refactor: consolidate tokens/radii and preserve responsive/keyboard behavior.
4. Next slice gate: P0 focused/full/rendered review before Sources/list-detail P1.
5. P1 RED/GREEN: flatter grouped surfaces and Sources list-detail composition.
6. UI closeout: full renderer/Electron/accessibility/diff review.
7. Icon spike/generation: layered v6 sources, default/dark/mono previews, `.icon` plus PNG/ICNS fallback.
8. Package closeout: package/smoke/plist/resource/icon matrix; no install.
9. Selection revision: preserve the attached source, normalize the package master, and update icon provenance.
10. Installed closeout: repackage, verify system decoding, recoverably replace the local beta, and prove release/installed resource equality.
11. Publication: refresh README/current screenshot, rerun the full quality gate, commit the exact reviewed scope, and push the feature branch.

## Independent Review

- Product/contract fit: the renderer now reads as a compact macOS research utility without changing navigation destinations, research evidence, or user actions. Sources uses a persistent list-detail workspace and still exposes all 22 retained records, filters, health, provenance, bounded source content, errors, and links.
- Accidental scope or complexity: no package dependency, design system, font, icon family, animation library, endpoint, service, or persistence abstraction was added. The largest owned source remains below 800 lines.
- Test weakening: no behavioral assertion was removed to accommodate code. Superseded layout/text oracles were changed only after the acceptance log recorded the reviewed UI contract. E2E pointer hardening retained the exact target widths.
- Input/secret/untrusted-content boundaries: all source/model strings remain React text; no remote HTML or new input path exists. Secret/debug scans found no added credential or debug statement.
- SQLite/IPC/migration/rollback: no SQLite schema, repository, IPC, preload, source, provider, model, or llm-wiki diff. The local installer preserved the database and created a verified backup.
- Diagnostics/package/update impact: deterministic prototypes, style/component tests, full coverage/build, two Electron E2E flows, current screenshots, exact selected-source hash, icon size/appearance checks, plist/resource hashes, package smoke, install receipt, and installed smoke provide diagnostics. Updater/signing remain unchanged.
- Findings and resolutions: format drift fixed; a React effect-state lint finding was removed by remounting detail state on selected source; Sources was compacted after rendered review; focus-sensitive sidebar E2E drag was hardened; RGB-to-ICNS small-size decoding was investigated, package input normalized to RGBA, and Quick Look system decoding verified at 16/32/256. The icon-only install required the installer's explicit recoverable `--force` path because `app.asar` was unchanged. No critical/high finding remains.

## Evidence Closeout

- Changed files: renderer shell/topbar/Discover/Sources and native CSS/accessibility; focused unit/style/E2E/smoke oracles; `build/icon.png`; v6 color/dark/mono assets plus the exact selected monochrome source and 1024px package master; task/icon design and evidence documents.
- Deliberately untouched files: `package.json`/lock and dependencies; SQLite/schema/repositories; shared API/types; Electron main/preload/IPC; sources/adapters; model/agent services; llm-wiki writer; updater/release configuration; v1-v5 icon history.
- Focused RED/GREEN: P0 produced 8 intended failures then 54/54 green; P1 produced 3 intended failures then relevant 83/83 green. Final focused Source/UI suite remained green.
- `npm run check:architecture`: passed; all owned TypeScript/TSX files remain <=800 lines.
- `npm run check`: final pass 61 files / 421 tests; 90.29% statements, 80.15% branches, 93.64% functions, 93.20% lines; format, lint, types, coverage, renderer/main/preload/MCP builds passed.
- Electron E2E/rendered evidence: serial 2/2 passed. Current evidence covers Discover planning/search/results wide/820/dark/forced colors/200%, Saved, Settings dark/forced colors/200%, Analytics, Sources list-detail/detail, and sidebar resize/collapse/restore.
- Security/dependency/migration/package evidence: `git diff --check` passed; secret/debug scan empty; dependency/main/preload/shared/core diff empty. Selected-source/master identity checks, `package:mac`, plist/resource inspection, Quick Look icon render, package smoke, recoverable local install, immutable read-only database integrity, installed/release hash equality, and installed smoke passed.
- Live opt-in checks not run: real providers/sources, real llm-wiki writes, signing/notarization, updater transition, App Store submission, Git push/PR/release.
- Residual risks/blockers: true Icon Composer `.icon` authoring remains deferred because the generated appearance masters are flattened rather than independently editable layers. Current verified PNG/ICNS path is complete. The installed beta remains unsigned by design.
- Rollback path: restore renderer/test/CSS diff; copy `assets/brand/therss-icon-v5.png` to `build/icon.png`; rerun package/install. The previous installed app and database backup are retained at the recorded timestamped paths.
- Git/install/push/publication state: `/Users/dtjgp/Applications/TheRSS Dev.app` is updated with a completed receipt. Feature commit `9d0a214` and the documentation closeout are published on `origin/codex/apple-native-ui-icon`; the local branch tracks that remote branch. No PR, merge, tag, release, or other third-party publication occurred.
