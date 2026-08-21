# Capability: Confirmation-gated llm-wiki paper promotion

## User outcome

From an arXiv paper in Discover or Saved, the user can select `Promote to llm-wiki`, inspect the
resolved vault, L1/L2 route, verified PDF facts, evidence boundary, and exact target paths, then
confirm or cancel. A successful confirmation stores the official PDF, same-basename paper-record
sidecar, full-text L1/L2 analysis note, bidirectional links to 1–4 existing Topic/Method pages,
index/log entries, and automation audit in the live llm-wiki paths.

## Eligibility and evidence

- Only a persisted `source === "arxiv" && kind === "paper"` record with a canonical arXiv ID and
  HTTPS arXiv abstract URL is eligible.
- The official PDF must pass `%PDF` magic, positive page count, bounded byte size, usable extracted
  text, and SHA-256 verification.
- The analysis may summarize and audit author-reported full-text claims. It must never relabel those
  claims as independently reproduced results.
- L2 is the default. Codex may select L1 only for a genuinely foundational result, closest baseline,
  direct high-impact method, or paper requiring reviewer-level claim auditing.

## Runtime contract

1. Electron main reloads the complete SQLite discovery record; Discover results are materialized as
   `viewed` using their bounded session ID without changing the Saved star.
2. The adapter reads the live vault governance, templates, routing directories, runtime scope, and
   governed indexes. It deduplicates the canonical arXiv ID from paper-record sidecars.
3. The exact discovered arXiv version's PDF and Codex analysis are staged in an application temporary
   directory. Codex is ephemeral, read-only, shell-disabled, and returns a strict JSON note bundle;
   it has no live-vault write access. Electron main deterministically rebuilds governed frontmatter
   and provenance before validation, rather than trusting the model to reproduce boilerplate.
4. The renderer receives a 30-minute single-use preview UUID bound to its webContents owner, exact
   relative paths, PDF facts, route, evidence boundary, and blockers. It receives no absolute vault
   root, note/PDF content, or process capability. Electron main requires a final native confirmation.
5. On explicit confirmation, the service rechecks the persisted source hash. The adapter rechecks
   the live contract before and after acquiring `therss-paper-promotion`'s cooperative writer lease.
6. Electron main applies only the allowlisted write set, verifies the resulting PDF/sidecar/note,
   records the audit, releases the lease, and persists an append-only terminal receipt.

## Canonical outputs

- `raw/papers/Author et al. - Year - Title.pdf`
- `raw/paper_records/Author et al. - Year - Title.md`
- `Literature/Paper_Notes/L1_Deep_Read/<existing-domain>/Author_Year_Identifier.md` or
  `Literature/Paper_Notes/L2_Structured/<existing-domain>/Author_Year_Identifier.md`
- 1–4 selected existing `Topics/**/*.md` / `Methods/**/*.md` backlink pages
- `Literature/Paper_Notes/Paper_Notes_Index.md`
- `index.md`
- `log.md`
- `Automation_Conversations/YYYY-MM-DD__therss-paper-promotion__*.md`

QMD, Zotero, Git, publication, credentials, taxonomy creation/refactoring, and arbitrary renderer-
selected paths are outside this transaction.

The live writer registration must include `Topics` and `Methods` because canonical R1 paper ingest
requires reverse links. Until that persistent scope expansion is explicitly approved, live preview
fails closed before network or Codex; fixture verification does not override this gate.

## Failure and recovery

- Missing vault/Codex/PDF tools/runtime scope, duplicate IDs, target collisions, unsafe paths,
  source drift, contract drift, and lease conflicts block before a paper write.
- Codex receives only JSON Schema keywords supported by its structured-output API. Richer constraints,
  including unique Topic/Method paths, remain enforced at the local Zod trust boundary before any
  preview can become ready.
- A sidecar-only continuation synchronizes versioned arXiv/PDF/source links in frontmatter while
  preserving its other metadata and body text.
- Cancellation disposes staging and persists `skipped` locally.
- Confirmed write/verifier failures restore exact governed-file snapshots and remove new transaction
  files where possible. A surviving audit records `partial`; no optimistic success is returned.
- SQLite retains append-only running and terminal receipts with relative paths and hashes, but never
  stores PDF text, note content, prompt, stderr, secrets, or the absolute vault root.

## Verification boundary

Unit/integration tests use temporary fixture vaults and cover scope failure, exact paths, duplicate
arXiv detection, source/contract drift, completed writes, rollback/partial audit, persistence, and
accessible preview/confirm/cancel UI. Electron E2E uses a deterministic adapter and explicitly
states that no real vault write occurred. A live paper promotion is never part of an automated gate;
it requires the user to choose a real paper and confirm inside the app.
