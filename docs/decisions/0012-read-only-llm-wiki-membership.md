# ADR 0012: Read-only llm-wiki membership and Obsidian handoff

## Status

Accepted for the user's 2026-10-28 scope: repair compatibility, show collected state,
and open existing paper metadata/notes in Obsidian. Other collaboration proposals remain deferred.

## Decision

Electron main owns a bounded scanner over the frontmatter of `raw/paper_records`
and `Literature/Paper_Notes/L1_Deep_Read` / `L2_Structured`. Identity uses normalized
arXiv IDs. An explicit `paper_note` field or a note's own `arxiv_id` resolves the
note; file titles and note-body prose are not identity evidence. A paper record
without a linked note is labeled record-only, never full-paper analysis or a verified PDF.

The scanner parses at most 16 KiB per file, visits at most 5,000 entries, rejects
symlinks and unsafe paths, and coalesces simultaneous scans. Its rebuildable main-memory
cache lasts at most 30 seconds. The reader shows observation time and manual recheck.
Incomplete scans cannot report a verified absence. Duplicate identities are ambiguous.
No note body, arbitrary vault directories, SQLite schema or background watcher is added.

The typed API accepts only an arXiv ID and a boolean refresh option. Main resolves
and checks the target again on open and generates `obsidian://open?path=...` with
`URLSearchParams`; the absolute path stays inside main and the local Obsidian request.
Renderer callers cannot select a path, URI action, content, callback, or extra parameter.
The ordinary external URL boundary remains HTTPS-only.

New promotions add the canonical `paper_note` link to their already-governed sidecar,
so the new note can be reopened without body indexing. Existing vault files are not
migrated or rewritten by the membership scanner. ADR 0008 confirmations, leases,
exact write sets, audits and runtime hash validation remain in force.

## Verification and limits

Temporary-vault tests cover safe identity, incomplete/missing/ambiguous outcomes,
path/symlink rejection, cache refresh, and URI encoding. Presenter and IPC tests
cover state and stale responses. An opt-in actual-vault check and existing-note
Obsidian navigation verify the read-only path; they do not imply a real ingestion.

Official URI behavior: <https://help.obsidian.md/Extending+Obsidian/Obsidian+URI>.
Rollback reverts these APIs/UI/service and the additive sidecar metadata; no
database migration or canonical vault rewrite is required.
