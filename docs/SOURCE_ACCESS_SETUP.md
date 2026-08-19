# Source access setup

This document describes credentials and local setup for configured TheRSS sources. Never commit a
token, paste it into a source URL, or expose it to renderer code. Only the 22 sources whose item
model, ranking, storage, and source-run states cross the complete product boundary are exposed in
Discover; deferred catalog candidates remain unavailable.

## Current status

| Source group                    | Current access                      | Credential              | Product state      |
| ------------------------------- | ----------------------------------- | ----------------------- | ------------------ |
| arXiv                           | Native Atom API                     | None                    | Active in Discover |
| GitHub public repository search | Official REST API                   | Optional token          | Active in Discover |
| 19 fixed HTTP routes            | Fixed HTTPS endpoints               | None                    | Active in Discover |
| Hugging Face                    | Models, datasets, daily-papers APIs | Optional token          | Active in Discover |
| ENTSO-E                         | Transparency Platform Web API       | Required security token | Deferred           |

## GitHub

Public discovery works without authentication. GitHub documents a general primary limit of 60
unauthenticated requests per hour and 5,000 authenticated requests per hour; search endpoints also
have their own rate-limit bucket. TheRSS already sends the required API media type, user agent, and
API version headers.

For a personal local installation:

1. Open GitHub **Settings → Developer settings → Personal access tokens → Fine-grained tokens**.
2. Create a short-expiry token named `TheRSS local discovery`.
3. Keep repository access and permissions at the minimum. Fine-grained tokens already include
   read-only access to public repositories; TheRSS does not need write, administration, webhook, or
   organization permissions for public repository search.
4. Start the development app without putting the token literal in shell history:

   ```zsh
   read -s "THERSS_GITHUB_TOKEN?GitHub token: "
   echo
   THERSS_GITHUB_TOKEN="$THERSS_GITHUB_TOKEN" npm run dev
   unset THERSS_GITHUB_TOKEN
   ```

5. For the packaged macOS app, place the value in the per-user launch environment, restart TheRSS,
   and clear the temporary shell variable:

   ```zsh
   read -s "SOURCE_TOKEN?GitHub token: "
   echo
   launchctl setenv THERSS_GITHUB_TOKEN "$SOURCE_TOKEN"
   unset SOURCE_TOKEN
   ```

   Remove it later with `launchctl unsetenv THERSS_GITHUB_TOKEN` and restart TheRSS.

The Electron main process reads `THERSS_GITHUB_TOKEN` on every Discover search. It is not returned
to the renderer or written to SQLite.

Official references: [GitHub token creation](https://docs.github.com/en/authentication/keeping-your-account-and-data-secure/managing-your-personal-access-tokens),
[REST API rate limits](https://docs.github.com/en/rest/using-the-rest-api/rate-limits-for-the-rest-api),
and [credential security](https://docs.github.com/en/rest/authentication/keeping-your-api-credentials-secure).

## ENTSO-E Transparency Platform

ENTSO-E access requires an account and administrator-enabled Web API access:

1. Register and verify an account on the
   [Transparency Platform](https://transparency.entsoe.eu/).
2. From the registered email address, send a request to `transparency@entsoe.eu` with
   `Restful API access` in the subject. Include the email address used for the platform account.
3. Wait for the helpdesk/administrator to enable API access.
4. Sign in and open the account settings. Generate or reveal the **Web API Security Token** only
   after access has been granted.
5. Store the token in a password manager. Do not put it in this repository, a URL, an issue, or a
   chat transcript.

The current TheRSS build does **not** consume an ENTSO-E token yet; `official:entsoe` intentionally
remains `adapter_required`. The planned main-process variable is `THERSS_ENTSOE_TOKEN`, but setting
it now will not activate ENTSO-E. The next implementation must add the fixed API host, query schema,
response-size bounds, rate handling, normalized energy-market records, and fixture tests first.

Official reference: [ENTSO-E API token management](https://transparency.entsoe.eu/content/static_content/download?path=%2FStatic+content%2FAPI-Token-Management.pdf).

## Hugging Face

TheRSS now retrieves three distinct public signals rather than treating the blog RSS as the whole
source:

- `/api/models`, sorted by `lastModified`;
- `/api/datasets`, sorted by `lastModified`;
- `/api/daily_papers`, with paper title, abstract, authors, and publication time.

Public reads work without a token. A token is optional for higher account rate limits and required
for gated or private resources. If one is supplied through `THERSS_HUGGINGFACE_TOKEN`, use a
dedicated fine-grained/read-only token; Electron main passes it only to the fixed Hugging Face
adapter and never returns or persists it. Never hardcode it.

Official references: [Hub API endpoints](https://huggingface.co/docs/hub/en/api),
[daily papers API](https://huggingface.co/docs/huggingface_hub/en/package_reference/hf_api#huggingface_hub.HfApi.list_daily_papers),
and [user access tokens](https://huggingface.co/docs/hub/en/security-tokens).

## Credential-free configured endpoints

The exact 19 retained HTTP endpoints live in
`src/core/sources/catalog/configuredSources.ts`. They were accepted because the 2026-08-19 audit
found a same-day dated item and retrievable content without an API key, token, login, or paid
service. ScienceNet uses its official HTTPS RSS endpoint. C114 uses bounded `gb18030` decoding of
its fixed HTTPS desktop home page, a fixed mobile fallback, and a source-specific plain-text
normalizer. NCPSD also retains its fixed mobile fallback; any transient failure must remain visible
rather than being silently treated as no posts.

Run all credential-free endpoints plus Hugging Face with:

```zsh
npm run smoke:configured-sources
```
