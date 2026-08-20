# Capability: Paper-specific llm-wiki L1 analysis

## User outcome

When a Discover result or selected Saved record is typed as a paper, the user can invoke the
configured model, Codex CLI, or Claude Code through an explicit Analyze action. Discover expands the
resulting artifact in the result card; Saved places it immediately after the discovery summary. Both
surfaces use the same evidence-bounded adaptation of llm-wiki's `Paper_Note_L1` structure.

## Source contract

- Adapted source: the llm-wiki vault template `Templates/Paper_Note_L1.md`.
- Source SHA-256 at adaptation time: `0e972c24237da87f02da5fc2adee750791c94cc18be4c27389aa743a4ae312c1`.
- Persisted TheRSS prompt version: `llm-wiki-paper-l1-v1`.
- The packaged app contains a versioned prompt adaptation; it does not read or modify the user's
  vault at runtime. A later template change requires an explicit prompt-version update and tests.

The paper prompt preserves the template's decision-bearing sequence: quick decision card, TL;DR,
basic information, contribution/novelty map, technical core, claim-evidence ledger, experiments and
reproducibility, reuse feasibility, reviewer assessment, current-research next step, and connection
placeholders.

## Evidence boundary

- The input is bounded discovery metadata and usually an abstract, not a verified full paper.
- The generated result must identify itself as `abstract-only / provisional` and must not claim to
  be a completed L1 deep read.
- Missing authorship, venue, method, setting, result, comparator, source locator, code, artifact,
  hardware, seed, or statistical detail remains `[TBD]`; the prompt forbids guessing.
- Author-reported claims, analyst inference, and reproduced evidence remain distinct. Discovery-only
  analysis has no reproduced evidence.
- FLOPs do not establish latency or energy, and abstract text does not establish novelty,
  matched-budget fairness, reproducibility, or code quality.

## Interfaces and ownership

- Paper routing uses the normalized `DiscoveryItem.kind === "paper"` contract, so it applies to
  arXiv, Hugging Face papers, and future typed paper adapters rather than relying on a source name.
  Legacy arXiv snapshots whose optional `kind` predates that contract retain a narrow compatibility
  fallback; an explicit non-paper kind is never overridden.
- Electron main and the existing `AnalysisService` own model/local-agent execution and persistence.
- An unsaved Discover paper is materialized as a local `viewed` discovery record before analysis so
  the artifact has a stable source row; this prerequisite does not change the visible Saved star.
- Every artifact retains provider/runner, model/tool, prompt version, discovery-source hash, content,
  and timestamp in SQLite.
- Renderer receives the existing typed artifact only. It gains no filesystem, vault, process,
  database, credential, or arbitrary-network access.
- The result renderer supports only bounded headings, paragraphs, lists, and tables; React escapes
  the text, and model-supplied HTML is never interpreted.
- Repositories, articles, models, datasets, and posts retain `discovery-analysis-v1`.

## Interaction, failure, and rollback

- Analysis remains user initiated. Merely selecting a paper never spends provider quota or starts a
  local process.
- The Discover Analyze action is present only on typed paper results and appears immediately to the
  right of the reversible Saved star.
- Before analysis, the paper section explains the evidence level and the Analyze / `A` action.
- A saved artifact from the older generic paper prompt remains visible, is not relabeled as L1, and
  invites an explicit replacement run.
- Provider and local-agent failures keep the previous persisted artifact and existing local index;
  the renderer uses the established bounded error state.
- No schema migration is required. Rollback means reverting prompt/UI code; existing artifacts remain
  readable because prompt versions are opaque persisted strings.

## Verification

- Unit: paper/non-paper prompt routing, required L1 sections, `[TBD]` and evidence constraints,
  model output budget, and local-agent prompt reuse.
- Integration: paper artifacts persist `llm-wiki-paper-l1-v1` for model and local-agent runners.
- Renderer: Discover exposes a paper-only Analyze action without auto-saving, while both Discover
  and Saved render accessible L1 artifact regions.
- Electron E2E: the fixture verifies the independently scrollable result region, outline/filled star
  transitions, paper-only analysis, and the provenance-bearing L1 result.

## Non-goals

- Automatic provider/agent execution on selection.
- Full-paper retrieval, PDF parsing, code audit, independent reproduction, or autonomous scientific
  verification.
- Writing a paper note into llm-wiki or inventing canonical Obsidian links.
- Replacing Zotero/Obsidian paper management.
