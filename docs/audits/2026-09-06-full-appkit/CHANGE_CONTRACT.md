# Complete AppKit interface migration

## Authoritative scope

On 2026-09-06 the user explicitly chose **整个界面全部改为 AppKit** after being asked to distinguish material cleanup from a complete interface migration. This supersedes the earlier choice to keep React forms/content in the macOS working interface. Two CSS overrides alone cannot complete this task.

## Feature Intake

- Outcome: the supported macOS application presents and operates its entire interface with AppKit controls and native layout/scrolling/accessibility.
- Preserve the single-user research product, all 22 retained sources, existing SQLite data, source/model/agent services, evidence states, explicit promotion confirmation, and local-only behavior.
- Retain Electron as the process/application-service runtime. The working AppKit interface must not use React/HTML/CSS for visible content, interactive input, layout measurement or scrolling. Any retained Web frontend is an explicit compatibility/rollback route, never evidence of completion of the native route.
- No paid Apple account, third-party UI binary, private Cocoa selector, arbitrary Objective-C call bridge or new external service.
- Alternatives: fix only two CSS remnants (does not satisfy the clarified request); DOM-to-native overlay (still couples the interface to HTML/CSS geometry and retains prior racing layers); native AppKit presentation backed by the existing validated application services (selected, subject to a technical spike).
- Kill/rollback criterion: missing business behavior, secret exposure, inaccessible controls or failing native acceptance prevents default activation and installation until repaired. Preserve a working fallback during development.

## Capability and boundaries

- Extract the existing validated window-bound application API from IPC registration. Native requests and compatibility IPC share validation, per-window run ownership, cancellation, dirty-state confirmation and promotion ownership. Do not forge IPC events.
- Build a typed, bounded native presentation/action contract and source-owned Node-API/AppKit host. Native NSScrollView/NSSplitView/NSTableView, inputs, buttons, popups, tabs, selectable rich text and native sheets own the displayed interface.
- Stable native controls retain editing, IME, selection, focus and scroll state across asynchronous updates. Native events must bind to current window/view/control/record context. Late async completions cannot overwrite another selected item or source.
- API keys use NSSecureTextField and a dedicated bounded submission path. Newly typed secrets remain in the native/main process boundary; stored credentials are never read back into forms. Ordinary scene inspection, logs, exports and the renderer never receive secret values.
- Remote metadata/analysis is bounded, non-executable text. Native links and menus retain the existing safe external URL policy.
- Window bounds, maximization, sidebar and pane preferences, settings guards, command routing and shutdown cleanup remain covered. Page zoom commands must affect the native interface rather than the hidden/compatibility WebContents.
- No database schema, source adapter policy, ranking, model prompts, billing or vault-write policy change.

## Required interface matrix

| Surface                   | Required behavior                                                                                                                                                                               |
| ------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Global shell              | Five routes, source-health attention route, native sidebar/header, loading/error, dirty navigation/close/quit guard, native menus and shortcuts                                                 |
| Sidebar and pane dividers | Resize/collapse/restore, keyboard adjustment and cancel behavior, independent persisted widths, narrow-window adaptation                                                                        |
| Discover input            | 2000-character query, personalization status, all 22 source choices/select-all/clear, model/Codex/Claude runner, disabled-state validation                                                      |
| Discover run              | Planning/search/assembly progress, run ownership, cancel/canceling, old snapshot preservation, retry only unsuccessful sources                                                                  |
| Discover list/detail      | All/kind counts, 24-item increments, native selection/arrows/context menu, full title/summary/expand/reasons/provenance, save/unsave, paper analysis, arXiv promotion                           |
| Discover search details   | Full persisted plan and source outcomes including not-searched, model/prompt/input-hash/personalization provenance                                                                              |
| Saved list/detail         | All 22-source filtering, independent runner, unread/viewed semantics, all-item analysis, selection/keyboard, full content and analysis                                                          |
| Triage and Undo           | Exact prior state, success-only undo record, toast timeout separate from undo availability, text-editing Undo preserved                                                                         |
| Personal settings         | Two retained drafts, 4000-character prompt, counts/status/save/clear; combined dirty state                                                                                                      |
| Provider settings         | Name/protocol/URL/model/secure key, field validation, test unsaved draft without save, save/clear credential rules, local-agent status                                                          |
| Sources                   | Search/priority/axis/attention filters, native source list, keyboard focus separate from explicit activation, dated/cache/failure states, correct arXiv/GitHub refresh rules, read-only content |
| Analytics                 | Four metrics, date table/bars, latest 50 analyses, full persistent artifact and current/stale/source-missing/legacy states, retry/error/empty states                                            |
| Local search              | Native modal, 2–200 characters, explicit search, grouped result metadata/links, loading/error/empty, Tab/Escape/close and focus restoration                                                     |
| Promotion                 | Native preview modal/sheet, full paths/PDF facts/blockers/evidence level, explicit confirm/cancel and main final confirmation, receipt status and safe retry                                    |

Do not reintroduce unreachable Today/Interests/Onboarding/account/sync surfaces. Preserve the current ability to analyze non-paper Saved records; do not accidentally use the narrower old context-menu policy as the entire product policy.

## Uncertainty reducer and implementation gates

1. Inventory all frontend behavior and backend contracts (read-only searches), then spike a native-only window and event path with native text/input/table/splitter/sheet behavior. No frontend implementation until service ownership and native host viability are explicit.
2. Add failing API and state/controller tests before extracting the service boundary and changing behavior.
3. Implement native infrastructure and each matrix row in bounded modules; keep owned TypeScript files <=800 lines and >=80% in all required coverage dimensions.
4. Add native full-workflow tests that act on AppKit controls and inspect native ownership. Existing DOM tests remain compatibility regression tests; they cannot pass the native-completion gate.
5. Verify light/dark/contrast/transparency, long Unicode text, keyboard/IME/text editing, native scroll/selection, resized/zoomed windows, dirty guards, modal focus and close/reopen. No fake current research, no live provider/source/vault calls in automated tests.
6. Run full checks, native workflows, dependency/security checks, package and installed native acceptance; independent code/UI review resolves actionable defects.
7. Only after every matrix row closes: activate the native route by default on supported macOS, perform the already authorized protected-main delivery and local replacement. Apply the user's existing instruction not to retain this task's old app/database backups after verified replacement.

## Stop condition and reporting

Completion requires every listed surface to work through the native interface, with no visible HTML/CSS content or DOM-driven control geometry in the native route. A report must identify passed, failed, pending and compatibility-only evidence separately. Do not call an infrastructure pilot, a static native screenshot, two removed CSS effects or a passing Web suite “complete”.

Status: all fourteen interface rows implemented; native workflow/component acceptance and independent review passed. Package/publication verifiers and exact evidence are tracked in audit.md.
