# Electron 45 and asynchronous safeStorage

## Feature Intake

- User outcome: TheRSS runs on Electron 45 and keeps the protected model API key.
- Observed problem/evidence: Dependabot PR #82 (Electron 44.9.3 to 45.1.0) failed the CI `desktop`
  job. `scripts/smoke-native-appkit.mjs` requires no application stderr, and Electron 45 writes
  deprecation warnings for `safeStorage.isEncryptionAvailable`, `encryptString`, and
  `decryptString` (CI run 41195987314).
- Product fit and relevant non-goal: dependency maintenance. No new product behavior.
- Alternatives considered, including no change: stay on Electron 44 (closes #82 and keeps a
  deprecated API that Electron will remove); filter the warnings in the smoke test (hides the
  problem). Use the asynchronous API.
- Cost: small main-process change; no runtime or external service cost.
- Boundary changes: security boundary (secret encryption) only. No SQLite schema, IPC schema, or
  renderer change.
- Kill criterion: the asynchronous API cannot decrypt ciphertext from the synchronous API.
  Electron 45 documents that `decryptStringAsync` decrypts `encryptString` data.
- Decision: proceed.

The same PR also carries the Dependabot bumps from #81 (lucide-react) and #83 (electron-vite 6),
because the repository requires an up-to-date branch for each merge. `npm install` resolved
electron 45.2.3, electron-vite 6.0.0, and lucide-react 1.68.0; these are the versions under test.

## Capability Contract

- Objective: replace the deprecated synchronous `safeStorage` calls with the asynchronous calls.
- Interfaces and public API invariants: `SecretCipher` methods return promises.
  `ProviderService.save`, `getConnectionTestProfile`, and `getExecutionProfile` return promises.
  The preload API is already asynchronous and does not change.
- Data ownership and evidence semantics: SQLite keeps only ciphertext. Plaintext stays in main.
- Failure states: unavailable encryption still rejects a new key with the same message.
- Migration and rollback: no data migration. Existing ciphertext from Electron 44 decrypts with
  `decryptStringAsync`. Rollback: revert the commit. Not verified: whether Electron 44 can decrypt
  ciphertext that Electron 45 writes; a downgrade can require the user to enter the key again.
- Observability/diagnostics: no new logs. No secret value is logged.
- Allowed scope: `src/core/models/providerService.ts`, its consumers, `src/main/index.ts`, the two
  smoke scripts, `scripts/evaluate-discovery.ts`, affected tests, `package.json`,
  `package-lock.json`.
- Known residual risks (reviewed, not fixed here): `shouldReEncrypt` from `decryptStringAsync` is
  ignored, so rotated-key ciphertext stays until the next key save; a keyed save that waits on
  encryption can complete after a concurrent "clear credential" and restore the key.
- Persistent writeback: this contract.

## Uncertainty Reducer

- Change class: security boundary plus dependency update.
- Chosen artifact: failing reproduction (CI deprecation assertion) and focused unit RED.
- Question it must answer: does the provider flow work with an asynchronous cipher?
- What it does not prove: macOS Keychain behavior; the safeStorage smoke covers that.

## Frozen Acceptance Contract

- RED verifier and expected failure: `providerService.test.ts` with an asynchronous fake cipher
  fails before the service awaits the cipher.
- Focused unit/integration cases: provider save, edit, connection test, unavailable encryption;
  analysis and Discover planner with a provider profile.
- E2E/manual path: `npx playwright test`; `smoke-native-appkit.mjs` with no deprecation stderr.
- Security/dependency impact: `npm run smoke:credentials` round trip through the asynchronous API.
- Package/install/live opt-in impact: CI packaged-app smoke. No live provider call.
- Full verifier: `npm run check` and CI `quality` and `desktop` jobs.
- Stop condition: all of the above pass.

### Acceptance-change log

| Date       | Contract change                                         | Evidence/reason                                  | Reviewer |
| ---------- | ------------------------------------------------------- | ------------------------------------------------ | -------- |
| 2026-11-04 | Provider tests await the service and use an async fake. | The cipher contract is now asynchronous (above). | Claude   |

## Independent Review

- A fresh-context code review found no blocking issue. It confirmed that no synchronous caller
  remains, that the error semantics are unchanged, that shutdown waits for pending saves, and that
  the smoke patch still records the credential hash. Its finding on `scripts/evaluate-discovery.ts`
  (synchronous fake cipher) is fixed. The two residual risks above are recorded, not fixed.

## Evidence Closeout (local, macOS, Node 24.13.0)

- Focused RED/GREEN: `providerService.test.ts` failed 6/6 with the async fake before the change
  (`SQLite3 can only bind ...`), and passed 6/6 after it.
- `npm run check`: exit 0; 803 + 175 tests; coverage 91.25% statements, 82.7% branches,
  94.81% functions, 93.91% lines.
- `npx playwright test`: exit 0.
- `smoke-native-appkit.mjs` + `smoke-appkit-controls.mjs` (CI environment flags): exit 0.
- `npm run smoke:credentials` (async round trip): exit 0.
- Not run locally: packaged-app smoke (CI `desktop` job runs it); live provider calls.
- Local Node 24.13.0 is below the `engines` floor 24.15.0; CI uses Node 24 and 26.
