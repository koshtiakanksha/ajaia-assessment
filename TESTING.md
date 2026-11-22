# Testing Log

This file tracks how the app is tested, which issues were found, and their status. It's updated each testing round.

## How to run the automated checks

```bash
# Backend: 77 API tests (documents, import, auth and sharing, sanitizer, app/SPA serving; in-memory DB)
cd backend && source .venv/bin/activate && pytest

# Frontend: lint + type-check + production build
cd frontend && npm run lint && npm run build
```

**Browser end-to-end suites** (headless Chrome via playwright-core, run against a running app):

| Suite | Checks | Covers |
|---|---|---|
| core | 10 | XSS titles, stored style injection, bad routes, back/forward, double-click create, long titles |
| editor | 20 | Docs header and menus, **autosave** (including offline recovery), every toolbar format round trip, menus, word count, downloads, print layout, save on navigate and on sign-out, viewer restrictions, mobile |
| import | 16 | `.txt`, `.md` and `.docx` import, drag-and-drop, client and server rejections, mobile |
| sharing | 23 | Four simultaneous users: share, roles, revoke, newcomer by email, enforcement, sign-out, mobile |

Each suite was run against **both** the dev servers (`localhost:5173`) **and** the production Docker image with Postgres (`BASE=http://localhost:8080`). These scripts aren't in the repo yet; moving them into a Playwright suite in CI is a listed next step.

---

## Live deployment check: 2026-11-22 (https://ajaia-docs-e26f.onrender.com)

Run against the deployed Render service (Docker + Render Postgres). **The demo accounts were only read**, so reviewers see clean seed data. Writes used a throwaway `qa-check@example.com` account, whose documents only it can see.

| Check | Result |
|---|---|
| `/api/health`, `/`, `/docs/1` (SPA route), brand assets, `/api/docs`; unknown `/api/*` → JSON 404 | ✅ |
| `http://` → `https://` redirect (301) | ✅ |
| Seed data: 3 demo users; Alice, Bob and Carol each see the right documents and roles | ✅ |
| Session cookie is `Secure; HttpOnly; SameSite=Lax` | ✅ |
| Anonymous → 401; viewer edit → 403; editor managing shares → 403; no access → 403 | ✅ |
| Real 6 MB upload → 413 "upload limit is 5 MB", and no document created | ✅ |
| Browser: sign-in page, Alice's home, editor, menus, Share dialog (read-only) | ✅ |
| Browser: Carol's viewer mode (no toolbar, read-only page, Format items disabled) | ✅ |
| Browser (QA account): create, **autosave**, reload persists; Georgia, 18pt, color, center, checklist round-trip; `.md` import; 403 on another user's doc | ✅ |
| Mobile 390px: home and editor, no horizontal scroll | ✅ |

**Note:** a first probe of the size limit returned 400. It claimed 9 MB but sent 1 byte, and Render's proxy rejected the mismatched length before the app saw it. A real 6 MB upload correctly returned 413, so this wasn't an app issue.

---

## Round 4: 2026-11-22 (Docs-style UI, formatting, autosave, Ajaia brand, deployment)

### What was tested

