# Change Contract: Share and drag research out

Scope authority: on 2026-10-05 the user asked "继续做 P2 系统集成" (audit section P2 in the
[UX audit](../2026-09-23-apple-native-ux/REPORT.md)). This slice covers Share and dragging rows
out. Opening a record in its own window and animated split transitions are deferred (separate
window lifecycle and motion scope); Quick Look of remote URLs stays rejected (remote HTML).

## Feature Intake

- User outcome: a result can go to Zotero, Obsidian, Mail, Messages or Notes the macOS way:
  drag the row out, use Share in its context menu, or the Share button in the reading actions.
- Current behaviour (code, 2026-10-05): the context menu offers Open in Browser and Copy
  Link/Title/Citation; rows cannot be dragged; there is no Share.
- Product fit: PRODUCT.md positions TheRSS beside Zotero and Obsidian, not replacing them; the
  shared data is the public `https:` link, the title and the existing discovery-metadata citation
  (`buildCopyPayload` copy-citation), not a verified bibliographic record. Nothing leaves the
  Mac until the user picks a destination; no network request is made by TheRSS.
- Alternatives: copy-only (status quo); app-specific integrations (rejected: credentials and
  third-party APIs).
- Boundary changes: row field `drag` (`url` https-only, `title`, `text` bounded) and button field
  `share` (`url` https-only) in the typed presentation contract; context-menu entry type `share`
  rendered as Electron's macOS `shareMenu` role. No IPC channel, SQLite, network or package
  change.
- Kill criterion: stop if a non-`https:` URL could reach the pasteboard or a sharing service.

## Capability Contract

- S1: `buildCitation` (extracted from `buildCopyPayload`, same text) is reused for drags.
- S2: the context menu adds "Share" (macOS share submenu with the link and title) after Copy Link,
  only for `https:` links.
- S3: Discover and Saved rows with an `https:` link carry `drag`; the native table writes
  `public.url`, `public.url-name` (title) and plain text (citation) for a copy drag to other apps;
  finishing a drag does not also open the row.
- S4: the reading actions add "Share" (`square.and.arrow.up`) for `https:` links; it opens the
  system sharing picker with the link, anchored to the button, and emits no scene event.
  Fixtures record the requested items instead of opening system UI.
- Non-goals: record windows, transitions, local-search/analytics rows, Web fallback buttons.
- Allowed scope: `src/core/menus/contextMenu.ts` and test, `src/main/windowApplicationRuntime.ts`
  and test, `src/main/appkit/{presentation,researchMetadata,discover,saved,reading}.ts` and tests,
  `native/appkit/{node,bridge}.mm`, `native/appkit/ui.h`, AppKit smoke scripts, this directory,
  the UX audit report.

## Frozen Acceptance Contract

- RED (unit): context menu has a `share` entry after Copy Link for https and none otherwise; the
  runtime maps it to `role: 'shareMenu'` with the link; schema accepts https `drag`/`share` and
  rejects `http:`, `javascript:` and `file:`; Discover/Saved rows carry `drag` with the citation;
  the reader shows Share only for https links.
- RED (native): controls smoke: a research table row writes the three pasteboard types with the
  given values and allows copy drags outside the app; a row without `drag` writes nothing; a
  Share button records the URL without emitting.
- Full verifier: `npm run check`; controls smoke; workflow smoke 14/14 with and without
  screenshots, with Discover rows exposing an https drag and the reading Share button.
- Stop condition: S1-S4 verified; no existing assertion weakened.

### Acceptance-change log

| Date | Contract change | Evidence/reason | Reviewer |
| ---- | --------------- | --------------- | -------- |

No existing assertion changed.

## Verification (2026-10-05)

- Unit RED: no `share` menu entry or `buildCitation`; the runtime menu had no `shareMenu` role;
  the schema rejected `drag`/`share`; rows and the reader had no drag or Share. GREEN after the
  change (`contextMenu.test.ts`, `windowApplicationRuntime.test.ts`, new `shareDrag.test.ts`).
- Controls smoke RED on the pre-change native binary (no drag item); GREEN 17/17 groups
  (behaviour-only): pasteboard `public.url`, `public.url-name` and plain-text citation for a row
  with a link, nothing for a row without one, copy drags allowed outside the app, Share records
  the https link without a scene event.
- Workflow smoke: without screenshots 14/14 (Discover rows drag an https link whose text starts
  with the title; the reading Share button hands an https link to the picker); with screenshots
  all 14 behaviour groups passed and 35 images were captured; the run failed only on the known
  off-Space captures of windows with a sheet or popover (`onActiveSpace: false`).
- `npm run check`: exit 0; 724 main and 131 AppKit tests; coverage at or above 80% on all axes.
- Independent diff review (fresh-context reviewer, static): no blocker on the data-out boundary.
  1. Medium: the "a finished drag does not open the row" flag was set only when the drag
     session ended, which may run after `mouseDown` returns. Fixed: the flag is also set when the
     table asks for the pasteboard writer (synchronously at drag start) and at session start.
     Not covered by an automated real mouse drag (residual risk).
  2. Low: long feed titles plus long URLs could exceed the drag text bound and make the scene
     schema reject the whole screen. Fixed: the drag title is capped at 1000 characters and links
     over 2048 characters get no drag or Share (new unit test).
  3. Low: uppercase `HTTPS:` links lost drag/Share natively (fail-closed). Fixed: the native
     scheme check ignores case.
- After the review fixes: controls smoke 17/17; workflow smoke without screenshots 14/14;
  `npm run check` exit 0 (725 main, 132 AppKit tests).
- Not run: a real drag into Zotero/Obsidian/Mail and the real sharing picker (system UI; fixtures
  record the request instead), package/install smoke, VoiceOver speech.
