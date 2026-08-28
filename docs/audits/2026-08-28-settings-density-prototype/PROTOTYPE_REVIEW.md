# Settings Density Prototype Review

## Outcome

The Compact option materially improves Settings information density without changing content,
navigation, controls, or evidence/security language. The user approved it and the bounded
production translation is now implemented and verified.

## Comparison

| Criterion                   |                     Current |                                        Compact |
| --------------------------- | --------------------------: | ---------------------------------------------: |
| 1360x880 workspace start    |                       278px |                                          145px |
| Improvement                 |                           - |                                  133px earlier |
| 820x700 workspace start     | not selected for comparison |                                          154px |
| Generic page eyebrow        |                     Visible |                                        Removed |
| Generic panel eyebrow       |                     Visible |                                        Removed |
| Page H1                     |                  Up to 64px |                        40px wide / 34px narrow |
| Wide heading                |              Vertical stack | Title + description aligned in one compact row |
| Tabs/fields/privacy/actions |                   Preserved |                                      Preserved |
| Horizontal overflow         |                         0px |                                            0px |

## Compact Production Intent

- Remove `APPLICATION SETTINGS`, `PERSONAL CONTEXT`, and `MODEL PROVIDER` only where they duplicate
  the adjacent page/panel heading.
- Keep `Settings`, `Personal Discover prompt`, `Model provider`, every field label, hint, privacy
  statement, status/error, and action label.
- Use 30px/40px/48px wide padding, 40px H1, 176px tabs, 20px layout gap, 20px form padding, and 28px
  panel H2 as the prototype starting contract.
- Retain the existing <=920px one-column layout, two-column tabs, <=620px stacked actions, system
  fonts/colors, focus ring, dark mode, forced colors, and reduced motion.

## Verification

- Current/Compact `aria-pressed` mode switch: pass.
- Settings tablist/tabs/tabpanel/field labels: pass.
- Keyboard focus-visible: solid 3px, pass.
- 1360x880 Current/Compact screenshots: pass.
- 820x700 Compact screenshot: pass.
- Dark Compact: pass.
- Forced-colors Compact: pass.
- Document/body horizontal overflow <=1px: pass at 0px.
- Clean console after favicon fix: pass.

## Production Result

- Removed only the three approved generic duplicate eyebrows.
- Preserved every semantic heading, tab, field, hint, privacy statement, status/error, and action.
- Focused TDD passed 29/29 after the expected two-contract RED.
- Full gate passed 61 files / 411 tests with >=80% coverage and both builds green.
- Electron E2E passed 2/2; wide, dark, 820px, 200%, forced-colors, focus, and overflow evidence
  passed.
- No dependency, data/storage/preload/IPC, package/install, commit, push, or publication change.

F7 Sources, F8 Analytics, and F5 Discover title remain untouched and require separate prototype
decisions.
