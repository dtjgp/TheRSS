# ADR 0008: Confirmation-gated llm-wiki paper promotion

## Status

Accepted for implementation on 2026-08-21.

## Capability

After identifying a high-value arXiv paper in Discover or Saved, the local user can preview and
explicitly confirm one promotion into the canonical llm-wiki vault. The workflow reads the vault's
live governance at execution time, archives a real verified PDF and same-basename sidecar, routes
the paper note through the current L1/L2 rules, stores the evidence-bounded analysis in the
canonical note/deep-review surfaces, updates required navigation/log files, and returns a persisted
receipt with exact relative paths and an honest terminal state.

## Context

The existing `llm-wiki-paper-l1-v1` analysis is intentionally a packaged, abstract-only adaptation
of `Paper_Note_L1`. It cannot be exported as if it were a full-paper deep read. The referenced Daily
ArXiv Scan defines a materially stronger transaction: PDF acquisition and validation, sidecar
metadata, L1/L2 routing, bidirectional links, index/log writeback, writer ownership, and post-write
verification. A new capability must invoke that live workflow rather than duplicate a stale path or
template map inside TheRSS.

## Fixed constraints

- The first version accepts only a persisted `paper` whose source is `arxiv` and whose canonical
  identifier can be validated from stored source metadata.
- The renderer sends only bounded IDs plus an opaque confirmation token. It never receives
  filesystem, process, database, shell, or credential access.
- Preview and execution are separate typed IPC calls. Execution reloads the persisted source,
  recomputes its source hash and token, and repeats vault preflight.
- The vault root is resolved only in Electron main from a host setting/default, canonicalized, and
  accepted only when the required llm-wiki governance files are regular non-symlink files.
- The live vault must register `therss-paper-promotion` in its cooperative runtime scope map,
  including `Topics` and `Methods` for the R1-required reverse links. This persistent broad-scope
  registration is an explicit vault-owner approval gate.
- Preparation runs Codex CLI from an isolated temporary directory with a read-only sandbox, an
  ephemeral session, shell tooling disabled, bounded stdin/stdout/runtime, a reduced environment,
  and a strict structured analysis bundle. Codex never receives write access to the live vault.
- After confirmation, Electron main alone applies the validated bundle to an exact allowlisted
  write set while holding the live vault's cooperative writer lease.
- Paper metadata is delimited untrusted content. It cannot change paths, workflow rules, tools,
  external-action policy, or the receipt schema.
- The transaction may read official sources and obtain the official arXiv PDF. It must not commit,
  push, publish, message third parties, change credentials, or mutate Zotero without separate user
  authorization.
- The app stores only receipt metadata and relative vault paths. No full paper, vault note content,
  credential, prompt containing secrets, or Codex stderr is copied into TheRSS SQLite.
- Existing llm-wiki dirt is preserved. A lease conflict or unsafe overlapping writer becomes
  `blocked`; ambiguous post-write failure becomes `partial`, never an optimistic success.

## Implementation contract

### Actors and surfaces

- **User:** selects `Promote to llm-wiki`, reviews the workflow/evidence boundary and exact relative
  paths, confirms in the renderer, and accepts the final native Electron confirmation.
- **Renderer:** displays the preview, pending state, and persisted receipt.
- **Electron main:** validates IPC input, materializes an unsaved Discover result as `viewed`, and
  delegates to the promotion service.
- **Promotion service:** owns source hashing, confirmation validation, receipt validation, and
  local receipt persistence.
- **Staged Codex analyzer:** receives the verified PDF text plus snapshots of the live L1/L2
  templates, treats all paper content as untrusted, and returns only a schema-validated note bundle.
- **Vault adapter in Electron main:** owns live-contract preflight, lease acquisition, exact
  filesystem writes, post-write verification, rollback, and the automation audit record.

### States and transitions

```text
eligible -> preview_ready -> explicitly_confirmed -> running
running -> completed | partial | blocked | no-change | no-source | skipped | failed
```

- `blocked` covers missing Codex/vault governance/lease or a proven unsafe write boundary.
- `partial` covers incomplete PDF/note/index verification or an ambiguous failure after writes may
  have begun.
- `failed` is reserved for an application/process failure known not to be a valid vault terminal
  outcome; its generic message must not expose stderr or sensitive paths.
- A previous receipt remains visible and append-only when a later retry fails.

### Canonical output families

- `raw/papers/Author et al. - Year - Title.pdf`
- `raw/paper_records/Author et al. - Year - Title.md`
- `Literature/Paper_Notes/L1_Deep_Read/**` or `Literature/Paper_Notes/L2_Structured/**`
- 1–4 directly related existing Topic/Method pages, `Literature/Paper_Notes/Paper_Notes_Index.md`, `index.md`,
  `log.md`, and the exact automation audit record

The service validates that every reported path is relative, traversal-free, inside an allowlisted
family, and backed by an expected regular file. A `completed` receipt additionally requires a real
`%PDF` file, a same-basename sidecar, and an L1/L2 note.

## Non-goals

- Exporting repositories, articles, models, datasets, posts, or non-arXiv paper records.
- Treating a click or TheRSS score as proof that the paper qualifies for L1.
- Copying the existing abstract-only analysis verbatim and relabeling it as a full-paper review.
- Adding a write-capable MCP surface or renderer-selected arbitrary vault path.
- Updating derived QMD indexes in this first manual transaction; canonical Markdown/PDF writeback
  is owned here, while current index-maintenance automation remains the derived-cache owner.
- Installing/updating the local app, committing/pushing either repository, or changing the active
  Daily ArXiv Scan schedule.

## Failure, rollback, and observability

- The live vault's hash-pinned `automation_runtime.py` bytes are copied to temporary storage before
  execution; its lease is acquired before canonical writes and released with the reported terminal
  state and audit record. A legitimate runtime update requires an audited application baseline bump.
- Electron main creates the audit record from verified host-side facts: objective, exact write set,
  PDF verifier, claim boundary, Git/external state, and terminal status. Model output cannot select
  or falsify the audit path/status.
- New-file rollback is limited to paths created by the current transaction. Existing or overlapping
  dirty files are never reset or wholesale replaced.
- TheRSS persists runner, prompt/contract version, source hash, status, relative outputs, evidence
  tier, blockers, and timestamps so retries and partial outcomes remain inspectable.

## Verification

- Shared schemas reject invalid IDs, statuses, paths, tokens, or oversized receipts.
- Service tests cover ineligible sources, missing vault/Codex/scope, stale confirmation, untrusted
  metadata placement, bounded process arguments, path traversal, incomplete artifacts, and honest
  status downgrade.
- Repository tests cover migration, append-only receipts, and latest-by-item retrieval.
- Renderer tests cover preview, explicit confirm/cancel, busy state, terminal outcomes, and the
  arXiv-paper-only action.
- Electron E2E uses deterministic fixtures and never writes the real vault.
- A live read-only preflight may verify the configured vault and Codex executable; a real paper
  promotion requires a separately chosen paper and its in-app confirmation.

## Alternatives rejected

- **Write the current Analyze Markdown directly:** violates the abstract-only evidence boundary and
  skips PDF/sidecar/index/link governance.
- **Renderer filesystem access:** breaks the Electron trust boundary and permits arbitrary paths.
- **Hard-code template paths/content in TheRSS:** drifts from the live vault and cannot honor
  current routing or taxonomy.
- **Expose an MCP write tool:** widens the default read-only agent interface beyond this explicit
  single-paper UI action.
