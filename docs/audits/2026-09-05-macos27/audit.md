# macOS 27 alignment and branch consolidation

## Result

The desktop now follows Apple's macOS 27 edge-aligned sidebar, semibold selection and uniform toolbar guidance, with compact system typography and stable research content surfaces. Sources has independently scrolling panes and keyboard navigation; local search contains and restores keyboard focus. All screenshots use deterministic fixtures, not live research claims.

## Source-based design decisions

- [Apple macOS 27 design resources](https://developer.apple.com/design/resources/) and [WWDC26 AppKit updates, 14:24](https://developer.apple.com/videos/play/wwdc2026/289/): sidebar meets window edges; selected labels use semibold; text-bearing titlebars require a clear scroll edge.
- [Materials](https://developer.apple.com/design/human-interface-guidelines/materials): navigation and controls may use material; reading content stays opaque. The existing Electron native window/menu/vibrancy is retained, with CSS adaptation in the renderer.
- [WWDC26 platform overview](https://developer.apple.com/videos/play/wwdc2026/102/): macOS 27 refines window geometry and contrast. Corner values here are implementation choices, not claimed official measurements.

## Current-run visual audit

| Step | Surface           | Observed issue and final behavior                                                                                                                                           | Evidence                                                                        |
| ---- | ----------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------- |
| 1    | Discover entry    | Removed redundant brand/status framing through the merged Apple branch; now compact titles, clear toolbar, edge sidebar and semibold selection                              | [Before](before/discover.png), [After](after/discover.png)                      |
| 2    | Results and Saved | Stable content background, compact detail heading and legible metadata; distinct Saved/evidence states remain                                                               | [Results](after/results.png), [Dark](after/results-dark.png)                    |
| 3    | Settings          | Shared26px heading hierarchy and grouped inputs; original draft/error/confirmation behavior preserved                                                                       | [Settings](after/settings.png)                                                  |
| 4    | Sources           | Bounded desktop panes, content-start alignment and one Tab entry; arrows/Home/End move focus without retrieval, Enter/Space activate                                        | [Sources](after/sources.png)                                                    |
| 5    | Analytics         | Compact headings and consistent content groups; recorded counts/provenance unchanged                                                                                        | [Analytics](after/analytics.png)                                                |
| 6    | Accessibility     | 18 primary-control accent/appearance combinations reach4.5:1; reduced transparency removes overlay blur, forced colors retains state, local search traps and restores focus | [Forced colors](after/forced-colors.png), [Zoom](after/results-200-percent.png) |

## Skills and plugin routing

Applied or adapted: TheRSS UI Improvement and its three project references; frontend-design, design-taste-frontend, ui-ux-pro-max, frontend-patterns, web-design-reviewer, Product Design audit/preflight, Playwright, e2e-testing, documentation-lookup for the installed Electron44 API, Git Workflow, Planning with Files, Daily Coding and Verification Loop. The detailed applicability inventory is in notes.md.

The user-selected Apple direction and existing product override contradictory marketing recipes. gpt-taste/AIDA/GSAP/random layout, new web frameworks, presentation workflows, hosted Sites/Open Design generation and Figma file creation have no applicable work here. No visual framework, font, icon family, plugin or service was installed. Existing selected monochrome icon from the Apple branch is preserved.

## Verification

- Host: macOS27.0 build26A5425a; Electron44.0.0; supported bundled Node24.19.0.
- Full check:61 files /433 tests; architecture, format, lint, types, coverage and build pass.
- Core/shared coverage:90.29% statements,80.15% branches,93.64% functions,93.20% lines. This scope excludes renderer/main/preload.
- Changed components separately measured: LocalSearchPanel92.75/88.37/100/94.73%; SourceCatalogView93.1/83.78/90.24/98.4% (statements/branches/functions/lines).
- Desktop4/4 pass: original research critical path and sidebar resizing, new appearance/contrast/material test, Sources last-row selection/scroll test.200% capture now uses Electron's compositor to avoid Chromium screenshot cropping; the added geometry and root-scroll assertions verify accessible results at200% zoom.
- RED evidence: sidebar500 instead of600 weight; primary blue contrast4.016975780478911; source list had scrollHeight==clientHeight; local-search keyboard and focus-return regressions.
- Native smoke: all checks pass for OS accent, actual NSMenu opening, application menu and accelerators; clipboard/external-open sinks are stubbed. No system clipboard roundtrip is claimed.
- Current dependency audit:0 vulnerabilities. Compatible updates repair inherited fast-uri, xmldom and qs advisories without changing the audit gate.
- Unsigned macOS arm64 package and packaged preload/startup smoke pass. app.asar SHA-256: `43a1c96485be3aa069942a570e2469dc9dd7d81092b107df0bdeb0864729c080`.
- Independent review: initial P1 clipboard API and P2 contrast/Source scrolling/keyboard findings all resolved and re-reviewed with no remaining code blocker.

## Branch preservation and publication procedure

| Original ref                          | Preservation evidence                                                         |
| ------------------------------------- | ----------------------------------------------------------------------------- |
| codex/compact-ui-release61f1188       | Exact tree equality with merged PR35 at69a0082                                |
| codex/compact-release-closeout7ecb53c | Exact tree equality with merged PR36 atf0c3b96                                |
| codex/apple-native-ui-icon828db9e     | Integration branch starts at this tip; both unique original commits preserved |
| Dependabot Electron6b491db /PR39      | Direct version44.0.0 retained, package/native smoke verified                  |
| Dependabot productionc790016 /PR40    | All three direct updates retained                                             |
| Dependabot development7596c07 /PR41   | All eight direct updates retained                                             |

All original refs and complete history are also recoverable from the verified local47MB `output/branch-backups/2026-09-05-before-consolidation.bundle`, deliberately excluded from Git. The integration is submitted as one squash PR because main enforces strict quality/desktop checks and linear history. After success, compare the integrated and actual merge trees, fast-forward main, close superseded dependency PRs, remove preserved refs and verify local/remote main equality. Publication completion is reported from live Git/GitHub output in the task, not inferred here before the remote operation.

## Boundaries and remaining limitations

This is an Electron/React/native-CSS implementation on macOS27, not a SwiftUI/AppKit rewrite or pixel-identical native Liquid Glass. Actual window corners and compositor behavior remain system-owned. The zoom layout uses two-column filters and naturally scrolling stacked content. CSS supports browser-exposed reduced transparency/increased contrast; the macOS27-specific native Show Borders setting is not bridged separately. Automated accessibility checks are bounded and do not certify universal accessibility compliance.

Node26.7 triggered a Vitest/jsdom localStorage test-environment incompatibility; the full gate passes with supported Node24.19.0. Default shell Node24.13 is below package engines. No application runtime regression was observed on Electron44.

This run did not replace the installed application, publish a GitHub Release, call live providers/sources, or write the real vault. Latest historical live-source check remains2026-08-19. Rollback uses git revert; original branch histories have a separate verified local bundle.
