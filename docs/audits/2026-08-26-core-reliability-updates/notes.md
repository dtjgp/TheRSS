# Notes: Core reliability updates

## Confirmed baseline

- `main` is clean and matches `origin/main` at `c4a0c66` (`feat(ui): add Discover result workspace
(#32)`).
- The application version in `package.json` is `0.2.0`; `PRODUCT.md` still calls the installed and
  published build v0.1.
- The Discover UI release evidence still records the pre-merge branch boundary even though PR #32
  is merged.
- The roadmap still defers `Zotero/llm-wiki promotion` as one item. Confirmation-gated llm-wiki
  promotion is implemented; broad live Topic/Method writer scope remains a separate governance gate,
  while Zotero remains deferred.
- `install-local-beta.mjs` creates a database backup and recoverable application bundle replacement,
  but has no same-release idempotency guard, structured completion receipt, or post-install assertion
  that the live database path remains present and readable.
- Discover currently awaits one `searchDiscover` request and exposes no typed cancellation or
  failed-source retry operation.
- The shared API exposes only the latest item analysis directly; Data Analytics shows a metadata
  ledger but does not reopen an immutable historical artifact or compare its source hash with the
  current source snapshot.

## Evidence boundaries

- A recently observed Application Support directory recovery justifies hardening and investigation,
  but does not prove the installer moved the directory.
- Automated tests must keep external sources, model providers, and the real llm-wiki vault disabled.
- The unsigned personal-beta installer must not claim production automatic update behavior.

## Final verified evidence

- `npm run check`: 60 test files / 402 tests; statements 90.29%, branches 80.15%, functions
  93.64%, lines 93.20%; architecture, formatting, lint, typecheck, coverage, renderer/main/preload/MCP
  builds all passed.
- Electron E2E: 2/2 passed with temporary user data. The desktop flow covers Command-F local search
  and historical analysis reopening; the independent sidebar flow also passed.
- Production dependency audit: zero vulnerabilities.
- macOS arm64 unsigned directory package: built successfully; package smoke passed.
- Packaged `app.asar` SHA-256:
  `80d54e0b63fb900fa2b536c3fb9b72681fbe248edd6fde9b047feeb24d246005`.
- Isolated installer/migration/local-search closeout: 3 files / 9 tests passed.
- `git diff --check`, added-line credential/private-key/debug scan, and architecture line limits
  passed. `main` remains uncommitted and no live app/database was replaced.
