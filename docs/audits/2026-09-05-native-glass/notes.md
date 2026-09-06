# Source and experiment evidence

- Baseline: clean main531fc79; Electron44.1.1; macOS27.0; Xcode26.6, selected SDK26.5; NSGlassEffectView header available.
- https://developer.apple.com/videos/play/wwdc2025/310/ — glass owns contentView; native toolbar/split view guidance. macOS27 geometry updates: https://developer.apple.com/videos/play/wwdc2026/289/ .
- https://github.com/electron/electron/blob/v44.1.1/shell/browser/native_window_mac.mm — native handle returns window contentView.
- https://github.com/chromium/chromium/blob/152.0.7977.65/components/remote_cocoa/app_shim/bridged_content_view.mm — native child hit test and AX risks.
- Meridius electron-liquid-glass inserts background sibling glass, includes private selectors, lacks removal lifecycle; not selected. ByteMyth production license/source inspection not available; not selected. Pilot uses an owned public-API Node-API bridge, no external binary.
- Existing App.tsx owns navigation guards, viewport/sidebar state; main.tsx document.hasFocus is not a reliable native window key-state signal. Native shell must coordinate modal locking and native/DOM focus.
