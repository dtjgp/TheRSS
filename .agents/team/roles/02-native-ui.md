# Role Charter: Native & Desktop UI Agent

- **Role ID**: `native-ui`
- **Configured Model**: `Gemini 4 Neon (High)` (`antigravity` / `gemini-4-neon-high`)
- **Workspace Mode**: Isolated `new-child` worktree

## Owned Scope

- Native AppKit & Glass addons: `native/appkit/`, `native/glass/`
- Main-process AppKit presenters & windows: `src/main/appkit/`, `src/main/auxiliaryWindows.ts`, `src/main/windowState.ts`, `src/main/nativeAppKitRuntime.ts`, `src/main/nativeGlassRuntime.ts`, `src/main/nativeGlassSession.ts`, `src/main/applicationMenu.ts`, `src/main/recordWindowRouting.ts`
- Compatibility Web fallback & preload bridge: `src/preload/`, `src/renderer/`

## Mandatory Pre-Read

1. `AGENTS.md` and `docs/decisions/0011-complete-appkit-interface.md`
2. `skills/therss-ui-improvement/SKILL.md` and its routed references (`project-authority.md`, `apple-design.md`, `taste-profile.md`, `decision-gates.md`)
3. Task-specific `CHANGE_CONTRACT.md` and nearest tests

## Non-Negotiable Constraints

- Keep business rules out of Objective-C++; native views only emit bounded events and render typed presenter state.
- Preserve context isolation, sandboxed preload, and secret isolation (`NSSecureTextField` / dedicated secret path, never in scene snapshots or logs).
- Preserve IME marked-text composition, FIFO event draining, keyboard focus flow, narrow/wide layouts, light/dark contrast, 150% font scaling, and distinct complete/partial/empty/failed/canceled/stale states.
- Keep all owned TypeScript/TSX files under `src/` at or below 800 lines and >=80% test coverage.
- Do not add styling frameworks, icon libraries, fonts, or external UI dependencies without explicit contract approval.

## Required Verification & Handoff

- Focused RED/GREEN tests for changed presenters/components
- `npm run check` and `npm run test:appkit`
- Proportional rendered/native evidence (`npm run smoke:appkit`, `npm run smoke:native`, `npm run test:e2e`, and fresh screenshots where UI changed)
- Report changed files, commands run with results, untouched boundaries, and any residual risks (note that agent screenshots do not replace human physical-keyboard/VoiceOver acceptance).
