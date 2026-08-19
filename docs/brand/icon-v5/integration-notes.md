# Notes: TheRSS Icon v5 Integration

## Approved Source

- Path: `assets/brand/therss-icon-v5.png`
- Dimensions: 1024 x 1024
- Color model: RGBA
- Outer corners: transparent

## Scope Boundary

- Do not modify discovery, analysis, agent, sync, renderer behavior, or their tests.
- Do not install or replace the user's application until explicitly requested.
- Do not push or publish.

## Evidence to Collect

- Local Electron Builder schema or implementation for the macOS `icon` option.
- Generated `.icns` contents and source-size coverage.
- Packaged `Info.plist` icon reference.
- Packaged `Contents/Resources` icon artifact.

## Current Package Baseline

- Installed builder: `electron-builder@26.15.3`.
- Local type contract: `MacConfiguration.icon` accepts `.icns` or `.icon`; documented default is `build/icon.icns`.
- Existing package plist: `CFBundleIconFile = electron.icns`.
- Existing resource: `release/mac-arm64/TheRSS.app/Contents/Resources/electron.icns`, which is Electron's default icon.

## Icon Generation Finding

- A standard ten-size `iconset` was generated and each PNG had the expected dimensions and alpha channel.
- The system `iconutil` still returned `Invalid Iconset` and did not produce `build/icon.icns`.
- The installed Electron Builder implementation accepts PNG inputs through its icon converter, so the approved source is copied to `build/icon.png` and configured directly.

## Final Package Evidence

- `npm run package:mac`: passed with network permission; signing was skipped because no valid Developer ID Application identity is available.
- Packaged bundle: `release/mac-arm64/TheRSS.app`.
- `Info.plist`: `CFBundleIconFile = icon.icns`.
- Packaged resource: `Contents/Resources/icon.icns`; the previous default `electron.icns` is no longer the declared application icon.
- ICNS extraction produced RGBA variants at 16, 32, 48, 64, 128, 256, 512, and 1024 px.
- Visual inspection of the extracted 1024 px representation matched the approved v5 artwork.
- Packaged smoke: passed against the newly built executable with isolated fixture data; the app was not installed.

## Quality Evidence

- `npm run check`: passed.
- Tests: 18 files and 86 tests passed.
- Coverage: 93.19% statements, 83.43% branches, 94.02% functions, 94.97% lines.
- Formatting, lint, type checking, and production build passed.
