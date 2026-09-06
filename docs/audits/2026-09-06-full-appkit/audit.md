# Complete AppKit interface audit — 2026-09-06

The user's explicit scope was the entire macOS interface. Discover, Saved, Settings, Sources, Analytics, reading, search, promotion, confirmations, input, lists, dividers and scrolling now use AppKit. Electron remains the process and service runtime. The default supported route has an empty script-free Web body and a native TRCanvas root; the retained React route requires `THERSS_UI=web` and has separate compatibility tests.

## Architecture and data boundaries

- One validated WindowApplication API serves both native presenters and compatibility IPC. Main-frame ownership, cancellation/progress, dirty-state guards, promotion ownership and shutdown draining are shared.
- All visible geometry is native. NSTableView/NSScrollView/NSTextView/NSSplitView and standard inputs, popups and buttons handle the working interface. Native sheets plus actual system confirmation alerts protect promotion and unsaved edits.
- New secrets travel only from NSSecureTextField to the main process through a dedicated callback. Ordinary presentation/inspection is redacted. FIFO delivery and explicit native flushing protect an immediate key edit followed by Save or Close. Stored keys never refill a form.
- Stable native identities retain composition, selection and scroll. A marked IME draft updates dirty state without changing the active composition; committed Unicode is bounded at complete character boundaries.
- Native text styles include headings, inline emphasis, code, lists and NSTextTableBlock tables. Table parsing allows at most 32 columns and 4096 cells across the document; ragged/oversized tables preserve their entire original text. More than 10000 styled lines use a complete plain-text run.
- Native UI preferences migrate only three known former width keys and serialize atomic writes. Narrow layouts clamp displayed sidebar width without overwriting the preference. Stacked splitters use Up/Down and their actual height; Escape restores the starting position. The main column scrolls when the minimum usable layout exceeds the viewport, including 820×600 at 150% zoom.
- Native foreground controls and glass background are sibling AppKit views in the same layout node. This prevents glass compositing from dimming enabled foreground text. The final dark screenshot's independent pixel estimate was 7.52:1 for Saved and 9.43:1 for the brand.

## Acceptance matrix

All fourteen rows in CHANGE_CONTRACT.md have implementation and native behavior coverage. The integrated verifier acts on actual AppKit controls and existing deterministic application fixtures. Its 12 groups cover 22 source choices; search/results; complete reading and analysis; Save/Undo; independent Saved filters/runners and repository analysis; both Settings drafts and secure-key ordering; Analytics and persistent artifacts; explicit source activation and read-only content; native local search and focus; preview/final confirmation/cancellation/receipt; text editing, both splitter orientations, narrow/zoomed layout; and dirty marked-text close/reopen with preserved data/preferences.

The additional control verifier covers native table cells and styles, ragged-table allocation resistance, total-cell budget, marked-text composition and asynchronous redraw, and scoped native appearance/transparency branches. It changes no global accessibility or input-source setting.

Compatibility DOM/Electron tests explicitly select the Web route. CI runs native behavior with `THERSS_NATIVE_SCREENSHOTS=0` and records that boundary; local release acceptance additionally requires actual WindowServer captures. Neither DOM screenshots nor scene JSON alone certify the displayed AppKit UI.

## Review and corrections

Two independent read-only reviews covered controller parity and native/service security. Fixed findings include per-item analysis races; exact triage state beyond bounded dashboard lists; retained source cache on refresh failure; source-filter empty state; old callback/disabled input rejection; modal action ownership; owner-bound promotion cleanup and shutdown draining; secure field reset and callback ordering; serialized preference reads/writes; table object-allocation amplification; stacked splitter keyboard geometry; and dark-sidebar text contrast. Reviewers confirmed closure against the final source and actual screenshots.

The final native test also reproduced an undersized reading pane at maximum text zoom. Native overflow scrolling now preserves a usable list/detail area. Table cells reload their fonts with native zoom, and toolbars wrap before squeezing flexible text to a few characters.

Test-fixture corrections retained acceptance intent: Playwright now cleans only its compatibility output directory so it cannot erase native evidence; inspect actual multiline text rather than searching escaped JSON; use the existing `skipped` / `cancelled before writing` receipt wording for final-dialog cancellation; avoid forcing the parent window key while AppKit owns a modal alert; close any pending fixture dialog before teardown after a failed assertion. No service status was renamed to accommodate a test.

## Verification and delivery

Current executable results and fingerprints are recorded in verification.json. The final full check passed 81 files / 552 tests, with a separate 59-test native TypeScript coverage gate (the 59 are included in the primary test count). Compatibility E2E passed 6/6, dependency audit reported 0 vulnerabilities, and both packaged and installed default-native workflows passed 12/12. Twelve additional confirmation holds passed with cancellation only. Source screenshots are under screens/. The full check includes architecture, format, lint, types, primary coverage, AppKit coverage and all builds. Package smoke checks both compatibility preload and default native workflows. Installed smoke uses the installed executable with a temporary fixture profile.

Protected-main publication follows the repository PR workflow and exact-path staging. The install receipt verifies SQLite preservation and package fingerprints. After verified replacement, only this task's generated previous-app/database pair is moved to Trash under the user's existing cleanup authorization; unrelated backups and data remain untouched.

## CI regression closure

The first remote desktop run (34039601779) passed compatibility E2E but found a 4-point reading-origin residue after switching records with legacy scrollbars in a 1024×677 window. The same case failed locally before the fix. Record/route changes now mark a reset and apply it only after AppKit finishes document and scroller layout; the verifier still requires exactly zero. The compact legacy-scroller run, repackaged build and actual replacement installation each passed all 12 native groups. An independent native review confirmed the correction. The appearance fixture accepts both the documented accessibility-Aqua name and the normalized Aqua name returned by AppKit, while still requiring light appearance and the opaque contrast branch. Verification fingerprints and the new backup-pair cleanup were refreshed after this replacement.

## Evidence limits and rollback

No live source/model/agent query or real llm-wiki write was performed by these fixtures. They do not upgrade paper/source evidence or establish physical trackpad momentum, a VoiceOver user study, complete accessibility compliance, or real-provider performance. Source-owned Objective-C++ is verified by compilation and actual native execution; TypeScript coverage is not presented as C++ coverage.

The default native path requires macOS26+ (Darwin25+). Older systems or explicit `THERSS_UI=web` use the compatibility interface. This remains an unsigned personal beta, with no new GitHub Release, paid Apple identity or production replacement-updater claim.
