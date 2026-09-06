# Native Liquid Glass migration

## Objective and scope

Run a real AppKit pilot for navigation/toolbars, then expand the appropriate material surfaces only after pilot gates pass. Keep Electron business services, research evidence, SQLite and agent/provider behavior. The user explicitly authorizes the staged migration and conditional expansion. Earlier main-only publication and recoverable local installation scope remain in force after successful validation.

## Phases

- [x] Read current governance, framework boundaries and installed SDK.
- [x] Compile and run isolated native toolbar/content ownership spike.
- [x] Prove sidebar hosting, real input, AX accessibility, resize/zoom and lifecycle; choose architecture from evidence.
- [x] Freeze implementation/rollback/native-fallback contract and add meaningful RED tests.
- [x] Implement pilot and expand accepted surfaces only on GREEN.
- [x] Full automated/native/render/package gates and independent review.
- [x] Replace the local beta after all gates; verify app/module hashes, retained app and database backup.
- [x] Repair CI geometry recovery, verify real AppKit suspend/resume at 677px, repeat affected gates and replace the beta with the final package.

Authorized publication procedure: review the exact diff, push the feature branch, use the protected-main PR checks, merge the verified head, then retain only main. Git state is verified in the final delivery record rather than embedded as a future commit hash.

## Pilot acceptance

Real NSGlassEffectView owns native foreground contentView; public AppKit APIs only. Native hit testing, keyboard/AX, DOM business actions, dirty guards, modal lock, geometry and close/reopen must work. CSS transparency or a screenshot alone cannot pass the gate. Unsupported platforms/SDK or initialization failure retain the functioning web UI. No real vault/provider action in tests.

## Evidence and decisions

Apple explicitly requires foreground contentView ownership. Pinned Electron44.1.1/Chromium152 BridgedContentView overrides hitTest/accessibilityChildren, so arbitrary native child injection is not accepted without actual AX/input proof. Native NSToolbar/titlebar accessory is the first bounded route. Reparenting native Chromium root is an experiment, not presumed safe.

## Errors

Explorer/docs researcher fixed model gpt-5.4 unavailable; retried the bounded read-only tasks with default agents successfully. SDK commands emit sandbox cache warnings, header checks alone do not prove compilation.

## Status

Pilot and full material scope pass the native fixture gate. Full mode passed final quality/package verification and the installed beta was replaced with a recoverable backup; see audit.md and verification.json. Native CUA clicks, Tab, Dismiss and Command-Z pass. The automation tool's wheel event has zero deltas even in an app-local monitor; valid nonzero public NSEvent objects pass the complete native/main/renderer scrolling chain. Physical trackpad momentum is not claimed as verified. The unsuccessful monitor was removed.
