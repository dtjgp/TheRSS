# Apple design principles in TheRSS

This is a project adaptation, not a second UI framework. Apply it to AppKit first and translate only relevant principles to the Web fallback. The product contract, evidence states, existing accessibility behavior and accepted user choices remain authoritative.

## Reference and provenance

- Third-party reference: [emilkowalski/skills apple-design](https://github.com/emilkowalski/skills/blob/56de6f5d6642f761b5e17629fccf53e303b3da9b/skills/apple-design/SKILL.md), retrieved September 7, 2026.
- Fixed commit: `56de6f5d6642f761b5e17629fccf53e303b3da9b`; Git blob: `66f56807cb503fd482b86c4e0aaee5a080918242`.
- Markdown SHA-256: `11840b24a11d7f94f39c6aaab074750ae4e4de4ef54ee4b1dd97e16ebd485e61` (22,715 bytes).
- Primary guidance: [Apple design principles](https://developer.apple.com/design/human-interface-guidelines/design-principles) and [Designing Fluid Interfaces, WWDC 2018](https://developer.apple.com/videos/play/wwdc2018/803/).

The upstream translates principles into Web examples. It is not an AppKit implementation guide or an official Apple skill. This file records our interpretation without vendoring its full instructions. Recheck the pinned text and affected rules before adopting a later version; no global installation is needed.

## Adopt and adapt

| Principle              | Project application                                                                                                                                      | Observable verification                                                                                     |
| ---------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------- |
| Purpose                | Prioritize formulating a research question, scanning results, reading provenance and preserving useful work.                                             | Primary task remains apparent at wide and narrow widths.                                                    |
| User control           | Keep drafts, direct editing, predictable Back paths and accurate local-record navigation. Expose cancel or retry only where the application supports it. | Keyboard/click navigation and stale-response tests preserve the intended record.                            |
| Familiarity            | Use AppKit controls, scroll views, split views, menus, sheets and system typography; keep the Web fallback consistent in meaning.                        | Native rendered controls, focus and Return behavior work without extra clicks.                              |
| Simplicity             | Remove redundant gates and duplicated actions; keep labels needed to understand controls and evidence.                                                   | Each action has a useful consequence; inputs remain labeled and accessible.                                 |
| Feedback               | Put progress and failures near the triggering task. Distinguish failed, partial, canceled and no-result states; show recorded time and context.          | Source fixtures preserve these distinctions without claiming current availability from old observations.    |
| Spatial consistency    | Preserve selection and reading position through resizing and transitions. Use existing native layout and scrolling.                                      | Narrow/wide layouts retain the same target and a visible return path.                                       |
| Visual hierarchy       | Put item identity and actionable status before supporting metadata. Use system text styles, semantic colors and sufficient contrast.                     | Long source reasons remain readable; state is understandable without color.                                 |
| Motion and preferences | Prefer built-in pressed feedback and native scrolling. Add motion only to explain a demonstrated transition, with reduced-motion behavior.               | No extra library, custom scroll physics or mandatory animation; respect platform accessibility preferences. |

## Do not import mechanically

- Do not delete necessary labels because a control should supposedly explain itself. Preserve accessible names, required fields, provenance and error recovery.
- Do not make every region translucent or apply blanket blur. Existing native materials and readability constraints decide their use.
- Do not add decorative springs, custom scroll physics, automatic layout animations or a Web motion library to the native interface.
- Do not interpret interruptible visual feedback as permission for overlapping source/model jobs, destructive interruption or weaker cancellation guards.
- Do not hide bounded errors, unsupported operations, timestamps or evidence limitations to make a screen appear simpler.
- Do not reopen accepted 3/2/7 design choices or the user's provisional UX acceptance for routine work within scope. Reopen only the affected item when new evidence identifies a problem.

## Per-change application

Read the affected code and rendered state, name the user problem, select the relevant rows above and freeze the behavior in the existing change contract. Use deterministic fixtures for state and recovery. Verify the changed interaction and layout in the actual native or Web surface; passing instruction-format checks alone does not establish design quality. Stop when the contracted problem and applicable checks are complete.
