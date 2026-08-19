# Notes: TheRSS Icon v1

## Product Signals

- TheRSS is a single-user, local-first academic discovery inbox.
- The core promise is one ranked, explainable daily inbox sourced from arXiv and GitHub.
- The UI already uses an editorial system: Newsreader serif, IBM Plex Sans, warm paper, forest green, mustard yellow, and signal red.
- The current sidebar lockup uses a compact circular index beside the wordmark.

## Visual Direction

### Concept: Editorial Research Signal

A compact macOS app-icon tile containing one warm paper card, a small mustard index tab, and one red signal marker. The mark should feel like a carefully printed journal index or library finding aid, not a synthetic intelligence product.

### Required Qualities

- strong, simple silhouette;
- flat colors with subtle print tactility;
- large shapes and generous negative space;
- recognizable at small sizes;
- original and vector-friendly;
- no embedded wordmark or tiny text.

### Avoid

- brains, robots, chat bubbles, neural nodes, circuit traces;
- stars, sparkles, magic wands, orbit rings;
- blue-purple gradients, glassmorphism, chrome, neon glow;
- photorealistic paper, busy detail, tiny typography;
- generic RSS broadcast arcs as the dominant motif.

## Candidate Review

### Candidate 1

- Works: exact product palette, immediate reading/document cue, no AI iconography.
- Does not yet work: page curl, multiple shadows, and folder-like backing make it feel like a generic office utility rather than a proprietary editorial imprint.
- Iteration instruction: keep the subject and palette, but reduce depth and internal detail; favor a flat, memorable silhouette.

### Candidate 2 — retained

- The construction is flat enough to read as a mark rather than an illustration.
- At 64 px, the paper-card silhouette, mustard tab, red signal marker, and two ink rules remain distinct.
- The outer rounded-square corners use genuine transparency, not opaque black pixels.
- The generated master was normalized to a 1024 x 1024 PNG for project use.

## Deliverable

- `assets/brand/therss-icon-v1.png`
- Built-in image generation mode was used.
- This is an approval candidate, not yet wired into Electron Builder or the installed app.
