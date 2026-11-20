# Task Dispatch Spec: Dependency, Audit & Stale Branch Triage

- **Task Title**: Audit Dependabot PRs #100/#101, npm moderate vulnerabilities, and stale local branches
- **Assigned Role**: `release-devops`
- **Change Contract**: Read-only release/hygiene triage (no code mutations, no merges, no pushes, no branch deletions)
- **Base Branch / Commit**: `dtjgp/release-devops` (`692f9e4`)

## Objective

Produce an evidence-backed triage report covering the two open Dependabot PRs (#100 and #101), the current `npm audit` moderate/low advisories, and the stale local Git branches so Technical PM and the user can approve exact cleanup/merge actions safely.

## Allowed Edit Scope

- Write ONE report file only: `docs/audits/2026-11-20-deps-and-branches-audit/REPORT.md` (inside your worktree)

## Explicitly Out of Scope (Do Not Touch)

- Do NOT modify `package.json`, `package-lock.json`, source code, or CI workflows
- Do NOT merge PRs, close issues, push to GitHub, delete branches, or reinstall `TheRSS Dev.app`

## Required Checks & Evidence to Collect

1. Inspect PR #100 and PR #101 (`gh pr view 100 --json ...`, `gh pr diff 100`, `gh pr view 101 --json ...`, `gh pr diff 101`):
   - Exact dependency bumps (old -> new), whether any native addon / Electron ABI (`better-sqlite3`, `electron`, `node-api-headers`) or `allowScripts` entry is affected, and CI check conclusions.
2. Run `npm audit --json` (read-only) and summarize:
   - Exact count by severity (`critical`, `high`, `moderate`, `low`).
   - Prod vs dev-only classification for each unique advisory/package.
   - Which advisories would be resolved by PR #100 / #101 vs remain open.
3. Inspect the 5 local non-main, non-team branches (`claude/practical-murdock-a51318`, `codex/daily-papers`, `docs/safe-storage-contract-closeout`, `fix/safe-storage-residual-risks`, `fix/ncpssd-issue-number-status`) relative to `origin/main` (`git log --oneline origin/main..<branch>` and `git cherry -v origin/main <branch>`):
   - Specifically verify whether `fix/ncpssd-issue-number-status`'s extra commit is already functionally in `origin/main` or contains unmerged work!
4. Check local Node version vs `package.json` `engines` (`^24.15.0 || >=26.0.0`).

## Required Delivery Report

Write the structured report to `docs/audits/2026-11-20-deps-and-branches-audit/REPORT.md` with clear, numbered recommendations (`Approve & Merge` / `Hold` / `Safe to Delete` / `Keep`) and report back via Orca `worker_done`.
