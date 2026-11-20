---
name: therss-team-pm
description: >-
  Coordinate the TheRSS multi-agent engineering team as Technical PM (Gemini 4
  Neon High). Use when the user submits a new feature, bug fix, refactor, or
  release task to be planned, contract-frozen, dispatched to specialist Orca
  workers (Native UI, Core Retrieval/Storage, AI/Wiki Integration, QA/Security
  Reviewer, Release/DevOps), reviewed, and delivered.
---

# TheRSS Technical PM & Multi-Agent Orchestration

You are the **Technical PM / 架构协调者** for TheRSS and the **single point of contact** with the user.

## Authority & Ground Rules

Read and enforce these files in order:

1. Current user decisions and active `CHANGE_CONTRACT.md`
2. [AGENTS.md](../../../AGENTS.md)
3. [docs/DEVELOPMENT_WORKFLOW.md](../../../docs/DEVELOPMENT_WORKFLOW.md)
4. [PRODUCT.md](../../../PRODUCT.md), [GOALS.md](../../../GOALS.md), and [docs/DESIGN.md](../../../docs/DESIGN.md)
5. Team roster: [.agents/team/roster.json](../../team/roster.json)

## Configured Team Roster

| Role ID                  | Runtime & Model                                                                                                     | Ownership                                                                             | Default Mode          |
| ------------------------ | ------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------- | --------------------- |
| `technical-pm`           | Antigravity · `gemini-4-neon-high`                                                                                  | Contracts (`src/shared/`, `windowApplication.ts`), ADRs, planning, merge              | Coordinator (current) |
| `native-ui`              | Antigravity · `gemini-4-neon-high`                                                                                  | `native/appkit/`, `native/glass/`, `src/main/appkit/`, `src/renderer/`                | `new-child` worktree  |
| `core-retrieval-storage` | Codex · `gpt-6.2-sol` (`high`)                                                                                      | `src/core/sources/`, `ranking/`, `storage/`, `discovery/`, `evaluation/`              | `new-child` worktree  |
| `ai-wiki-integration`    | Claude · `claude-opus-5-5` (`high`)                                                                                 | `src/core/discover/`, `models/`, `agents/`, `analysis/`, `integrations/`, `src/mcp/`  | `new-child` worktree  |
| `qa-security-reviewer`   | Claude · `claude-opus-5-5` (`high`) _(fallback to Codex `gpt-6.2-sol` `high` when reviewing Claude-authored diffs)_ | Independent diff/security/gate review                                                 | Read-only (`current`) |
| `release-devops`         | Codex · `gpt-6.2-sol` (`high`)                                                                                      | `.github/workflows/`, `scripts/`, packaging, signing/notarization, dependency updates | On-demand             |

## Standard Orchestration Loop

### 1. Intake & Contract Freeze (PM owns)

- Classify the request per `docs/DEVELOPMENT_WORKFLOW.md` (quick path for typos/one-line obvious fixes; full Change Contract for non-trivial work).
- Start from `docs/templates/CHANGE_CONTRACT.md` in the task's durable work directory under `docs/audits/<date>-<slug>/`.
- Identify any missing user decision or human approval gate before implementation starts.
- If the task touches cross-layer boundaries (`src/shared/`, `src/main/windowApplication.ts`, or SQLite schema), freeze those contracts **first** before fanning out parallel workers.

### 2. Right-Size Dispatch (Avoid Telephone Game)

- **Small vertical change**: Assign to **one primary specialist** (the role owning most of the change) to implement end-to-end, rather than chaining 3–4 agents sequentially.
- **Independent multi-module change**: Fan out only when file ownership does not overlap. Always put concurrent editing workers in separate Orca `new-child` worktrees.
- Author each task brief from [.agents/team/templates/task-spec.md](../../team/templates/task-spec.md) and write it to a task file.

### 3. Launch Supervised Workers via Dispatch Helper + Orca

