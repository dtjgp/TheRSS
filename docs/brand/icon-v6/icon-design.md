# TheRSS Icon v6 Design Brief

## Status

Selected as the Apple-native successor to v5 after the renderer UI closeout on 2026-08-31. On 2026-09-01, the user selected the attached monochrome rendering as the default application icon; the earlier color and dark versions remain alternatives.

## Direction

Preserve the approved editorial research-signal identity while translating it into a cleaner, layered macOS icon language with stronger small-size recognition and appearance variants.

## Mark Construction

- one calm deep blue-teal background field supplied as unmasked square artwork;
- one centered pearl research sheet with a shallow lifted edge and one folded upper-right corner;
- exactly three thick decreasing content bars;
- one restrained amber index marker behind the upper-right sheet edge;
- one coral selected-signal circle overlapping the front-right edge.

## Meaning

- Paper and three bars: a research artifact with inspectable content;
- Amber marker: indexing and discovery;
- Coral circle: a selected signal worth attention;
- Blue-teal field: calm local work coordinated with the Apple-native renderer.

## Native Treatment

- overlapping filled shapes establish the layer order;
- one compact shadow and restrained edge highlights provide depth without glossy AI styling;
- the source is not pre-masked into a squircle, leaving the platform/package path to own presentation;
- default, dark, and monochrome appearance previews preserve one silhouette and spatial grammar.

## Constraints

- no letters, words, numbers, equations, or tiny simulated paragraphs;
- no brains, robots, neural meshes, sparkles, RSS arcs, neon, purple glow, or watermark;
- no added objects and no change to the one-paper/three-bars/one-marker/one-signal count;
- the paper, marker, signal, and bars must remain separable at 32-64 px.

## Assets

- User-selected source, preserved byte-for-byte: `assets/brand/therss-icon-v6-mono-selected-source.png` (1254 x 1254 PNG; SHA-256 `5666b29794eac4e513bbf1c7935222bcde096d3f8e2271893d612f92e2660009`)
- Default package master: `assets/brand/therss-icon-v6-mono-selected.png` (1024 x 1024 RGBA PNG; SHA-256 `024d9c83991a37d050902087267ea446e92eea0efe1bdb15b27b556a7672b5e4`)
- Color appearance alternative: `assets/brand/therss-icon-v6.png`
- Dark appearance reference: `assets/brand/therss-icon-v6-dark.png`
- Monochrome appearance reference: `assets/brand/therss-icon-v6-mono.png`
- Built-in generation source captures: `assets/brand/therss-icon-v6-candidate.png`, `assets/brand/therss-icon-v6-dark-source.png`, and `assets/brand/therss-icon-v6-mono-source.png`
- Stable Electron Builder input: `build/icon.png`

## Generation

- Mode: built-in `image_gen`
- Intent: edit/style evolution using `assets/brand/therss-icon-v5.png` as the identity reference
- Default prompt preserved the paper/index/signal invariants and requested unmasked, centered Apple-native layered treatment.
- Dark and monochrome previews were single-change follow-up edits preserving geometry and element count.
- The selected default is not regenerated: its attached 1254px source bytes are retained, an opaque Alpha channel is added with zero RGB pixel difference, and Lanczos resampling produces the 1024px package master.

## Acceptance

- Selected artwork remains readable at 16, 32, 64, and 128 px; the paper/signal silhouette remains distinct at 16 px and the three-bar grammar is legible from 32 px.
- Default, dark, and monochrome previews preserve geometry, safe margins, and element count.
- v5 remains the stable rollback asset.