| Layer | What | Result |
|---|---|---|
| Backend unit | 22 new tests: **sanitizer** (each new format survives: alignment, font family and size, color, highlight, line height, checklists; unsafe CSS stripped: `position`, `url(javascript:…)`, `expression()`, CSS escapes, `behavior`, markup in values; bad `data-*` and `input` attributes), **app** (request size limit before the body is read, API docs moved to `/api/docs`, SPA fallback for client routes without swallowing unknown `/api` paths, Postgres URL normalization) | ✅ **77/77** in total |
| Browser E2E (editor) | 20 checks: Docs header (no Save button), **autosave** status and persistence, rename with empty-title revert, **22 formats round-tripped through autosave and reload**, toolbar state at the cursor (font, size, heading size, alignment), clear formatting, undo/redo, the menu bar (Format → Bold, Insert → HR, Edit → Undo, hover switching, Esc), word count, `.txt`/`.html` downloads, print CSS, **save-then-leave with no prompt**, **backend killed mid-edit → "Offline. Retrying…" → automatic recovery**, **save on sign-out**, viewer menus disabled, heading-aware font size, mobile | ✅ **20/20** |
| Regression | Updated core (10), import (16) and sharing (23) suites for the new UI (Blank document tile, account menu, autosave instead of the Save button) | ✅ 10/10, 16/16, 23/23 (sharing run twice in a row for stability) |
| **Production rehearsal** | Built the **Render Docker image**, ran it against **Postgres 16** with `COOKIE_SECURE=1`: health, SPA routes, brand assets, seeding into Postgres, and a `Secure; HttpOnly; SameSite=Lax` cookie. Then ran **all 69 browser checks against the container** | ✅ 69/69 (after fix T23) |
| Visual | Screenshots of sign-in, home, editor, menus, formatted doc, share dialog, viewer, and mobile editor and home, reviewed by eye | ✅ after T24 and T25 |
| Audits | `npm audit` and `pip-audit` including the new packages (TipTap extensions, lucide-react, Inter, psycopg) | ✅ 0 known vulnerabilities |

### Issues found

| # | Severity | Issue | How found | Fix | Status |
|---|---|---|---|---|---|
| T23 | 🟠 Medium | **Text typed right after entering a font size went into the size box, not the document**, and only in the **production build**. TipTap's `focus()` waits a frame, and the optimized build let keystrokes arrive first. | Browser suite against the **Docker image** (it passed against the dev server) | Toolbar actions now call `editor.view.focus()` synchronously; Enter and Escape in the size box return focus at once | ✅ Fixed |
| T24 | 🟡 Low | The font size showed "11" inside headings (which are 20, 16 or 13pt), unlike Docs. | Screenshot review | The size shown and the +/− steps follow the paragraph style's default size | ✅ Fixed (test added) |
| T25 | 🟡 Low | The title box was a fixed width, leaving a gap before "All changes saved". | Screenshot review | The title sizes itself to its text, like Docs | ✅ Fixed |
| T26 | 🟡 Low | nh3 rewrites styles (`text-align:center`, `Georgia , serif`); the stray space before commas would stop the font dropdown recognizing the font. | Sanitizer unit tests | Normalize after cleaning; tests compare the compact form | ✅ Fixed |
| T27 | 🟡 Low | **New formatting would have been stripped on save.** The old sanitizer removed all `style` attributes, so fonts, colors, alignment and line spacing would vanish on reload, the same class of bug as T1. | Designed in before building the UI (sanitizer first) | CSS property allowlist with value checks, plus checklist attributes | ✅ Prevented |
| T28 | 🟡 Low | With autosave, the old "Leave / Sign out without saving?" prompts would have appeared needlessly. | Design review | Leaving and signing out **save first**, and only ask if saving fails (tested both ways, including offline) | ✅ Fixed |
| T29 | 🟡 Low | Lint: autosave's retry referenced `flush` during its own initialization; refs passed to a render-time helper. | `oxlint` | A ref for the recursive retry; the menu builder became a hook | ✅ Fixed |
| T30 | 🟠 Medium | **Render free instances have no persistent disk**, so SQLite data would be wiped on every deploy or restart. | Deployment research | Added Postgres (psycopg 3, URL normalization, `pool_pre_ping`); Render Blueprint provisions the database | ✅ Fixed |
| T31 | 🟡 Low | FastAPI's Swagger UI at `/docs` collided with the app's `/docs/:id` document URLs once FastAPI serves the UI. | Code review while adding SPA serving | Moved API docs to `/api/docs` and `/api/openapi.json` | ✅ Fixed |
| T32 | ⚪ Info | Closes **T15**: oversized uploads were only rejected after being received. | — | Middleware rejects requests over 5.5 MB by `Content-Length` before the body is read (test added) | ✅ Fixed |
| T33 | ⚪ Info | Test-only fixes: ambiguous labels ("Font" also matched "Decrease font size"), demo users counted before loading, navigation before sign-in finished, and a badge-order assumption. | Browser suites | Exact selectors and explicit waits | ✅ Fixed (tests only) |

