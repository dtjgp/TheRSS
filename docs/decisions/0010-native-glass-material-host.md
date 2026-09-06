# ADR0010: AppKit material host with Electron content

- Status: Accepted; pilot and full material gates recorded in the migration audit.
- Date:2026-09-05

Keep the Electron business layer and context-isolated React content. An owned Node-API module hosts native AppKit foreground controls in NSGlassEffectView.contentView and batches surfaces with NSGlassEffectContainerView. A plain AppKit parent holds the existing Chromium native root at the full-window bounds; native controls are separate native foreground children with their own AX/input ownership. No Chromium-private child search, V8 API or private Objective-C selector is used.

The full-window choice is evidence-driven: an inset NSSplitView reparenting pilot produced correct AppKit frames but wrong Chromium viewport dimensions after resize. The full-window host retained matching native/rendered coordinates over20 resize cases and200% zoom. Glass surface frames remain in physical window points. Each surface owns an ordinary scaled content view whose frame/bounds transform scales controls, bezels and focus rings together; scaling a glass ancestor is rejected because its material clipping did not follow that transform in the native screenshot. The header toggle glass stays outside the scaled header-label wrapper. The host must preserve first responder, explicit native/web Tab transitions, modal locking and detach/close cleanup; these are release gates, not presumed framework guarantees.

A bounded renderer state projection names fixed controls and CSS rectangles. Main validates schema, owning sender, window bounds, actual zoom, lifecycle and revision before calling native code. Native actions return the same fixed ID/revision; they reuse the existing renderer action and its confirmations. Raw handles and native invocation never cross preload.

Transient geometry rejection suspends the existing host without reparenting Chromium or toggling window vibrancy. Suspension hides the native overlay, blocks native input and focus, and hands existing native focus back to web content. A valid presentation updates all controls before revealing them. The renderer remeasures after a bounded delay and restores the web fallback after repeated stable rejection. Stale revisions after a renderer restart still release and rebuild the host; navigation, close and terminal failure retain full cleanup.

Pilot scope is sidebar/header; full material scope adds floating item actions and Undo. Data reading/form/modal content remains opaque and retains the current product. Native mode is disabled on unsupported systems or failed loading/presentation, and an explicit off switch preserves the web implementation. System menus and native confirmation sheets already use AppKit.

Node-API headers are a build-only official dependency. The extension is compiled on macOS with an SDK exposing NSGlassEffectView, bundled under out/native-glass and unpacked from ASAR. Linux quality gates do not attempt AppKit compilation. Supported old macOS runs the web fallback without loading the26+ native module. Exact local/native/package compatibility is verified independently of TypeScript coverage.
