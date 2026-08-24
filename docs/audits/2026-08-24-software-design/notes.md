# Notes: TheRSS Software Design Audit

## Evidence Policy

- Use only screenshots captured during this audit as visual evidence.
- Use current source code and tests for implementation-level findings.
- Do not claim full Web Content Accessibility Guidelines (WCAG) compliance from screenshots.
- Treat prior memory as project context only and re-verify any current behavior.

## Sources

- Current product contract: `PRODUCT.md`, `GOALS.md`, `task_plan.md`, `docs/DESIGN.md`, and
  `docs/ENGINEERING_PRACTICES.md`.
- Current renderer: `App.tsx`, `DiscoverView.tsx`, `SignalWorkspace.tsx`,
  `DataAnalyticsView.tsx`, `SourceCatalogView.tsx`, and `styles.css`.
- Current installed application: `/Users/dtjgp/Applications/TheRSS Dev.app` inspected through its
  native Electron window.
- Isolated responsive fixture: current compiled renderer plus a temporary deterministic mock under
  `/private/tmp`; it did not alter product source or local SQLite state.
- Current-run screenshots: `01` through `11` in this audit directory.
- UI heuristic lookup: local-first academic desktop should optimize clarity and scanability, keep
  contrast at least 4.5:1 for normal text, keep error feedback local, and honor reduced motion.
  The helper's generic Inter/Space Grotesk suggestion was rejected because TheRSS has an accepted
  Apple-system typography contract and the current rendering is stronger for this macOS product.

## Synthesized Findings

### Confirmed strengths

- The local-first and no-telemetry boundary is visible in the product rather than hidden in docs.
- The five surfaces use consistent Apple system typography, restrained grouped backgrounds, and
  coherent view accents in both light and dark appearance.
- The current renderer has semantic navigation, headings, buttons, form labels, status/alert
  regions, `aria-pressed` state, a keyboard-operable sidebar separator, explicit focus styling, and
  reduced-motion handling.
- Discover retains source provenance, match reasons, independent source outcomes, and evidence
  limits. Analytics honestly separates legacy Today and Discover returned-record volume.

### Highest-impact confirmed issues

1. At the application's declared 820 px minimum width, the Discover source summary visibly clips
   `22 of 22 selected` to `2…`. The three-column control row has no narrow-layout rule.
2. The Sources directory says `22 live-verified research sources` while the same live window says
   `Source attention needed`; arXiv then shows `Local cache` and a last-indexed timestamp three days
   old. Historical verification, current health, and cached availability are being conflated.
3. The restored Discover session renders 100 full result cards at once. This creates a large DOM,
   long keyboard path, and a high scanning cost for a daily triage product.
4. Saved places the star, promotion, Analyze, and Dismiss actions after the complete abstract. The
   primary decision controls require a long scroll even for one item.
5. Models & Agents, Data Analytics, and Sources are peers of Discover/Saved in primary navigation,
   although only the latter two are the recurring user loop. Settings and operational utilities
   dominate the information architecture.
6. Model-provider setup has no bounded Test Connection, no explicit clear/replace credential
   control, and no provider-specific validation feedback before saving.
7. The Source directory exposes implementation/provenance jargon (`ACTIVE ADAPTER`, `Folo 1543`,
   `MC`, `C6`, `GA`, `SG`, `AB`, `RI`) and mixes English controls with Chinese metadata. Tooltips are
   the only expansion for the research-axis abbreviations.
8. In dark appearance the Personal Prompt placeholder measured 3.02:1 against its composed field
   background. The rest of the measured visible text was at least 5.26:1.
9. Data Analytics' leading `883 Search results` is a lifetime returned-record count, but the card
   does not say `lifetime`; the smaller caption explains source split, not the time scope.
10. Renderer design changes are concentrated in a 3,587-line stylesheet and a 963-line app
    component; this raises the likelihood of responsive and visual-regression drift.

### Evidence limits

- No live source refresh, model-provider request, credential change, llm-wiki write, or other
  state-changing action was performed.
- This is not a full WCAG conformance claim. Native VoiceOver, 200% zoom, Increase Contrast,
  forced-colors behavior, and a complete keyboard traversal still require dedicated verification.
- Open Design generation was intentionally not started: this request authorized analysis, not a
  paid Cloud run, a Local Codex generation, or a secure BYOK artifact workflow.
