# Notes: TheRSS Icon v6 Integration

## Package Decision

The current package continues to use the proven compatibility path:

- `package.json`: `mac.icon = build/icon.png`
- selected source: `assets/brand/therss-icon-v6-mono-selected-source.png`
- package master: `assets/brand/therss-icon-v6-mono-selected.png`
- stable package input: `build/icon.png`
- expected bundle declaration: `CFBundleIconFile = icon.icns`

Electron Builder converts the 1024px RGBA PNG into ICNS representations during `package:mac`. The package master and stable input are byte-identical.

## Icon Composer Spike

- Xcode's Icon Composer and `actool 26.6` are installed.
- The installed Electron Builder accepts `.icon`, compiles it through `actool`, and bundles `Assets.car` plus legacy `icon.icns`.
- A true `.icon` deliverable requires editable, independently aligned source layers authored and reviewed in Icon Composer. The built-in generated default/dark/mono images are flattened appearance masters, not a substitute for independently editable layer files.
- This task therefore ships the verified PNG/ICNS compatibility path and retains dark/mono references for a future dedicated Icon Composer authoring pass. It does not fabricate a `.icon` container from flattened images.

## Rollback

Restore `assets/brand/therss-icon-v5.png` to `build/icon.png`, rerun `npm run package:mac`, and repeat plist/resource/smoke checks.

## Verification

- The selected 1254px source is byte-identical to the user attachment. RGB pixel comparison before/after adding the fully opaque Alpha channel was zero-difference.
- The selected 1024px RGBA master and `build/icon.png` are byte-identical (SHA-256 `024d9c83991a37d050902087267ea446e92eea0efe1bdb15b27b556a7672b5e4`).
- The first RGB-only package exposed corrupt-looking 1x PNGs when decoded through `iconutil`; after normalizing the package input to RGBA, every ICNS member reports RGBA.
- `iconutil` on this macOS 26 host still renders the legacy 16/32/48 1x extraction as noise while the corresponding @2x members are correct. Quick Look, which uses the macOS system icon decoder, renders the packaged ICNS correctly at 16, 32, and 256 px. Treat the legacy `iconutil` 1x preview as a host decoder artifact, not a package-success signal.
- `npm run package:mac` passed after the required network retry. Signing was skipped because no valid Developer ID Application identity is present, which is the existing personal-beta boundary.
- Bundle: `release/mac-arm64/TheRSS.app`
- `CFBundleIconFile = icon.icns`; `Contents/Resources/icon.icns` is present; `Assets.car` is absent as expected for the PNG/ICNS path.
- `npm run smoke:package` passed against the packaged executable with isolated fixture data after updating the reviewed Discover-heading smoke oracle.
- The selected-icon revision required `npm run install:local -- --force` because `app.asar` was intentionally unchanged and the installer correctly rejected a non-forced identical-code replacement.
- The recoverable selected-icon replacement of `/Users/dtjgp/Applications/TheRSS Dev.app` completed successfully.
- Previous app: `/Users/dtjgp/Applications/TheRSS Dev.backup-2026-09-01T10-31-16-585Z.app`
- Database backup: `/Users/dtjgp/Library/Application Support/therss/backups/therss-2026-09-01T10-31-16-585Z.sqlite`; immutable read-only `PRAGMA integrity_check` returned `ok`.
- Install receipt: `/Users/dtjgp/Library/Application Support/therss/install-receipts/install-2026-09-01T10-31-16-585Z.json`
- Installed and release `app.asar` hashes match; installed and release `icon.icns` hashes match.
- Post-install fixture smoke passed against the installed executable.
