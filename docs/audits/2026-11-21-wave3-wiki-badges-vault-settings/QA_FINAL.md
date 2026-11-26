# Wave 3 Cross-Family Independent QA Closeout Report

- **Branch**: `feat/wave3-wiki-badges-vault-settings-and-splits`
- **Final Reviewed SHA (pre-rebase)**: `f90061a62a91efaa2654e5af7fd804ea66e94e86`
- **Overall Verdict**: **UNANIMOUS APPROVED** (0 Critical, 0 High, 0 Medium open)
- **Review Policy**: Dual-track cross-family zero-authorship review (`.agents/team/roster.json`)
  - **Track A (`qa-security-reviewer`, Claude Opus 5.5 High)**: Shared Contract (Gemini), Slice 3A Storage & Splits (Codex), Slice 3C Native AppKit UI (Gemini), Coordinator Main/Preload/IPC Integration (Gemini), `CHANGE_CONTRACT.md` Acceptance-change log.
  - **Track B (`release-devops` cross-family fallback, Codex GPT-6.2-Sol High)**: Claude-authored Slice 3B (`llmWikiLibrary`, `llmWikiDiagnostics`, `llmWikiDaily`, `llmWikiVaultAdapter`, `llmWikiVaultSupport`, `llmWikiVaultPaths`) + Main wiring cross-check.

## Review Trajectory

### Round 1 (`bd5dc5c`) — `CHANGES_REQUESTED` on Both Tracks

- **Track A (Claude Opus 5.5 High)**: 0 Critical, 0 High, 2 Medium (`M1` evidence-state conflation in empty `In llm-wiki` views for pending/unavailable; `M2` cached `'unavailable'` list badges had no recovery path on `Recheck vault`), 5 Low (`L1` per-ID race between slow batch and `refreshOne`; `L2/L3` `settingsChanged` broadcast coupling & unnecessary rescans on general settings saves; `L4` `\p{Cf}` bidi/zero-width characters in vault paths; `L5` native smoke coverage for `settings-wiki` & wiki filter).
- **Track B (Codex GPT-6.2-Sol High)**: 0 Critical, 1 High (`B-H1` `LlmWikiLibrary.open()` TOCTOU reading mutable `this.cached.root` across concurrent vault switches), 3 Medium (`B-M1` raw `THERSS_LLM_WIKI_PATH` trimmed/truncated before validation + main operational resolver bypassing validation; `B-M2` ancestor symlink following & unguarded `realpath` error in `llmWikiDiagnostics`; `B-M3` empty-cache concurrent root-switch race in `LlmWikiLibrary.scan()`), 1 Low note (`B-L1` `LlmWikiVaultAdapter.confirm()` consulting `#resolveVaultRoot()`).

### Round 2 (`3561ad1`) — Track A `APPROVED`, Track B `CHANGES_REQUESTED`

- **Track A (Claude Opus 5.5 High)**: **VERDICT: APPROVED**. Confirmed `M1`, `M2`, `L1`, `L2/L3`, `L4`, and `L5` closed with TDD regressions and acceptance-change log entry; noted 4 non-blocking LOW residuals (`R1` mid-file type import in `discoverToolbar.ts`, `R2` `\p{Cf}` fail-closed trade-off, `R3` rare transient-list-error recheck boundary, `R4` test comment wording).
- **Track B (Codex GPT-6.2-Sol High)**: Confirmed all 5 Round 1 items closed; identified 2 remaining Medium root-path policy gaps:
  - `B2-M1`: Valid paths with `.` or repeated `//` falsely reported as symlinks when compared against `realpath`.
  - `B2-M2`: Ancestor-symlink policy applied in `llmWikiDiagnostics` but not unified across operational consumers (`LlmWikiLibrary`, `LlmWikiDaily`, `preflightVault`).

### Round 3 (`e0d3f5c` → `f90061a`) — **UNANIMOUS APPROVED**

- **Commit `e0d3f5c`**: Added lexical normalization (`normalizeAbsolutePosixPath`) after raw validation, unified `validateSafeVaultRoot` / `assertSafeVaultRoot` across diagnostics + Library + Daily + `preflightVault`, and closed Track A's `R1`.
  - **Track A (Claude Opus 5.5 High)**: **VERDICT: APPROVED** at `e0d3f5c`.
  - **Track B (Codex GPT-6.2-Sol High)**: Confirmed `B2-M1` and `B2-M2` closed on ordinary spellings; identified 1 remaining Medium path-identity edge case (`'/real/vault /.'` exposed terminal whitespace after normalization, breaking idempotence across double parsing) and 1 Low test-fixture gap (`Literature/Digests/ArXiv_Daily` missing in the alias fixture).
- **Commit `f90061a`**: Enforced `normalized === normalized.trim()` inside `isSafeAbsoluteVaultPath` (guaranteeing mathematical idempotence `f(f(x)) === f(x)` and rejecting terminal-space exposures before any filesystem call) and added the real-vault Daily control assertion before the alias assertion.
  - **Track B (Codex GPT-6.2-Sol High)**: **VERDICT: APPROVED** at `f90061a`. Independently verified 2,895 generated path spellings reparse identically, space-before-slash/dot and Unicode whitespace inputs trigger 0 `lstat`/`realpath` calls, and Daily returns `missing` on the real vault and `unavailable` behind the ancestor symlink.

## Non-Blocking Residual Notes

- **Human physical-keyboard / VoiceOver acceptance** and **real-paper promotion acceptance (`P0-1`)** remain separate user-in-the-loop activities outside automated fixture gates.
- Track A non-blocking LOW notes `R2` (`\p{Cf}` fails closed with a general message), `R3` (transient read error while diagnostics stays Ready recovers via folder change/restart), and `R4` (test comment wording) are accepted as documented low-risk boundaries.
