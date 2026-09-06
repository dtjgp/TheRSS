# ADR 0011: Complete AppKit working interface

- Status: Accepted; complete native workflow and component gates passed.
- Date: 2026-09-06
- Scope authority: user explicitly selected the entire interface, including forms, lists, content and dialogs. This supersedes ADR 0010's retained React content for the supported macOS working interface.

## Decision

Keep Electron and the existing core application services, but render the working interface with source-owned AppKit views. No visible React/HTML/CSS content, DOM-measured native geometry or Web scrolling is permitted in the native route. A retained compatibility route may continue to use the existing Web frontend; its tests are not native-completion evidence.

Extract a validated window-bound application API shared by compatibility IPC and native controllers. Window ownership, run cancellation, progress, dirty guards, promotion ownership/confirmation, safe links and shutdown sequencing live in this shared boundary. Do not fabricate IPC events or duplicate business rules in Objective-C.

The native presentation contract uses bounded typed controls and data, with stable IDs and explicit action bindings. AppKit owns focus, text editing, secure input, table selection, scrolling, split views and sheets. Secrets use a dedicated native/main submission path and are absent from ordinary scene snapshots and diagnostics. Content remains non-executable text with structured native typography.

Native layout and zoom must not depend on Chromium viewport dimensions. Native scroll views process their own scroll and momentum events, removing the earlier DOM/native delta handoff. Controls must preserve editing and selection through asynchronous model updates.

## Evidence and gates

The architecture spike has an empty Web body and hidden original Chromium root. The visible root contains NSSplitView, NSTableView, NSTextField, NSSecureTextField and a 3343-character NSTextView. Native Unicode input and a native button callback reached Electron; table selection and split width were inspected, and the system-window screenshot confirms their display.

The spike was followed by complete production implementation and native acceptance for all fourteen functionality rows in the [migration contract](../audits/2026-09-06-full-appkit/CHANGE_CONTRACT.md) with native business behavior, secure input, actual modal confirmations, IME, persisted layout and window recreation covered. Current package and delivery evidence is recorded in the migration audit.

## Implementation constraints verified after review

- Native foreground controls and the NSGlassEffectView background share the same native layout node. Ordinary foreground text is outside glass content compositing to maintain measured screenshot contrast in dark mode; both layers are AppKit views.
- NSTextTableBlock layout is limited to 32 columns and 4096 total cells per text document. Ragged/oversized tables preserve their full literal content; documents exceeding 10000 styled lines use a complete plain-text run.
- Marked IME text reports a bounded draft for dirty guards without replacing the active composition. Native events are drained in FIFO order across regular and secret callbacks before Save, menu or shutdown decisions.
- Native columns scroll when their minimum usable content exceeds the viewport. Vertical and horizontal splitters use the matching coordinate and keyboard direction.
- Actual OS appearance/accessibility preferences feed native controls and material fallback. Deterministic fixture overrides stay inside the disposable native host and never change global macOS preferences.
