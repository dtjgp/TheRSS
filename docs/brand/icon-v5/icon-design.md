# TheRSS Icon v5 Design Brief

## Status

Approved by the user as the official TheRSS application icon on 2026-08-16.

## Direction

Make the v4 paper visibly contain research content without introducing literal typography or document-detail clutter.

## Mark Construction

- one warm-white folded research paper;
- exactly three near-black horizontal content lines, left-aligned and decreasing in length;
- one mustard discovery/index marker;
- one red selected-signal circle;
- a deep-forest rounded-square field with transparent outer corners.

## Meaning

- Paper: a paper, research note, or repository record;
- Three lines: substantive content is already present and ready to inspect;
- Mustard marker: indexing and daily discovery;
- Red circle: the item selected as worth the researcher's attention;
- Forest field: calm, local-first, durable research work.

## Line Rules

- three lines only;
- thick enough to remain separate at 32-64 px;
- decreasing lengths create an editorial reading rhythm;
- no letters, words, bullets, equations, or simulated paragraphs.

## Generated Candidate

- File: `assets/brand/therss-icon-v5.png`
- Format: PNG, 1024 x 1024, RGBA
- Transparency: genuine alpha outside the forest squircle
- Small-size check: paper, fold, three lines, yellow index, and red signal remain legible at 64 x 64
- Generation path: built-in image generation, using v4 as the edit target, followed by a verified transparent-corner correction

## Final Prompt Summary

Add exactly three thick near-black horizontal content lines inside the paper, left-aligned, evenly spaced, and decreasing in length. Position them in the lower-middle of the sheet, clear of the fold and red signal. Preserve every other shape, color, texture, proportion, and transparent outer corner. Add no literal text or extra document detail.

## Integration

- Stable package source: `build/icon.png`
- Electron Builder configuration: `mac.icon = build/icon.png`
- Packaged output: `release/mac-arm64/TheRSS.app/Contents/Resources/icon.icns`
- Bundle declaration: `CFBundleIconFile = icon.icns`

v1-v4 remain available as design history. The packaged application now uses v5; the installed user application was not replaced as part of this approval.
