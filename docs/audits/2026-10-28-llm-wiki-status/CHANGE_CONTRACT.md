# llm-wiki compatibility and collected status

## Feature Intake

- User outcome: repair the existing paper integration, identify an arXiv paper already held by the local llm-wiki, and open its note or paper record in Obsidian from the existing reader.
- Evidence: the live read-only preflight rejects the pinned runtime hash. The reviewed runtime change (`f5c32763`) requires a valid matching terminal audit on lease release. Native Discover/Saved have no read-only collected status or Obsidian action.
- Product fit: local-first discovery handing off to the existing knowledge base. Obsidian continues to own note reading/editing.
- Alternatives: keep the blocked integration; implement the full collaboration proposal; use a small read-only service and existing detail pane. Select the last option.
- Costs: bounded local metadata scan and an in-memory derived cache; no dependency, cloud service, or recurring job.
- Boundaries: schema-validated API/IPC and one allowlisted Obsidian launch constructed in main. No renderer filesystem, process, arbitrary paths, or general URL-policy expansion.
- Kill criterion: stop expansion if the actual bounded scan exceeds 2 seconds or gives incorrect state; repair that first.

## Capability Contract

- Objective: restore compatibility with the reviewed current runtime and add truthful local collected state plus safe Obsidian navigation.
- Goals: reviewed runtime pin with executable isolated compatibility coverage; read only bounded frontmatter in `raw/paper_records` and `Literature/Paper_Notes`; match normalized arXiv IDs; distinguish checking, absent, record-only, note available, missing linked note, ambiguity and unavailable vault. Show observation time and an explicit recheck action.
- Non-goals: related-note recommendations, planner context, news/repository handoff, batch promotion, new sidebar or settings pane, background watchers, SQLite migration, dependency upgrades, push/publication.
- Interfaces: status accepts a validated arXiv ID and optional refresh flag. Open accepts only an arXiv ID, resolves and checks its target again in main, then constructs an encoded `obsidian://open` URL. No caller-selected URL/path.
- Data ownership: vault Markdown/PDF stays canonical; SQLite retains its existing operational ownership. Rebuildable status cache stays in main memory, not duplicated note content. A sidecar alone is not a verified PDF or full-paper note.
- Failure states: source mismatch, malformed/oversized metadata, unsafe paths/symlinks, ambiguous IDs, missing note, missing vault and open failure remain explicit. Async results may never overwrite a different selection.
- Migration/rollback: no schema migration; revert the scoped source changes. Preserve the runtime hash guard and writer lease. Existing promotion artifacts remain intact.
- Diagnostics: observation timestamp, bounded reasons and relative target paths only; no note bodies, prompt, secrets or absolute vault root returned to renderer.
- Allowed scope: TheRSS source/tests/docs and disposable fixtures. Read-only inspection of the actual vault and opening an existing record are authorized. Actual promotion uses the existing in-app preview and final confirmation; no automatic real-vault write.
- Persistent writeback: this task directory, capability/product documentation and current project status where required. Preserve unrelated AGENTS.md, CLAUDE.md and prior audit work.

## Uncertainty Reducer

- Classes: compatibility defect, read-only integration boundary, small native UI extension.
- Reproduction: old runtime pin rejects current audited script. Review upstream diff and capture the reviewed script as an immutable test fixture. Run real Python lease/audit validation in disposable state.
- UI artifact: reuse the existing collaboration prototype's compact state block; implement a deterministic presenter fixture before native acceptance. No new surface or style system.
- Does not prove: fixture success does not prove a live PDF/model ingestion, human accessibility acceptance or every vault note's metadata quality.

## Frozen Acceptance Contract

- A1 RED: audited runtime fixture hash differs from application pin. GREEN: exact reviewed hash matches; unrelated runtime bytes still reject.
- A2: the actual reviewed Python helper validates app-generated completed/blocked/partial audit records, rejects missing/mismatched audits, and releases only the intended disposable lease. Exercise adapter confirmation against the helper where practical.
- A3: temporary vault tests cover version-normalized IDs, sidecar-only, explicit note link, note-only metadata, missing linked note, duplicate identities, malformed frontmatter, size/count limits, symlinks and traversal. No whole-vault or note-body indexing.
- A4: opening rechecks current disk state, rejects missing/ambiguous/unsafe targets and percent-encodes exact existing relative paths. Existing HTTPS-only external navigation policy remains unchanged.
- A5: API/IPC validation covers malformed IDs/options; selected-item UI covers loading, found/absent/unavailable, explicit recheck, opening/error, and stale async result rejection. Non-paper content remains unchanged.
- A5b: a newly confirmed promotion records its exact `paper_note` link in the already-governed sidecar, including sidecar-only continuation. This enables reopening the created note without scanning its body. No extra write family is introduced.
- A6: current live vault preflight passes after reviewed adaptation; compare real IDs with disk state; verify an existing paper record/note opens in Obsidian. No automatic real-vault ingestion.
- Render matrix: native wide/narrow, light/dark, keyboard activation and status text that does not depend on color. Record unavailable accessibility checks honestly.
- Full gates: focused RED/GREEN; `npm run check:architecture`; `npm run check`; relevant Electron E2E/native fixture workflows; diff/security/independent review. Use recorded current runtime/dependencies, report environmental failures separately.
- Stop condition: A1–A6 and required gates have current evidence, no high-severity unresolved issue, and residual limitations are recorded. A live paper write remains gated by its concrete preview and app confirmation.

## Implementation Slices

1. Reviewed runtime compatibility, failing regression then minimal pin/adaptation.
2. Bounded read-only membership service, schemas and safe open.
3. Existing native reader status/actions plus shared API wiring.
4. Full checks, native/Obsidian actual flow, separate diff review and closeout.

## Independent Review

Separate diff review completed on 2026-10-29: product fit, scope, test strength, untrusted metadata, symlink/path boundaries, cache freshness, IPC validation, rollback and evidence accuracy. No unresolved critical/high finding. Added cache-expiry and entry-budget regression cases, then reran the full gate. This is agent review, not human acceptance.

## Evidence Closeout

Implementation and authorized checks are complete. `npm run check` passes 832 main / 183 AppKit tests (overlapping suites), 8 E2E cases and 16 native fixture workflow groups. Actual-vault preflight and three identity checks pass. The requested continuation additionally verifies real native Recheck/Open actions through CUA, selected note/record in Obsidian, absent/non-paper UI, unchanged hashes in a controlled repeat, and 51 related regression tests. CUA can report an accessibility error even when the action visibly executes; human physical-input/VoiceOver acceptance is not claimed. See [REPORT.md](REPORT.md) and [CONTINUED_TESTING.md](CONTINUED_TESTING.md). User-confirmed note input was preserved. No commit, install, push, publication, promotion or intentional real-note edit occurred.

## Acceptance-change log

- 2026-10-29 continuation requested by the user: complete the remaining native input check, recheck and existing-note open. Keep real vault content read-only. The installed and project packages share `dev.dtjgp.therss`; the tool reports identifier ambiguity. Use a disposable copy with a unique test identifier as an uncertainty reducer. Stop after the actual UI result is visible or record the remaining concrete input blocker; do not treat a successful input call alone as proof.

- Runtime test correction before implementation: actual helper returns `leases` and `rejected`/`scope_conflict`; replaced two guessed response shapes with its executable schema. Lease retention and empty-state requirements are unchanged.

- Library test correction: macOS canonicalizes `/var` to `/private/var`; assert the exact realpath target. Ambiguity still asserts its typed state and blocked open, with the actual user-facing reason.