### Manual checks for round 4
1. Open **Welcome to Ajaia Docs**. Change the font, size, color and highlight, align a paragraph, add a checklist. "Saving…" turns into "All changes saved". Refresh, and everything is still there.
2. Try **File → Download as plain text**, **View → Word count** and **Insert → Horizontal line**.
3. Stop the backend, type something, and see "Offline. Retrying…". Start it again and the status returns to "All changes saved" by itself.
4. Sign in as **Carol** (viewer). There's no toolbar, and the Format menu items are greyed out.

---

## Round 3: 2026-11-22 (users and sharing)

### What was tested

| Layer | What | Result |
|---|---|---|
| Backend unit | 29 new tests in `tests/test_auth_sharing.py`: 401 on every protected endpoint; login email normalization, invalid emails, logout, a **tampered session cookie**; ownership of created and imported docs; owned vs. shared listing; **no access → 403**; **viewer can read, not edit**; **editor can edit, not manage shares**; sharing with multiple emails (deduplicated and normalized); **sharing with an email that has never signed in**, then that person signs in and sees the doc; re-sharing updates the role; role changes and revokes take effect immediately; sharing with yourself → 400; invalid share requests (empty, bad email, role `owner` or `admin`, more than 20 emails) → 422; share ids scoped to their document; seed data is idempotent | ✅ **55/55** in total |
| Live API | curl with separate cookie jars for Alice, Bob and Carol: each sees the right docs and roles; a viewer's PATCH and an editor's share management return 403; the cookie is `HttpOnly` and `SameSite=Lax` | ✅ |
| Browser E2E (sharing) | 23 checks across **four isolated browser sessions** (Alice, Bob, Carol, and a newcomer): the sign-in screen and deep-link redirect; one-click demo sign-in; email validation; My documents / Shared with me with owner and role badges; the share dialog (invalid email, multiple emails typed and pasted, role choice, change role, share with yourself, Esc to close); the editor can edit and sees the owner's label; the owner sees the editor's changes; the viewer gets a read-only editor with no toolbar, a read-only title, and no request on Cmd+S; **a forced API edit by the viewer → 403**; the newcomer signs in and sees the doc, and their name then appears in the owner's dialog; **revoking while the editor has the doc open** (the save fails clearly, then there's no access, and the doc disappears from their list); a direct URL with no access; sign-out with unsaved changes asks first; switching accounts; a cleared session returns to sign-in; mobile layout; compact list rows | ✅ **23/23** after fixes |
| Regression | Round 1 core suite (21) and Round 2 import suite (16), updated to sign in first; lint, types, build; `npm audit` and `pip-audit` | ✅ 21/21, 16/16, no vulnerabilities |
| Visual | Screenshots of sign-in, the list, the share dialog, the viewer mode, and the mobile dialog were reviewed by eye | ✅ after fix T17 |

### Issues found

