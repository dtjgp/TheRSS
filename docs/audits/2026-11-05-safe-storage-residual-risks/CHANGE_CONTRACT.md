# safeStorage residual risks: re-encryption and credential write order

## Feature Intake

- User outcome: the protected model API key follows the last user action, and stored ciphertext
  moves to the current OS key after Electron reports a key rotation.
- Observed problem/evidence: the Electron 45 contract
  (`docs/audits/2026-11-04-electron-45-safe-storage/CHANGE_CONTRACT.md`, "Known residual risks")
  records two reviewed risks. (1) `ElectronSecretCipher.decrypt` reads only `.result` and ignores
  `shouldReEncrypt`. (2) `ProviderService.save` with a key waits on `encrypt`; a
  `clearCredential` call during that wait runs first, and the save then writes the key back.
- Product fit and relevant non-goal: security maintenance. No new product behavior. Downgrade to
  Electron 44 (a possible key re-entry) stays documentation only.
- Alternatives considered, including no change: no change (keeps both risks); a generation
  counter (fixes clear-vs-save but needs extra rules for save-vs-save and for metadata in a stale
  save); one write queue per provider (chosen: every credential write runs in call order, so the
  last call wins for all write pairs).
- Cost: small change in `ProviderService`, one repository method, one cipher type. No runtime or
  external service cost.
- Boundary changes: security boundary (secret persistence) only. No SQLite schema, IPC schema, or
  renderer change.
- Kill criterion: re-encryption needs a plaintext copy outside the main process, or a schema
  change.
- Decision: proceed.

## Capability Contract

- Objective: close the two residual risks.
- Goals:
  - `SecretCipher.decrypt` returns `{ value, shouldReEncrypt }`. When `shouldReEncrypt` is true,
    `ProviderService` encrypts the value again and replaces the stored ciphertext.
  - The replacement is compare-and-swap: it writes only if the row still holds the ciphertext
    that was decrypted. A clear or a new key that happens first is never overwritten.
  - `save`, `clearCredential`, and re-encryption run in one queue per service, in call order. The
    service has one provider (`default`), so one queue is one queue per provider.
- Non-goals: a downgrade path to Electron 44; credential UI changes; new logs.
- Interfaces and public API invariants: `ProviderService.clearCredential` now returns a promise.
  Its callers (`windowApplication` `task`, the AppKit settings view through IPC) already accept a
  promise. `getConnectionTestProfile` and `getExecutionProfile` keep their return shapes.
  Re-encryption does not change `updatedAt`, because it is not a user edit.
- Data ownership and evidence semantics: SQLite keeps only ciphertext. Plaintext stays in main.
- Failure states: if re-encryption fails, the read still returns the key and the old ciphertext
  stays; the next read tries again. A rejected save does not stop later queued writes.
- Migration and rollback: no data migration. Rollback: revert the commit. Ciphertext that this
  change re-encrypts is ordinary `encryptStringAsync` output and stays readable after a revert.
- Observability/diagnostics: no new logs. No plaintext or ciphertext is logged.
- Electron documentation note: the Electron 45.2.3 `electron.d.ts` comment for `shouldReEncrypt`
  says "call `decryptStringAsync` again"; the same comment says the data "should be re-encrypted,
  as the key has been rotated". This change follows the flag's stated meaning (re-encrypt with
  `encryptStringAsync`). Not verified on a real key rotation; the OS controls rotation.
- Allowed scope: `src/core/models/providerService.ts` and its test,
  `src/core/storage/modelProviderStore.ts`, `src/core/storage/researchRepository.ts`,
  `src/main/index.ts`, `src/core/analysis/analysisService.test.ts`,
  `scripts/smoke-safe-storage.mjs`, this contract.
- Persistent writeback: this contract.

## Uncertainty Reducer

- Change class: security boundary (concurrency and persistence).
- Chosen artifact: failing reproduction with a deterministic fake cipher.
- Question it must answer: with controlled promise order, does the last credential call win, and
  does a `shouldReEncrypt` read replace the stored ciphertext?
- What it does not prove: real macOS Keychain key rotation.

## Frozen Acceptance Contract

- RED verifier and expected failure: `npx vitest run src/core/models/providerService.test.ts`.
  The new tests fail before the fix: the cleared key comes back, the earlier save wins, and the
  legacy ciphertext stays.
