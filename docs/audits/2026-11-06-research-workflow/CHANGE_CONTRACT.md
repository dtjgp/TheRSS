# Change contract: Daily Papers and llm-wiki handoff

## Feature intake

- **User outcome:** Open Discover, reach the research shortlist in one action, distinguish the requested day from the displayed edition, inspect why a paper was selected, and open its exact Obsidian note or arXiv record. Discover and Saved retain their explicit promotion path.
- **Observed problem:** The Sources arXiv desk queries a UTC submission day, with a bounded fallback. It is neither an announcement feed nor personalized. Discover requires a separate intent and planner. llm-wiki already owns a governed announcement scan and canonical shortlist. Web reading lacks the native read-only membership handoff.
- **Product fit:** Daily Papers is a secondary view inside Discover. It uses the existing compact reading workspace and native appearance. The profile remains 3/2/7. Adopt visible source feedback and stable selection, adapt Zotero feed triage, and retain the app's explicit save and promotion. Do not add a new sidebar, rendering library, or cloud dependency.
- **Alternatives:** Keep opening the digest in Obsidian separately; duplicate the scan in TheRSS; read the canonical digest in TheRSS. Select the last option: it closes the daily path without reimplementing ranking, competing for a lease, or adding runtime services.
- **Cost and boundaries:** Bounded local reads, no new package or SQLite schema, two typed API methods, shared AppKit/Web semantics. Existing vault write paths are unaffected.
- **Kill criterion:** If a digest is absent, unsupported or unreadable, report the condition and offer a reread or return to Discover. Never infer successful zero from an incomplete scan. Leave a free-form Markdown browser, arbitrary vault selection, extra write scopes and scheduling out of this slice.

## Capability contract

- **Objective:** One daily reading path with the exact local digest and paper note as the links to llm-wiki and Obsidian.
- **Interfaces:** `getLlmWikiDaily()` returns a bounded snapshot with the local requested date, check time, run status, optional dated edition and a typed shortlist. `openLlmWikiDaily({date, arxivId?})` accepts a calendar date and optional canonical arXiv ID. Main rereads and validates the target; callers never supply a path, URL, command, or Markdown. Both interfaces use the already configured vault root.
- **Ownership:** The existing Daily ArXiv Scan owns the digest, relevance, official announcement coverage, and archive. TheRSS reads the canonical dated edition and displays its selection, preserves the score's reading-priority meaning, and keeps evidence status separate from full-paper reading. Vault content stays local.
- **Freshness and failures:** A present current edition takes precedence, even if partial or zero. When today's file is absent, show the nearest previous edition within 14 days with its own date and status. Current corrupt/unsafe data is unavailable, not hidden by an older edition. Missing, unavailable, partial, no-source, completed and completed-zero are distinct. An exact note link requires safe canonical path and matching arXiv ID; otherwise the official arXiv action remains. No stale note or run response can replace another selection.
- **Migration/rollback:** None. Revert the view, adapter and IPC additions. No vault edit, new lease, derived index, SQLite migration, external write, install or schedule change.
- **Allowed scope:** Read-only daily bridge and daily screen on both desktop routes; Web parity for the existing paper status/Open in Obsidian flow; correct misleading submission desk copy; audit, references and verification. No bulk sync or broad vault import.

## Uncertainty reducer

Build a deterministic interactive list/detail prototype using labeled fixtures. Exercise direct-first grouping, requested/display date, lag/zero/unavailable and the return path. Separately read current and historical vault digests without mutating the vault to check schema drift. The prototype does not prove native behavior, external link dispatch, archive integrity or retrieval accuracy.

## Frozen acceptance contract

- **RED:** New adapter tests fail before implementation; a completed edition must return a dated shortlist and exact verified note handoff. New presenter/renderer tests fail before the Daily Papers control/view and explicit reload exist.
- **Focused coverage:** completed, previous edition, missing, unavailable, partial with zero, completed with zero, duplicate/unsafe identity, mismatched note header, safe arXiv link, exact digest/Obsidian link, rejection of path-shaped requests and stale responses. Web reader displays read-only recorded/record-only/unavailable state and rechecks after a confirmed attempt.
- **E2E:** Use disposable profiles and deterministic fixture APIs. Discover → Daily Papers → direct shortlist → select paper → Obsidian/official link → back to unchanged Discover draft; exercise refresh and missing or lag state in focused checks. Native and Web keep their own evidence. Render wide and narrow states; inspect focus, accessible labels and status copy.
- **Verifiers:** focused suites, `npm run check`, `npm run test:e2e`, affected native control checks, independent diff review, and a read-only check against the actual vault. No paid or live model request. A real promotion, installation and package release remain separate verification and authorization.
- **Stop:** The product analysis and references are durable. The daily route, Obsidian handoff and existing confirmation-gated promotion are connected in the development build and pass affected checks. Record any real-world acceptance not executed.
