# Change contract: follow the llm-wiki 2026-11-09 layout

## Feature intake

- **User outcome:** Daily Papers and paper promotion keep working after the llm-wiki vault removes its legacy top-level folders.
- **Observed problem:** The vault restructure (llm-wiki `log.md`, 2026-11-09) moves method pages into `Topics/` and moves the daily digests from `Inbox/Research_Feeds/ArXiv_Daily` to `Literature/Digests/ArXiv_Daily`. TheRSS hard-codes both old locations. The promotion preflight reads `Methods/` and requires a `Methods` lock scope; the Daily Papers reader requires the old digest folder. Without this change both features stop when the vault deletes the old folders.
- **Product fit:** No product change. The existing read-only Daily Papers bridge and the confirmation-gated promotion keep their behavior and their user-visible copy.
- **Alternatives:** (1) Keep the old vault folders for TheRSS only: keeps an empty `Methods/` and leaves digests in `Inbox`, against the vault's own layout. (2) Read both old and new locations: adds a fallback path that the single-user vault no longer needs. (3) Follow the new layout. Select (3).
- **Cost and boundaries:** Path constants, one preflight requirement and two `relatedPaths` patterns. No new package, IPC, storage, UI, network or schedule.
- **Kill criterion:** If the vault keeps the old layout, revert this change.

## Capability contract

- **Objective:** TheRSS reads and writes only paths that exist in the current llm-wiki layout.
- **Interfaces:** Unchanged signatures. `LlmWikiDaily` reads `Literature/Digests/ArXiv_Daily/ArXiv_Daily_<date>.md`. The promotion preflight builds its knowledge catalog from `Topics/` only and requires the `therss-paper-promotion` lock scopes without `Methods`. The analysis schema accepts `relatedPaths` only under `Topics/`.
- **Ownership:** Unchanged. llm-wiki owns its layout and lock-scope registry; TheRSS remains a reader of the digest and a governed writer for promotion.
- **Failure states:** Unchanged. A missing digest folder, unsafe path, absent scope or empty catalog still fails closed with the existing messages.
- **Migration/rollback:** No TheRSS data migration. Rollback is a revert of this change together with the llm-wiki layout commit. The installed app keeps the old behavior until it is rebuilt; reinstallation is a separate, user-authorized step.
- **Allowed scope:** `src/core/integrations/llmWikiDaily.ts`, `llmWikiVaultSupport.ts`, `llmWikiVaultTypes.ts`, `src/main/llmWikiPromotionRuntime.ts`, their tests, and this record. No vault write from tests.

## Uncertainty reducer

Read-only check of the live vault after its migration: the digest folder, `Topics/` method pages and the lock-scope registry must match the new constants. The check does not prove the installed app; that needs a rebuild.

## Frozen acceptance contract

- **Test contract change (recorded before editing):** The fixtures encode the old vault layout. They change because the vault layout changed, not to fit an implementation: the daily fixture moves to `Literature/Digests/ArXiv_Daily`; the adapter fixture moves its method page to `Topics/Methods/` and drops the `Methods` scope.
- **RED:** With only the fixtures updated, the daily tests fail (digest folder not found) and the adapter preflight fails (missing `Methods` folder and scope).
- **New assertions:** The analysis schema rejects a `Methods/...` related path; the promotion preflight succeeds without a `Methods/` folder.
- **Verifiers:** focused suites, `npm run check`, independent diff review, read-only check against the migrated vault. No live model call, installation, push or release.
- **Stop:** All verifiers pass on the development build. Reinstalling the local beta app is recorded as a separate step.

## Verification record (2026-11-09)

- **RED:** after the fixture change only, 24 of 41 focused tests failed for the expected reasons: unregistered writer scope (missing `Methods`), digest unavailable at the new folder, and a `Methods/...` related path still accepted.
- **GREEN:** the same three suites pass (41/41) after the four constant and pattern changes.
- **Full gate:** `npm run check` exit 0 (architecture, format, lint, typecheck, 878 + 194 tests, coverage above 80%, build).
- **Live vault, read-only:** after the llm-wiki migration, `LlmWikiDaily.snapshot()` returns `completed` for 2026-11-09 with 7 papers; `preflightVault()` passes with 134 `Topics/` pages and no `Methods/` folder.
- **Found during the check:** the 2026-11-09 digest used `####` paper headings from a new vault template, so this parser reported the edition as unavailable. Fixed on the vault side (template and that digest now use `###`); the parser was not changed.
- **Local install (user-authorized):** `npm run install:local` timed out while downloading Electron. The same steps then ran with the identical local Electron 45.2.3 (`-c.electronDist=node_modules/electron/dist`): build, package and `scripts/install-local-beta.mjs` exit 0. The previous app and database were backed up by the script. The installed `app.asar` contains the new digest path and no old path.
- **Not done:** no commit, push or release; E2E suite not rerun because no UI changed.