- Focused unit/integration cases:
  - clear during a pending keyed save leaves no credential;
  - two keyed saves resolve out of order and the later call wins;
  - a rejected save does not block a later clear;
  - a `shouldReEncrypt` read through `getExecutionProfile` and `getConnectionTestProfile`
    replaces the ciphertext and keeps `updatedAt`;
  - a clear queued after a re-encryption still wins;
  - a clear or a new key that reaches the row before the re-encryption write is not overwritten
    (added after review; these fail when the compare-and-swap condition is removed);
  - a failed re-encryption still returns the key and keeps the old ciphertext.
- Migration/rollback cases: none (no schema change).
- E2E/manual path: not affected (no UI change).
- Screenshot/viewport/accessibility matrix: not applicable.
- Security/dependency impact: `npm run smoke:credentials` also checks that the real
  `decryptStringAsync` result has a boolean `shouldReEncrypt`.
- Package/install/live opt-in impact: none. No live provider call.
- Full verifier: `npm run check`.
- Stop condition: the RED cases fail before and pass after the fix; `npm run check` exits 0;
  `npm run smoke:credentials` exits 0 on this Mac.

### Acceptance-change log

| Date       | Contract change                                        | Evidence/reason                                      | Reviewer |
| ---------- | ------------------------------------------------------ | ---------------------------------------------------- | -------- |
| 2026-11-05 | Tests await `clearCredential`; fakes return `{value}`. | `clearCredential` is queued; `decrypt` reports flag. | Claude   |
| 2026-11-05 | Add two compare-and-swap cases; rename one case.       | Review: no case failed without the swap condition.   | Claude   |

## Implementation Slices

1. RED: race and re-encryption tests with a deferred fake cipher.
2. Minimal GREEN: write queue, `DecryptedSecret`, compare-and-swap repository method.
3. Refactor: one private read helper for both decrypt paths.
4. Next slice gate: `npm run check`.

## Independent Review

- A fresh-context code review found no blocking issue. It confirmed: a rejected write does not
  block the queue; no queued operation waits on the queue (no deadlock); the swap compares the
  exact decrypted bytes on a `BLOB` column; every `clearCredential` caller accepts a promise; no
  new log or error carries a secret.
- Finding (medium, test gap): the case "a clear during re-encryption" queued the clear after the
  re-encryption, so it passed without the swap condition. Resolution: renamed it and added the
  two cases above. A mutation run that removed the `secret_ciphertext = ?` condition failed both
  new cases; the condition was then restored.
- Non-blocking notes: a hung `encryptStringAsync` now delays later credential writes (a direct
  result of "last call wins"; not observed). If a backend reports `shouldReEncrypt: true` on every
  read, each read does one extra encrypt and write (correct but wasteful; not verified).

## Evidence Closeout (local, macOS, Node 24.13.0)

- Changed files: `src/core/models/providerService.ts` and its test,
  `src/core/storage/modelProviderStore.ts`, `src/core/storage/researchRepository.ts`,
  `src/main/index.ts`, `src/core/analysis/analysisService.test.ts`,
  `scripts/smoke-safe-storage.mjs`, this contract.
- Deliberately untouched files: IPC schema, preload, renderer, AppKit settings,
  `scripts/evaluate-discovery.ts` (its rejecting fake still matches the new type).
- Focused RED/GREEN: with only the `DecryptedSecret` type change in place, 4 of 13 provider cases failed
  for the expected reasons (cleared key restored; earlier save stored; legacy ciphertext kept on
  both read paths). After the fix and the review cases: 15/15 provider cases pass.
- `npm run check`: the `format:check` step fails only on `.claude/settings.local.json`, a
  git-ignored file that the desktop app wrote into this worktree; CI does not have it. The same
  steps with only that file excluded exit 0: 847 + 189 tests; coverage 91.53% statements,
  83.15% branches, 95.02% functions, 94.18% lines.
- `npm run smoke:credentials`: exit 0 (real `safeStorage` round trip and boolean
  `shouldReEncrypt`).
- Not run: real Keychain key rotation; packaged-app smoke (CI `desktop` job); live provider calls.
- Local Node 24.13.0 is below the `engines` floor 24.15.0; CI uses Node 24 and 26.
