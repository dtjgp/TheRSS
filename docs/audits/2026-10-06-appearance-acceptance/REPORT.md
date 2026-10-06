# Appearance, window-size and package acceptance (2026-10-06)

Scope: item 1 of the follow-up analysis of the [Apple-native UX audit](../2026-09-23-apple-native-ux/REPORT.md).
That audit did not assess dark mode, narrow windows or the packaged app. This pass is
verification only. It changes no product code.

## Provenance

- Code: branch `claude/apple-native-ux`, head `f4e413a` (PR #58), `npm run build` exit 0.
- Host: macOS 27.2 (26B5101f), Apple M3 Max, built-in Retina display; Node v24.13.0;
  Electron v44.1.1.
- Data: `THERSS_E2E_FIXTURES=1`, a new disposable profile for each run, locale `en-US`. No
  live source, provider or vault calls.
- Matrix: [capture-matrix.mjs](capture-matrix.mjs). It writes PNG and inspect JSON to
  `test-results/appearance-acceptance/` (ignored by Git). Run it after `npm run build`.

| Axis       | Values                                                                                                                                                                                |
| ---------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Appearance | light (`NSAppearanceNameAqua`), dark (`NSAppearanceNameDarkAqua`); every capture JSON confirms it                                                                                     |
| Size       | wide 1360×880 pt; minimum: main 820×600 pt, Settings and record windows at their 560×520 pt minimum                                                                                   |
| States     | 4 empty workspaces; Discover results, source popover and search details sheet; Saved; Analytics; Sources; local search with and without results; record window; Settings (both panes) |

Result: 60 of 60 captures written. Selected evidence is in [evidence/](evidence/).

## Results

| Check                                         | Result                                                                                                                                                 |
| --------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Dark mode, all 30 states                      | **Pass.** No illegible text, no light-only colour, no wrong material. Saved star contrast: 11.8:1 (6.7:1 selected) dark; 4.3:1 (3.1:1 selected) light. |
| Minimum window, all workspaces                | **Pass with findings** A4 and A5. Lists switch to the compact list pane; segment counts are not clipped.                                               |
| Settings and record windows at minimum        | **Pass with finding** A2.                                                                                                                              |
| Native workflow smoke, development build      | 1 of 2 runs passed 16/16. One failure was R1.                                                                                                          |
| `npm run package:mac`                         | **Pass**, exit 0. Unsigned, as expected (no Developer ID identity).                                                                                    |
| `npm run smoke:package`, Web route            | **Pass** in 3 of 3 runs.                                                                                                                               |
| `npm run smoke:package`, native workflow      | **Not green.** Run 1: R1 after 14 groups. Run 2: 16/16 behaviour groups passed, then 2 sheet screenshots failed (R2). Run 3: R1 after 14 groups.       |
| Install over the existing `/Applications` app | **Not run.** `npm run install:local` replaces the installed app and migrates real user data; it needs a separate decision.                             |

## Findings in the rendered UI

Severity: P1 changes how users read or reach content; P2 is a visible inconsistency; P3 is copy
or polish.

| ID  | Sev | Finding                                                                                                                                                                                                                                                                             | Evidence                                                                                                      | Proposed fix                                                                                                          |
| --- | --- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------- |
| A1  | P1  | Every list row is 70 pt high with a two-line title frame (35 pt). A one-line title leaves about 19 pt of space above its subtitle, so the subtitle sits nearer the next row's title. All 22 Sources rows have this; one-line rows in Discover, Saved and local search also have it. | [a1](evidence/a1-sources-rows.png); inspect: `rowHeight` 70, `titleFrame` height 35, `titleRequiredHeight` 16 | Put the subtitle directly under the measured title, or use a single-line row height for lists without wrapped titles. |
| A2  | P1  | The Settings window does not fit the selected pane. Model Provider needs 660 pt; the window shows 500 pt. The group box is cut at the bottom, the overlay scroller is hidden, and "Local agents" (Codex and Claude availability) is below the fold. Personal Context fits.          | [a2](evidence/a2-settings-provider-fold.png); `settings-scroll` document 660 pt in a 500 pt viewport          | Resize the Settings window to the selected pane's content height, as first-party Settings windows do.                 |
| A3  | P2  | The search details sheet shows raw values: `completed`, `healthy · 1 results`, `no_results · 0 results`, a millisecond UTC timestamp, and an empty "Excluded keywords:" line. Audit F9 fixed only the result-status line.                                                           | [a3](evidence/a3-search-details-dark.png)                                                                     | Reuse the F9 outcome labels and plural rule; keep the ISO time as labelled provenance; omit empty fields.             |
| A4  | P2  | Local search: the sidebar keeps the previous workspace selected (Sources) while global results show. The preview summary stops in mid-sentence ("…communication and") with no ellipsis.                                                                                             | [a4](evidence/a4-local-search-min.png)                                                                        | Clear the sidebar selection during a global search; truncate the preview with an ellipsis.                            |
| A5  | P2  | Analytics with no analyses: the analysis list column is blank (no empty state). At 820 pt the four metrics wrap 3 + 1. At minimum height the workspace uses the outer page scroll (allowed fallback below 800 pt).                                                                  | [a5](evidence/a5-analytics-empty-min.png)                                                                     | Add the native empty state to the analysis list; use a 2 × 2 metric grid when four do not fit on one line.            |
| A6  | P3  | Copy: empty Discover shows two hints (a line under the form and the centred empty state); "Complete · 22 of 22 sources complete" repeats "complete"; a Sources detail reads "Not recorded · Last recorded · Time unavailable".                                                      | screenshots `*-empty-discover`, `*-discover`, `*-empty-sources`                                               | Keep one hint; drop the repeated word; give the unrecorded state one clear sentence.                                  |
| A7  | P3  | The bottom notice from a Discover save ("Saved: …") stays visible in Analytics.                                                                                                                                                                                                     | `light-wide-analytics.png`                                                                                    | Clear workspace-specific notices on navigation.                                                                       |
| A8  | P3  | Each Settings pane switch logs `NSToolbarLabelStack` declared-constraint warnings (6 in the matrix run).                                                                                                                                                                            | `matrix.json` stderr                                                                                          | Find which preference-toolbar update removes the constraint; low risk.                                                |

## Smoke reliability findings

**R1. Synthetic Space key on a button needs a key window.** The workflow smoke step
"Explicit Saved snapshot update…" presses `saved-update-source` with a synthetic Space keyDown.
In an instrumented run, the button was first responder and enabled, but nothing happened. The
window was not key and the app was not active. Across runs where the pre-press capture was
traced, the two failing runs had `keyWindow=false, appActive=false`, and the three passing runs
had `true, true`. The first failing run recorded `true, true` at capture time; the app may have
lost activation before the press. A standalone AppKit probe sent the same event to an `NSButton`
in an inactive window: 0 of 20 presses fired, with or without a keyUp. Inference: this is an
environment dependency of the harness on a Mac in active use (macOS cooperative activation), not
a product defect. A real Space press always goes to the key window. The probe could not
activate its own window, so it did not show the key-window case directly.

**R2. Window capture of sheet states.** `screencapture -l` failed with "could not create image
from window" for `search-details`, `promotion-preview` and the unchecked source popover in some
runs. This matches the known off-Space capture limit recorded in
[native-smoke-reliability](../2026-09-24-native-smoke-reliability/CHANGE_CONTRACT.md).

Decision needed for R1. Options:

1. Fixture `key` action fails with an explicit reason when the target window is not key
   (diagnostic only; the step still fails on a busy Mac).
2. The step uses `click` when the app is inactive and the keyboard path stays covered by a
   controls-smoke case that runs while the app is active.
3. Leave as is: CI runners keep the app active; local runs need an idle Mac.

## Not run

VoiceOver speech; real mouse and keyboard input; install over the existing app; Web fallback
appearance; Increase Contrast and Reduce Transparency beyond the existing smoke cases; locales
other than `en-US`.
