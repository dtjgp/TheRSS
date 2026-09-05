# Task Plan: Apple-Native UI and Layered v6 Icon

## Goal

Make TheRSS feel like a focused macOS research utility, then replace the packaged app icon with a layered Apple-native evolution of the approved research-signal mark.

## Task Contract

- Objective: complete the accepted UI option B and icon direction I2, apply the user's exact monochrome icon selection as the default packaged and locally installed icon, refresh the public README, and publish the verified commit to a protected-main-compatible Git branch.
- Evidence to read first: repository governance, renderer source/tests/styles, current screenshots, v5 icon history, current Electron Builder icon schema, and Apple HIG/Icon Composer guidance.
- Allowed scope: renderer UI/CSS/tests/E2E fixtures and evidence; brand/icon assets and macOS package icon configuration/evidence; recoverable replacement of the local beta app. No SQLite, IPC, source, provider, network, llm-wiki, account, or updater behavior change.
- Verifier: focused RED/GREEN, `npm run check:architecture`, `npm run check`, relevant Electron E2E and fresh screenshots; icon small-size/appearance checks plus `npm run package:mac` and package smoke.
- Stop condition: UI and selected-icon gates pass, the release and installed bundles use the selected icon, and no critical/high review finding remains, or a documented blocker proves the next slice unsafe.
- Persistent writeback: this directory, affected product/UI/icon source/tests, README and current screenshot, package evidence, and the authorized Git branch push. PR creation, merge, release, and tags require separate authorization.

## Phases

- [x] Phase 1: Read governance, skills, current UI, and icon evidence.
- [x] Phase 2: Freeze the change contract and build deterministic Discover/Sources/Settings prototypes.
- [x] Phase 3: P0 RED/GREEN for native chrome, typography, toolbar/status, colors, and transparency/window-state behavior.
- [x] Phase 4: Verify P0 with focused tests and rendered evidence; review before P1.
- [x] Phase 5: P1 RED/GREEN for flatter grouped surfaces and Sources list-detail composition.
- [x] Phase 6: Verify full renderer and Electron gates; close UI review.
- [x] Phase 7: Design, generate, inspect, and integrate the layered v6 icon.
- [x] Phase 8: Package/smoke/icon verification and final evidence closeout.
- [x] Phase 9: Preserve and normalize the user-selected monochrome source; update the package input and provenance.
- [x] Phase 10: Repackage, verify macOS decoding, reinstall the local beta recoverably, and close evidence.
- [x] Phase 11: Refresh README/current screenshot, rerun full verification, commit, and push the protected-main-compatible branch.

## Key Questions

1. Does native chrome improve macOS fit without reducing scan speed or evidence clarity?
2. Can Sources adopt a compact list-detail composition without changing its data contract?
3. Can one layered icon preserve the paper/index/signal identity across default, dark, mono, and legacy ICNS paths?

## Decisions Made

- Preserve `DESIGN_VARIANCE 3 / MOTION_INTENSITY 2 / VISUAL_DENSITY 7`.
- Keep React/Electron/native CSS, Lucide, current navigation destinations, keyboard behavior, and typed state contracts.
- Use system accent for interaction; retain per-view and semantic colors for identity/data/status.
- Keep material in functional layers only; no new UI runtime dependency.
- Complete and verify UI before creating the final icon palette.
- Do not replace the installed app without a separate explicit authorization.
- The user's 2026-09-01 selection authorizes a recoverable local-beta replacement using this exact icon version; it does not authorize signing, publication, or release.
- The user's later 2026-09-01 request explicitly authorizes the README update, Git commit, and push. Because `main` is protected, publish the feature branch only; do not create/merge a PR or release without separate authorization.

## Errors Encountered

- Prototype screenshots initially failed inside the restricted sandbox because Chromium could not register its Mach rendezvous port. Re-ran the same local-only commands with desktop execution permission; all four captures passed.
- The first P0 Electron pass reached Settings and failed only on the historical 40px heading oracle. The frozen contract requires 30px; recorded the acceptance change before updating the E2E assertion.
- A parallel two-worker P0 E2E rerun missed one sidebar pointer drag while the full desktop flow passed. The same sidebar test passed immediately with one worker, confirming a desktop focus/mouse contention flake rather than a product regression.
- The first v6 package's legacy 1x `iconutil` extraction showed noise even though @2x assets were correct. Added an opaque Alpha channel with zero RGB pixel change, repackaged, and verified all members are RGBA; Quick Look's system decoder renders 16/32/256px correctly. The host's `iconutil` 1x preview remains an extraction artifact.
- `package:mac` required a network-enabled retry after sandbox DNS failure. The retry passed; unsigned personal-beta boundary is unchanged.
- Initial package smoke reached the app but used the superseded Discover heading. Logged the acceptance change, updated the oracle, and the smoke passed.
- The selected-icon install initially stopped on the installer's identical-`app.asar` guard because only `icon.icns` changed. The explicit `--force` retry used the same recoverable backup/rollback path and completed; release/installed icon hashes match.

## Status

**Complete** - UI/icon/install/README work is complete; feature commit `9d0a214` and this closeout are published on `origin/codex/apple-native-ui-icon`. PR creation/merge and release remain separately authorized actions.
