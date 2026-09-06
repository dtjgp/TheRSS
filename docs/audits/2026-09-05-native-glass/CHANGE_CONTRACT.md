# Native Liquid Glass staged migration

## Feature Intake

- User outcome: begin a small native-material pilot and expand to the complete appropriate material layer after successful verification.
- Evidence: existing Electron44.1.1 uses native vibrancy with CSS controls. Local owned Node-API prototype compiled against SDK26.5; real NSGlassEffectView.contentView ownership, native toolbar/sidebar AX nodes and native click callbacks verified. An inset Chromium reparenting experiment failed on window resize and is rejected. A full-window AppKit host preserving Chromium coordinates passed20 resizes and200% zoom; keyboard handoff and modal locking are the remaining integration gates.
- Product fit: preserve research content, deterministic workflows, data ownership and evidence states. Glass belongs to navigation/interactive floating controls, not paper text or status tables.
- Alternatives: CSS/background-sibling glass (does not meet native target); commercial/private-API helper (rejected); complete SwiftUI rewrite (not needed for material migration); owned public-AppKit host plus existing Electron services/content (selected subject to gates).
- Cost/boundaries: one small source-built Node-API adapter, official MIT Node-API headers for reproducible builds; no external binary, service or paid Apple account. New strictly validated layout/control IPC, no pointer exposure, no data/model/storage changes.
- Kill criterion: a native/input/AX/lifecycle/geometry failure must fall back to the working web UI; do not enable or expand a failing native mode.

## Capability Contract

- Objective: real AppKit materials/foreground controls across the accepted navigation and floating-action layer, with the original product behavior and a tested web fallback.
- Pilot: sidebar navigation/status + header controls/text. Only enable this scope in explicit pilot tests.
- Expansion after pilot: Discover/Saved floating action strips and Undo feedback. Ordinary forms, paper/repository content, source lists, analytics and text-heavy modal bodies remain standard opaque content; remove their decorative CSS blur in native mode. Existing actual native menus/confirmation sheets are retained.
- Native ownership: NSGlassEffectView.contentView contains real native controls/text; NSGlassEffectContainerView groups the native effects. No private selectors, Chromium-private child lookup, arbitrary native method calls, or sibling-background-only claim.
- Geometry: keep Chromium in full-window coordinates. CSS layout remains the source of control rectangles; main validates and converts CSS pixels using actual webContents zoom factor. Native parent host enforces the same full-window rectangle. Glass frames use physical window points; only ordinary foreground content views scale their logical bounds, so control bezels and material clipping agree. Existing HTML sidebar divider remains the accessible geometry control and receives pointer events through empty native regions.
- Behavior: native events carry a fixed control ID and revision; renderer invokes the same existing button behavior. Reject stale/hidden/disabled events. Await existing Settings guard before native selection updates. Native focus hands off explicitly at web/native Tab boundaries. DOM modals disable/hide native controls and restore focus.
- Native mode is transactional: only hide a web control after a successful current native presentation acknowledgment. On failure/unsupported OS/off switch, retain or restore DOM controls.
- Scope: native source/build, shared schema, main adapter, preload facade, renderer bridge/styles, tests, architecture decision and task evidence. Main/renderer isolation, SQLite/source/provider/analysis/export semantics remain intact.
- Rollback: explicit THERSS_NATIVE_GLASS=off; detach native views/restores original content parent; revert migration commit. Existing installed beta remains until full gates pass; later replacement uses the authorized backup installer.

## Frozen Acceptance

- RED: invalid or oversized/duplicate control payloads rejected; stale callbacks ignored; successful ack required before masking DOM; native error restores fallback; modal prevents native commands; keyboard boundary reaches native/content; source/dirty guard behavior unchanged.
- Native checks: actual AppKit ownership/AX and real CUA input, rendered light/dark, sidebar resizing/canceling,200% zoom, modal trap, close/reopen, bounded update lifecycle and missing-module/old-OS fallback. CSS-only assertions cannot prove native material.
- Pilot must pass before default/full native expansion. All applicable surfaces must be accounted for in the completion matrix.
- Verifiers: focused RED/GREEN; npm run check; native pilot and native/full Electron fixtures; native/renderer appearance checks; dependency audit; source-built packaged smoke; independent native/security/UX diff review. Existing web-mode E2E remains enabled.
- Stop condition: accepted native surfaces pass, fallback and business regressions pass, source/package/native evidence recorded. Failed gates prevent rollout and installed replacement until repaired or a concrete external blocker is established.

## Evidence closeout

Closed in [audit.md](audit.md) and [verification.json](verification.json): source, native interaction, fallback, package and installed-build evidence are recorded. Public API observations remain distinct from framework guarantees; physical trackpad momentum is not claimed as verified. Native material migration does not mean every content widget is rewritten in AppKit.