| # | Severity | Issue | How found | Fix | Status |
|---|---|---|---|---|---|
| T17 | 🟠 Medium | **The "Can edit" badge was stretched to about 60% of the screen height** in "Shared with me". The badge class `editor` collided with the editor panel's `.editor { min-height: 60vh }`. | **Screenshot review**; the automated checks passed | Renamed to `badge-editor` and `badge-viewer`. Added a layout check that every list row stays under 100px tall. | ✅ Fixed |
| T18 | 🟡 Low | **The share box could cut off emails early.** The first version turned text into a chip as soon as it exactly matched a known user, so typing `bob@example.com.au` would stop at `bob@example.com`. | Self code review, before testing | Only a real suggestion pick (an `insertReplacementText` input event) or a separator creates a chip. A browser test covers it. | ✅ Fixed |
| T19 | 🟡 Low | The sign-in form showed the browser's native email tooltip instead of the app's styled error. | Browser E2E | `noValidate` on the form, so the app's own validation message is used. | ✅ Fixed |
| T20 | ⚪ Info | First runs of the sharing suite had test-only failures: an ambiguous selector ("Access for carol" also matched "Remove access for carol"), which made two later checks fail too; data left over between runs; and reading the people list before it loaded. | Browser E2E | Exact selectors, unique emails per run, and waiting for data. | ✅ Fixed (tests only) |
| T21 | ⚪ Info | Without `SECRET_KEY`, the server uses a random key, so everyone is signed out on restart, including on `--reload` during development. | By design | Documented. Set `SECRET_KEY` in any shared or deployed environment. | 📝 Documented |
| T22 | ⚪ Info | Sign-in is simulated (no password), so anyone can act as any email. | By design (allowed by the brief) | Documented in the README security notes. Real auth would replace only `app/auth.py`. | 📝 Known limitation |

### Manual checks for sharing
1. Sign in as **Alice** and open **Welcome to Ajaia Docs**. Click **Share**: Bob is an Editor and Carol a Viewer.
2. Type `dana@example.com`, press Enter, choose **Editor**, and click **Share**. Dana appears with "Hasn't signed in yet".
3. **Sign out** (top right), then sign in as `dana@example.com` using the email box. The doc is under **Shared with me** with "Can edit", and you can edit it.
4. Sign in as **Carol** and open the same doc. You see "View only", there's no toolbar, and typing does nothing.
5. As Alice, change Carol to **Editor**. Carol can now edit after a refresh.
6. As Alice, click **Remove** next to Bob. Bob gets "You don't have access to this document", and the doc disappears from his list.

---

## Round 2: 2026-11-22 (file import: .txt, .md, .docx)

### What was tested

| Layer | What | Result |
|---|---|---|
| Backend unit | 14 new tests in `tests/test_import.py`: each file type converts correctly (a real `.docx` is generated with python-docx), the document is editable afterwards, non-UTF-8 text, case-insensitive extensions, unsupported types (`.png`, `.js`, `.doc`, no extension), empty file, fake and corrupt `.docx`, over 5 MB, missing file field, and no document left behind after a failed import | ✅ **26/26** in total |
| Live API | curl: `.txt` and `.md` return 201, `.pdf` returns 400 with a message, a 6 MB file returns 413 | ✅ |
| Browser E2E (import) | 16 checks: UI hint and `accept` filter; `.docx`, `.md` and `.txt` import and open in the editor with formatting and a title from the filename; edit, save and reload an imported doc; toolbar state on imported formatting; docs appear in the list; client-side rejection of `.pdf`, empty and >5 MB files (and no request is sent); server-side rejection of a corrupt `.docx`; re-selecting the same file after an error; drag-and-drop (overlay, import, multiple files, unsupported type); mobile layout | ✅ **16/16** after the fix |
| Regression | Round 1's 21-check core browser suite, lint, types, build, `npm audit`, `pip-audit` (including the new dependencies) | ✅ 21/21, no vulnerabilities |
| Resilience | Import while the backend is down | ✅ "Can't reach the server" message, and the button is re-enabled |

### Issues found

