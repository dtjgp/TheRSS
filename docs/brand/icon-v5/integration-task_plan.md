# Task Plan: Integrate TheRSS Icon v5

## Goal

Make the approved v5 artwork the official packaged macOS application icon, with deterministic source assets and verified `.app` output.

## Phases

- [x] Phase 1: Confirm approval, source asset, and current worktree boundaries.
- [x] Phase 2: Verify the local Electron Builder icon contract.
- [x] Phase 3: Generate the macOS icon set and connect packaging configuration.
- [x] Phase 4: Package and inspect the resulting application bundle.
- [x] Phase 5: Record final evidence and hand off.

## Key Questions

1. Which checked-in icon artifacts are required by the current Electron Builder version?
2. Does the packaged `TheRSS.app` reference and contain the generated icon?
3. Can the branding change remain isolated from concurrent product work?

## Decisions Made

- `assets/brand/therss-icon-v5.png` is the approved 1024 x 1024 RGBA source.
- Keep v1-v4 as design history; expose a stable official packaging asset instead of renaming historical files.
- Limit edits to brand resources, package configuration, and brand integration evidence.
- Use an explicit `mac.icon` value of `build/icon.png`; the installed Electron Builder converter accepts PNG sources and will generate the bundled `icon.icns` during packaging.
- Keep `build/icon.png` as the stable official 1024 px source copy used for packaging provenance.

## Errors Encountered

- Manual `iconutil` conversion rejected a complete, dimension-verified ten-file iconset as `Invalid Iconset`. The source derivatives were all valid RGBA PNGs. Use Electron Builder's installed PNG-to-ICNS converter and verify the actual `.app` instead of bypassing the error.
- The first package-config patch used the wrong local JSON context and was rejected without changing files. Re-read the live package block and applied a narrower patch.
- The first package run completed the application build but failed on sandboxed DNS with `ENOTFOUND github.com`. The approved network retry packaged successfully.
- The first packaged smoke used its default installed-app target and could not launch Electron inside the sandbox. Pointing `THERSS_APP_EXECUTABLE` at the newly packaged app and granting desktop execution permission passed without installing the app.

## Status

**Complete** - v5 is the configured macOS icon, the real `.app` contains and declares the generated ICNS, packaged startup passed, and the standard quality gate is green.
