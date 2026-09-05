# Evidence notes

## Official sources

- https://developer.apple.com/design/resources/ — macOS 27 design kit.
- https://developer.apple.com/design/human-interface-guidelines/materials — Liquid Glass belongs to navigation/controls; content uses standard material, with accessibility fallbacks.
- https://developer.apple.com/documentation/TechnologyOverviews/liquid-glass — system frameworks supply native rendering; Electron CSS requires an explicit approximation boundary.

## Branch state

Fresh fetch: three Dependabot PRs (#39 Electron 44, #40 production group, #41 development group), Apple-native branch, and two local compact branches with merged PRs. Preserve all unique changes before deletion. Only one worktree.

## Skill routing

Project-native CSS, SF system fonts, semantic colors, Lucide, compact list-detail, reduced motion and honest provenance remain binding. Skill applicability audit in progress.

## Version-specific Apple evidence

- https://developer.apple.com/videos/play/wwdc2026/289/ (14:24): macOS 27 edge-aligned sidebar, semibold selected label, hard scroll edge behind free-floating title text; use this over older sidebar examples.
- https://developer.apple.com/videos/play/wwdc2026/102/: tighter consistent window geometry and accessibility border presentation; native runtime limitations remain explicit.

## Skills applied and adapted

TheRSS UI Improvement, frontend-design, design-taste-frontend, ui-ux-pro-max, frontend-patterns, web-design-reviewer, Product Design audit, e2e-testing and Playwright: current screenshot audit, semantic CSS, controlled React state, explicit errors, compact list-detail, keyboard/focus and viewport verification. Git Workflow, Planning with Files and Daily Coding support delivery. ui-ux-pro-max search misclassified this as SaaS; reject its Inter/hero recommendation. Product Design preflight found no saved context, so current repo and explicit Apple direction are sufficient. Figma's official Apple kit is reference-only; no user file needs creating. gpt-taste AIDA/randomization/GSAP, Next/Bun/Gradio frameworks, presentation/marketing workflows, Open Design generation and Sites hosting are not applicable to this Electron application. No new plugin or visual dependency was installed.

## Baseline findings

Fresh main captures inspected: boxed redundant sidebar brand and ambient topbar status, large display headings competing with research content, heavy grouped surfaces. Existing Apple branch already reduces part of this. Additional macOS27 slice fixes edge material exposure, semibold selection, opaque toolbar contrast, consistent compact typography and control geometry, inactive and accessibility fallback.

## Branch preservation

Compact branch 61f1188 tree equals merged PR35 69a0082; compact closeout 7ecb53c tree equals PR36 f0c3b96. Apple 828db9e is ancestor of integration branch. Three dependency tips (6b491db, c790016, 7596c07) applied with --no-commit, no conflicts. Complete pre-change Git bundle verified; cleanup deferred until PR merge and exact tree comparison.

## Current validation updates

- Host verified with sw_vers: macOS 27.0, build 26A5425a. Initial baseline and final Electron captures run on that host.
- Supported verifier runtime: bundled Node 24.19.0. Default shell Node24.13 is below package engines; Homebrew Node26.7 exposed jsdom/Vitest global localStorage incompatibility (40 tests). Supported Node24.19 passed 61 files/427 tests and all coverage thresholds. No tests relaxed for the environment issue.
- Full desktop test hit the one historical 30px Settings heading assertion. Contract explicitly changes this to26px; updated only that expected geometry.
- Appearance test RED on 500-weight selected sidebar; GREEN on600 plus uniform toolbar/content/transparent root, both appearances, compact widths and overlay accessibility fallback.
- Current screenshots exposed low-contrast inherited dark view accent and white labels on green source badges. Added brighter dark text role and dark-on-color badge foreground; evidence text/colors retain source semantics.
- Native smoke previously left fixture citation on the clipboard. Electron44 removed the legacy read APIs, as confirmed by installed declarations. The smoke now intercepts clipboard.writeText and shell.openExternal, verifies handler payloads, and never reads or overwrites user clipboard data.

- Contrast RED on the prior build: blue primary text4.016975780478911 <4.5. Sources RED: unbounded list scrollHeight==clientHeight. Frozen checks retained for GREEN.

## Zoom visual defect and acceptance addition

Native compositor capture exposed a real pre-existing200% zoom defect hidden by Chromium's cropped image: the one-column filter header consumes the fixed420px results region, leaving result content atzero height. Existing no-horizontal-overflow assertions missed this. Freeze added criteria before repair: visible-results height>=220px at200%, selected detail title can be scrolled into view below toolbar. Replace compact filter assertion from one68px column to two flexible columns; use auto-height stacked result content at<=720px. Keep desktop independent scrolling. Main scroll padding prevents headings hiding under sticky toolbar.

- Native zoom follow-up: the historical body min-height560px allowed scrollIntoView to scroll the root beneath a350px CSS viewport, moving the whole application and showing transparent blank space. Remove that minimum (window still has native600px minimum), assert root scrollTop stays0 after detail navigation, wrap compact detail actions, and wait two animation frames for compositor capture. This extends the same inspected zoom regression, not a new feature.

## CI environment isolation (PR42, initial run33985243539)

Remote quality passed. The new appearance test inherited the runner's reduced-transparency preference (toolbar255 versus normal246), and the Sources desktop test inherited a smaller restored window (permitted narrow fallback scrolled main285px). Product behavior was correct for those modes. The tests now explicitly emulate the normal appearance preferences before testing246px-color roles and explicitly size/assert1360x880 before desktop pane assertions. Existing reduced-transparency/high-contrast and820x700 checks remain unchanged. No product code or assertion threshold is weakened; these are scenario preconditions, not relaxed acceptance.

## Short desktop window correction (second CI33985576935)

Appearance and the original two desktop flows passed. Sources still failed with main scroll285. Downloaded failure image is1024x677: the pre-show1360x880 poll was transient before macOS fitted the displayed window. More importantly, Sources CSS had a601-719px height gap between its desktop grid(min720) and stacked fallback(max600), leaving the base min(620px,70dvh) workspace taller than the remaining space. Freeze a real1024x677 regression scenario after native window visibility, retain all keyboard/scroll assertions, and close that gap by starting the bounded desktop grid at601px. The narrow/<=600px stacked fallback remains intact.