| # | Severity | Issue | How found | Fix | Status |
|---|---|---|---|---|---|
| T13 | 🟠 Medium | **Underline dropped from `.docx` imports.** mammoth ignores underline by default, because underline isn't semantic formatting. | Browser E2E with a generated `.docx` | Added `style_map="u => u"`. The backend test now covers underline. | ✅ Fixed |
| T14 | ⚪ Info | One core browser check depended on data left over from round 1, so it failed after a database reset. | Regression run | The check now creates its own data. | ✅ Fixed (test only) |
| T15 | ⚪ Info | FastAPI and python-multipart receive the whole upload before the endpoint can reject it for size, so the 5 MB check runs after the upload is received. | Code review | Fixed in round 4 (T32): oversized requests are rejected before the body is read. | ✅ Fixed |
| T16 | ⚪ Info | `.docx` images and tables aren't imported (only table text is kept), and `.doc` and PDF aren't supported. | By design | Documented in the README and the UI. | 📝 Known limitation |

### Manual checks for import
1. On **My documents**, click **⬆ Import file** and pick a `.docx` file. It opens in the editor with headings, bold, italic, underline and lists.
2. Drag a `.md` file onto the page. A blue dashed overlay appears; drop it and the document opens.
3. Try a `.pdf` or an image. You see a red message listing the supported types, and nothing is created.
4. Edit an imported document, press Cmd/Ctrl+S, and refresh. The changes are kept.

---

## Round 1: 2026-11-22 (local, frontend + backend)

### What was tested

| Layer | What | Result |
|---|---|---|
| Setup | Fresh `git clone` from GitHub, following the README exactly (venv, `pip install`, `npm install`, tests, build) | ✅ Works |
| Backend unit | pytest | ✅ 9 → **12** passing (3 tests added for the fixes below) |
| API edge cases | 25 live `curl` checks: malformed JSON, missing body, wrong types, null, 200/201-char titles, unicode/emoji, XSS payloads (script, onclick, `javascript:`, iframe, style), empty PATCH, unknown fields, bad, negative, zero and huge ids, wrong HTTP methods, unknown routes, CORS from a foreign origin | ✅ after fixes |
| Frontend static | `tsc`, `oxlint`, `vite build`, `npm audit`, `pip-audit` | ✅ Clean |
| Browser E2E | 21 checks: list, create, all formatting round-trips, toolbar state, shortcuts and undo, extra StarterKit formats, rename, validation errors, unsaved-changes guard (link and Back button), back/forward, deep-link refresh, 5 bad routes, double-click create, long titles, mobile 390px | ✅ **21/21** after fixes |
| Resilience | Stop the backend mid-edit: save, list, then restart and retry | ✅ No data loss, friendly message |

### Issues found

