# ADR 0003: Deferred account-backed synchronization

- Status: Superseded — implementation withdrawn
- Date: 2026-08-16

## Current decision

On 2026-08-16, the user withdrew all account-login options and deferred synchronization. The current product exposes no account, OAuth, Google Drive, or Sync surface. The implementation and local credential/bookkeeping tables were removed while local interests, Saved/Dismissed state, and analysis records remain intact.

The design below is retained only as historical decision evidence. It must not be treated as a current capability or implementation plan unless the user explicitly reopens synchronization.

## Context

TheRSS is local-first and currently needs no account. The user would like the option to sign in with GitHub or Google so interests, saved items, and triage state can follow them across devices.

OAuth login proves an identity but does not provide a synchronization store, merge protocol, or deletion policy. A portable sync design also cannot upload model API keys, OAuth tokens, or macOS `safeStorage` ciphertext: the last of these is encrypted with OS-managed material on the originating device.

## Archived design

Keep account use optional and preserve a fully functional local-only mode. For the first synchronization implementation, prefer Google OAuth plus the Google Drive `appDataFolder` rather than introducing a TheRSS account server.

- Use the installed-desktop OAuth flow in the system browser, a loopback redirect, Proof Key for Code Exchange (PKCE), and a `Desktop app` client.
- Request only the narrow `drive.appdata` scope. The first version does not request identity, email, or profile scopes and does not display account identity.
- Store OAuth tokens locally behind Electron main-process `safeStorage`; never return them to the renderer or place them in the sync payload.
- Keep SQLite as the operational source of truth. Synchronization exchanges versioned portable records; it does not replace the local database.
- Synchronize interest profiles and saved/dismissed state. A saved record includes the bounded discovery snapshot required to render it on a new device.
- Keep analysis metadata and full analysis text local because they may contain sensitive research context.
- Do not synchronize provider API keys, OAuth tokens, local CLI state, source caches, refresh diagnostics, or OS-bound encrypted ciphertext.

Google documents `appDataFolder` as a hidden, per-user storage area accessible only to the creating app. It uses the narrow `drive.appdata` scope and fits a small personal configuration/state payload without a TheRSS-hosted backend.

## GitHub boundary

GitHub remains feasible as an identity provider. A public desktop client should use a GitHub App device flow rather than embed a client secret. GitHub recommends considering GitHub Apps for fine-grained permissions and short-lived tokens.

GitHub login alone does not provide a suitable sync store. A private Gist requires the broad `gist` scope, while a private repository introduces repository permissions and user-visible storage semantics. Therefore:

- do not use Gists or repositories as the default hidden sync database;
- add GitHub login only when TheRSS has a separate synchronization backend or when the user explicitly accepts GitHub-hosted, user-visible storage;
- supporting GitHub and Google identities for the same logical account requires account linking and therefore a backend with session, access-control, recovery, and deletion responsibilities.

## Merge and state semantics

- Give every synchronized record a stable identifier, schema version, `updatedAt`, and version vector.
- Store one bounded shard per device (`therss-sync-v1-<device-id>.json`) so two devices do not overwrite the same Drive file.
- Merge saved/dismissed state deterministically per item. Do not allow an older device snapshot to resurrect a deleted or dismissed record.
- Use last-write-wins only for simple scalar preferences. Surface concurrent interest-profile edits as a conflict instead of silently discarding one version.
- Represent `local_only`, `syncing`, `synced`, `conflict`, `auth_expired`, and `failed` as distinct user-visible states.
- Preserve the last usable local data when authentication or network access fails.

## Security and privacy guardrails

- The renderer receives only bounded account identity and sync status through schema-validated IPC.
- OAuth callbacks validate state and the exact loopback redirect contract. Issuer, audience, and nonce checks do not apply because this flow requests no OpenID Connect identity token.
- Logs and exports exclude access tokens, refresh tokens, authorization codes, API keys, and decrypted secret values.
- Settings must provide disconnect, remote-data deletion, and local-data retention choices. Revoking authorization and deleting synchronized data are separate operations.
- Automated tests use deterministic provider fixtures; live OAuth is an explicit opt-in release check.

## Alternatives considered

- **A TheRSS cloud backend with both providers:** enables provider-neutral accounts and future web/mobile clients, but adds hosted data, account linking, access control, operations, breach response, and deletion obligations. Defer until cross-provider identity is a confirmed product need.
- **GitHub Gist or repository storage:** avoids operating a backend but asks for overly broad or surprising GitHub permissions and exposes implementation details to the user. Not recommended as the default.
- **File export/import only:** remains a useful recovery and manual-transfer path, but does not satisfy automatic multi-device synchronization.

## Historical operational prerequisite

Each user-built installation needs a Google Cloud project with the Drive API enabled and a `Desktop app` OAuth client ID. The client ID is entered in TheRSS; a client secret is neither required nor stored. Live OAuth remains an explicit opt-in release check.

## Primary references

- Google OAuth 2.0 for desktop apps: <https://developers.google.com/identity/protocols/oauth2/native-app>
- Google OAuth security best practices: <https://developers.google.com/identity/protocols/oauth2/resources/best-practices>
- Google Drive application data folder: <https://developers.google.com/workspace/drive/api/guides/appdata>
- Google OAuth scopes: <https://developers.google.com/identity/protocols/oauth2/scopes>
- GitHub OAuth authorization and device flow: <https://docs.github.com/en/apps/oauth-apps/building-oauth-apps/authorizing-oauth-apps>
- GitHub App user access tokens: <https://docs.github.com/en/apps/creating-github-apps/authenticating-with-a-github-app/generating-a-user-access-token-for-a-github-app>
- GitHub Gists API and permissions: <https://docs.github.com/en/rest/gists/gists?apiVersion=2026-03-10>