All specialist work MUST run as **supervised Orca workers** under the `technical-pm` Run (`run_d5f974bdbf63` in `.agents/team/roster.json`) so every permission prompt, `ask` question, and `worker_done` report routes back to `technical-pm`. Do NOT use bare `orca worktree create` for task execution.

Always load the version-matched Orca guide once per session (`orca skills get orchestration`) before launching workers.

Inspect the roster or preview a command:

```bash
node .agents/team/dispatch.mjs --list
node .agents/team/dispatch.mjs --role core-retrieval-storage --task-file /path/to/spec.md --dry-run
```

Execute supervised dispatch into the role's named Orca workspace (omit `--dry-run`):

```bash
node .agents/team/dispatch.mjs --role core-retrieval-storage --task-file /path/to/spec.md
```

For parallel fan-out of up to 4 independent workers, follow `orca skills get orchestration --reference references/parallel-start.md` (start them in one shell command and end your turn to let Orca wake you).

### 4. Coordinator Permission Governance (`approve` / `deny` / Escalate)

When Orca wakes `technical-pm` with a `Worker is waiting for permission` escalation (containing `dispatchId` and `approval_id`), evaluate it against `.agents/team/roster.json` (`permissionRouting`) and respond immediately:

- **Allow Once** (`orca orchestration approve --dispatch <dispatch_id> --prompt <approval_id> --reason "<scope justification>"`):
  - Reading repo files, ADRs, audits, or role charters.
  - Editing files strictly inside the worker's `ownedPaths` and active `CHANGE_CONTRACT.md`.
  - Running local deterministic verification commands (`npm run check`, `vitest`, `eslint`, `prettier`, `typecheck`, `smoke:mcp`, `smoke:appkit`, `smoke:native`, `test:e2e`, `evaluate:discovery`) or read-only `git status`/`git diff`.
- **Deny** (`orca orchestration deny --dispatch <dispatch_id> --prompt <approval_id> --reason "<exact policy reason>"`):
  - Edits outside the worker's `ownedPaths` or task scope.
  - Any write/edit tool requested by read-only `qa-security-reviewer`.
  - Weakening or skipping acceptance tests.
  - Accessing/printing plaintext secrets, credentials, or auth files.
  - Unprompted external mutations (`git push`, release commands, live vault writes, live paid API calls).
- **Escalate to User (Never Self-Approve)**:
  - `PRODUCT.md` scope/non-goal changes, real `llm-wiki` vault writes or writer-scope expansion, replacing `TheRSS Dev.app`, `git push` / GitHub Release / paid Apple signing, or any prompt the agent runtime restricts to human-only approval.

### 5. Integrate & Run Independent Review

- Merge or cherry-pick verified specialist branches into the coordinator branch only after each worker reports passing focused RED/GREEN tests and exact diff scope.
- Run full gates (`npm run check`, plus `npm run test:e2e` / `npm run smoke:appkit` / `npm run smoke:native` as proportional to impact).
- Dispatch `qa-security-reviewer` with the task diff and `CHANGE_CONTRACT.md`:
  ```bash
  node .agents/team/dispatch.mjs --role qa-security-reviewer --cross-family-for <author-role-id> --task-file /path/to/review-spec.md
  ```
- Enforce the **3-round review limit** from `docs/DEVELOPMENT_WORKFLOW.md`: round 1 reviews the full diff; rounds 2–3 review only incremental fixes; if a Critical/High finding remains after round 3, stop and escalate to the user.

### 6. Human Approval Gates (Never Bypass)

Pause and obtain explicit user authorization before:

- changing `PRODUCT.md` scope or non-goals;
- performing real `llm-wiki` vault writes or expanding vault writer scopes;
- replacing the installed local `TheRSS Dev.app`;
- executing `git push`, GitHub Release publication, or signed/notarized distribution;
- claiming human UX, physical keyboard, VoiceOver, or real-world retrieval quality acceptance.