| # | Severity | Issue | How found | Fix | Status |
|---|---|---|---|---|---|
| T1 | 🔴 High | **Links and horizontal rules silently deleted on save.** TipTap v3's StarterKit lets users create links (auto-linked URLs) and `---` rules, but the sanitizer allowlist stripped `<a>` and `<hr>`. | Browser: save, reload, compare | Allowed `a[href]` (http, https and mailto only; nh3 adds `rel="noopener noreferrer"`) and `hr`. `javascript:` URLs are still stripped. Test added. | ✅ Fixed |
| T2 | 🔴 High | **Unsaved edits lost without warning** when clicking "← Documents", the header logo, or the browser Back button. Only tab close or reload was guarded. | Browser | Switched to React Router's data router and `useBlocker`, which shows a "Leave without saving?" confirm for in-app navigation. | ✅ Fixed |
| T3 | 🟠 Medium | **Save button pushed off-screen on mobile** (390px). The editor header didn't wrap. | Browser screenshot | Header wraps, the title input can shrink, plus small-screen padding. | ✅ Fixed |
| T4 | 🟠 Medium | **Huge document id → 500 Internal Server Error** (`/api/documents/99999999999999999999999` overflowed SQLite's integer). | curl | Out-of-range ids return 404. Test added. | ✅ Fixed |
| T5 | 🟡 Low | The same huge id in the browser URL showed a raw validation message. | Browser | The frontend validates with `Number.isSafeInteger`, so it shows "Invalid document id". | ✅ Fixed |
| T6 | 🟡 Low | **Empty or no-op saves bumped "last edited"**, which reordered the document list even though nothing changed. | curl | `updated_at` only changes when the title or content actually changes. Test added. | ✅ Fixed |
| T7 | 🟡 Low | Long unbroken titles (200 chars) overflowed the list on mobile. | Browser | `overflow-wrap: anywhere`, and the list stacks on small screens. | ✅ Fixed |
| T8 | 🟡 Low | Backend unreachable showed "Request failed (502)". | Backend stopped mid-session | Shows "Can't reach the server. Check that it's running and try again." The edit stays in the editor, and retry works. | ✅ Fixed |
| T9 | 🟡 Low | Running `pytest` created or touched the real `backend/app.db`, because app startup ran `create_all` on it. | Fresh clone | `tests/conftest.py` sets `DATABASE_URL=sqlite://` before the app is imported. | ✅ Fixed |
| T10 | ⚪ Info | pytest shows a `StarletteDeprecationWarning` (Starlette's TestClient wants `httpx2`). | pytest | No impact; revisit when upgrading dependencies. | 📝 Tracked |
| T11 | ⚪ Info | The trailing space at the end of a paragraph isn't kept after reload. | Browser | Expected: the editor normalizes whitespace when it loads HTML. All formatting is preserved. | ✅ Not a bug |
| T12 | ⚪ Info | Titles containing HTML (for example `<img onerror=…>`) are stored as typed. | curl | Safe: React shows them as text, and the browser test confirmed no script runs. | ✅ Not a bug |

### Checked and fine (no issues)
- Malformed or missing JSON, wrong types and null titles return a `422` with a clear message.
- XSS in content: `<script>`, `on*` attributes, `<iframe>`, `<style>` and `javascript:` links are all stripped.
- No CORS headers are sent to foreign origins (same-origin only).
- Unknown routes return 404 and wrong methods return 405. The API never returns stack traces.
- Unicode and emoji in titles and content work.
- Double-clicking "New document" creates exactly one document.
- Cmd/Ctrl+B, I, U, Z and S all work. Toolbar buttons highlight correctly for the cursor position.

---

## Manual test checklist

Open the app (locally **http://localhost:5173**, or the Render URL) and sign in as **Alice Johnson**.

1. **Create:** click **Blank document**. The editor opens with the title "Untitled document".
2. **Autosave and rename:** type something and rename the title. "Saving…" turns into "All changes saved". Refresh, and everything is kept.
3. **Format:** try the paragraph style, font, size (−/+ or type a number), bold, italic, underline, strikethrough, text color, highlight, alignment, line spacing, lists, checklist and link (⌘/Ctrl+K). Toolbar buttons light up to match the text at the cursor.
4. **Menus:** File (download, print), Edit (undo/redo), View (word count), Insert (horizontal line, quote), Format (styles, alignment, clear formatting).
5. **Import:** on the home page, drag a `.docx` or `.md` file onto the page. It opens as a new document with its formatting.
6. **Share:** in "Welcome to Ajaia Docs", click **Share**, add `dana@example.com` as an Editor, then sign in as Dana (avatar menu → Sign out → type the email). The document is under **Shared with me**, and Dana can edit it.
7. **Viewer:** sign in as **Carol**. "Welcome to Ajaia Docs" is view-only: no toolbar, and editing menus are greyed out.
8. **Revoke:** as Alice, click **Remove** next to Bob. Bob's next save shows "You don't have access to this document".
9. **Errors:** visit `/docs/99999` ("Document not found"), or try importing a `.pdf` (a clear error listing the supported types).
10. **Mobile:** at a phone width (dev tools), the toolbar wraps and nothing scrolls sideways.

---

## Follow-ups
- Add the browser E2E checks to the repo as a Playwright suite (`frontend/e2e/`) and run them in CI against the Docker image.
- Add Alembic migrations before the next schema change.
