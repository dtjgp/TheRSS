# Task Plan: Zoom-aware sidebar and unified selection shape

## Goal

Compact the sidebar automatically when Electron page zoom makes the renderer viewport too narrow,
restore the user's manual preference when space returns, and give the sidebar/result-filter selected
states one shared corner shape.

## Task contract

- Objective: fix the annotated 200% zoom crop and the inconsistent selected-control edge shape.
- Evidence to read first: user screenshot, current `App`/`AppTopbar` viewport and sidebar state,
  renderer styles/tests, Electron E2E zoom matrix, project workflow, and current dirty diff.
- Allowed scope: renderer sidebar state/composition, topbar accessibility copy, shared CSS token,
  focused renderer/style/E2E tests, and task-local evidence.
- Verifier: focused RED/GREEN, full check, Electron E2E at 100%/200%/restored zoom, fresh screenshots,
  and scoped diff/security review.
- Stop condition: at 200% zoom the shell is effectively compact, main Discover controls are visible,
  zoom restoration returns the prior manual sidebar state, both annotated selected controls use the
  same radius token, and all gates pass.
- Persistent writeback: scoped source/tests/docs only. No commit, install, push, live provider/source,
  or external write is authorized.

## Phases

- [x] Phase 1: Freeze root cause, behavior, and visual contract
- [x] Phase 2: Add focused failing renderer/style acceptance
- [x] Phase 3: Implement constrained sidebar state and shared radius
- [x] Phase 4: Run full verification and inspect current-run images
- [x] Phase 5: Independent review and evidence closeout

## Root-cause hypotheses

1. Electron zoom already reduces `window.innerWidth` and triggers the existing resize listener; the
   app caps the preferred sidebar width but never derives an effective compact state.
2. The navigation selected state has `border-radius: 7px`; Discover result-filter buttons have no
   radius declaration, so forced/high zoom makes the square/rounded difference conspicuous.

## Decisions made

- Keep manual collapse as the user's preference and derive a separate constrained collapse below
  760 renderer CSS pixels; widening restores the prior preference without persistence changes.
- Disable the topbar toggle while constrained because expanding cannot satisfy the minimum content
  width; label the state explicitly instead of offering a no-op control.
- Define one `--selection-radius` token and use it for both annotated control families.
- Do not add IPC: live renderer width is already the correct local evidence for layout capacity.

## Errors encountered

- None yet.

## Status

**Complete** - 200% zoom compacts/restores correctly, annotated selected controls share one radius,
all gates pass, and no commit/install/push occurred.
