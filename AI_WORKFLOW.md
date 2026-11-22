# AI Workflow Log

This file tracks how AI (Claude Code) was used during development: the prompts given, what the AI produced, the decisions made, and the results. It feeds the "How I used AI" section of the [README](README.md).

## How to add an entry

Copy this template for each meaningful prompt or decision:

```markdown
### #N: <short title>
- **Date:** YYYY-MM-DD
- **Prompt:** what I asked (paraphrased or quoted)
- **AI output:** what it produced
- **Decision:** kept / changed / rejected, and why
- **Result:** outcome, files touched, follow-ups
```

---

## Log

### #1: Explore the starting repo
- **Date:** 2026-11-22
- **Prompt:** "What files are in this project and what does main.py do?"
- **AI output:** Listed the repo contents: `main.py`, the `README.md` template, `.gitignore`, and a `venv/` with FastAPI 0.128 and Uvicorn 0.39 on Python 3.9. Explained that `main.py` is a minimal FastAPI app with one `GET /health` endpoint returning `{"status": "ok"}`, and gave the run command.
- **Decision:** Kept as orientation. No changes made.
- **Result:** Confirmed the starting point is a bare FastAPI skeleton.

### #2: Organize requirements, propose a tech stack, and set up this log
- **Date:** 2026-11-22
- **Prompt:** "Clean up the README, organize the requirements into MVP and additional features, suggest a tech stack with reasons. Don't start coding yet. Create an AI_WORKFLOW.md to track our prompts, decisions, and results."
- **AI output:**
  - Rewrote `README.md`: a short overview, all five required areas from the brief as an MVP checklist, a prioritized table of 10 additional features, a tech stack table with a reason for each choice, and the original assessment sections kept as placeholders.
  - Proposed stack: FastAPI + SQLModel/SQLite (Postgres-ready), React + TypeScript + Vite, TipTap editor, sanitized HTML storage (`nh3`), `mammoth`/`markdown` for imports, seeded users with a mock login, pytest, and a single-service deployment on Render or Railway.
  - Flagged that the venv uses Python 3.9 (end-of-life) and recommended 3.11+.
  - Created this file.
- **Decision:** **Accepted.** Stack confirmed as FastAPI, SQLite, React, Vite, and TipTap.
- **Result:** `README.md` restructured, `AI_WORKFLOW.md` created. No application code written.

### #3: Build the basic app (backend, frontend, document creation, simple editor)
- **Date:** 2026-11-22
- **Prompt:** "Let's go with FastAPI, SQLite, React, Vite, and TipTap. Start building the basic application with a working frontend, backend, document creation, and a simple editor. Keep the code simple, test at every step that it runs locally, and update the AI workflow doc as we go."
- **AI output:**
  - **Backend** (`backend/`): a fresh Python 3.11 venv. FastAPI app with `GET/POST /api/documents` and `GET/PATCH /api/documents/{id}`. A SQLModel `Document` table in SQLite. Title validation (trimmed, not empty, at most 200 characters). Server-side HTML sanitizing with `nh3` and a tag allowlist. Returns 404 for missing documents.
  - **Tests:** 8 pytest tests on an in-memory database, covering create, save, and reopen with formatting preserved; rename; invalid titles (422); missing documents (404); and XSS stripping.
  - **Frontend** (`frontend/`): Vite + React + TypeScript with React Router.
    - Document list with a "+ New document" button.
    - Editor page with an editable title, a TipTap toolbar (B, I, U, H1–H3, bulleted and numbered lists), a Save button and Cmd/Ctrl+S, a "Saved / Unsaved / Saving / Save failed" indicator, and a warning before leaving with unsaved changes.
    - API error messages are shown in the UI.
  - **Verification at each step:**
    1. pytest.
    2. Live `curl` against uvicorn.
    3. `tsc` type-check, `oxlint`, and a production build.
    4. `curl` through the Vite proxy.
    5. A **headless Chrome end-to-end script** (playwright-core) that creates a document, types with every format, saves, reloads, checks the HTML, and checks the validation and 404 messages.
- **Problems found during testing (and fixed):**
  1. **Port conflict.** A Docker container from another project already used port 8000, and `localhost:8000` reached it instead of our server. Moved the backend to **port 8001** instead of touching the container.
  2. **Editor crashed when opened from the list** ("Cannot read properties of null (reading 'commands')"). React StrictMode mounts twice, which destroyed the TipTap instance, and the fetch callback then called `setContent` on the dead editor. **Fix:** fetch the document first, then mount the editor with its content (`key={doc.id}`). This is simpler and also prevents a stale-response race when switching documents.
  3. **Typing after clicking a toolbar button was lost.** The button took keyboard focus away from the editor. **Fix:** `onMouseDown={e => e.preventDefault()}` on toolbar buttons, so the editor keeps focus and the selection.
  4. A lint warning (setState called synchronously inside an effect) was fixed by deriving the "invalid id" state during render.
- **Decision:** Kept. Bugs 2 and 3 only appeared in the real-browser test, not in unit tests or type checks, which justified doing the end-to-end check.
- **Result:** The app runs locally (backend on :8001, frontend on :5173). All 8 backend tests pass, and the browser smoke test passes. Removed the old root `main.py` (its `/health` route now lives at `/api/health`) and the Vite template README. Expanded `.gitignore`.
- **Follow-ups:** Possibly add the browser smoke test to the repo as a Playwright test. Next features: file upload and the sharing model with seeded users.

### #4: Pre-push security review
- **Date:** 2026-11-22
- **Prompt:** "Before pushing to GitHub, review the project for exposed API keys, credentials, sensitive data, or any other security issues. Make sure .gitignore is configured and no secret keys are tracked in version history. Run the available tests, tell me if it's okay to push, and update the READMEs."
- **AI output / checks performed:**
  - **Git history:** no commits and no remotes yet, so there is nothing in history to scrub.
  - **What would be committed:** a dry run of `git add -A` showed 29 source/config files. `backend/.venv`, the old root `venv/`, `backend/app.db`, `node_modules/`, `dist/`, and the caches are all ignored.
  - **Secret scan** of those 29 files for API keys, tokens, passwords, private keys, and AWS/GitHub/OpenAI-style key patterns: no matches. The only hit was the word "Secrets" in a `.gitignore` comment. `package-lock.json` only references `registry.npmjs.org`, with no auth tokens.
  - **Personal data scan** (username, email, absolute local paths, private IPs): no matches.
  - **Dependency audits:** `npm audit` found 0 vulnerabilities. `pip-audit` on `requirements.txt` found no known vulnerabilities.
  - **Tests:** 9 pytest tests passed. `tsc`, `oxlint`, and the production build were clean. The headless Chrome end-to-end smoke test passed.
  - **Code review:** sanitized HTML storage, ORM-only queries, no CORS, no hardcoded credentials, and no stack traces in error responses: all OK.
- **Changes made:**
  1. **Content size limit** (about 1 MB, returns 422) on create and update, so one request can't store an arbitrarily large body. Added a test for it.
  2. **Hardened `.gitignore`:** added `.env.*` (allowing `.env.example`), `*.pem`, `*.key`, `*.p12`, `credentials*.json`, `*.sqlite*`, `*.log`, editor folders, and `.claude/settings.local.json`.
  3. Added a **Security notes** section and a **Configuration** note to the README.
- **Decision:** Safe to push. The one known gap is that there is **no authentication yet**, which is intentional at this stage and documented. It blocks a public deployment, not a push of the source code.
- **Result:** The repo is ready for its first commit and push.

### #5: Publish to GitHub
- **Date:** 2026-11-22
- **Prompt:** "Let's make it public and push it to my GitHub."
- **AI output:** Made the initial commit (29 files) and confirmed again that no env, database, venv, `node_modules`, or key files were tracked. `gh` wasn't installed, so I installed it with Homebrew. The user signed in with `gh auth login` in the VS Code terminal, because the `!` shortcut in the chat panel sent the text as a message instead of running it. Then I ran `gh repo create ajaia-assessment --public --source=. --push`.
- **Decision:** Public repo, default branch `main`.
- **Result:** https://github.com/koshtiakanksha/ajaia-assessment. `main` tracks `origin/main`.

### #6: Local test round 1 (frontend + backend)
- **Date:** 2026-11-22
- **Prompt:** "Let's test what we've built so far, both frontend and backend locally. Check for any errors, keep track of them, and give me the URL so I can test manually too."
- **AI output:**
  - Tested in layers:
    1. A fresh clone from GitHub, following the README.
    2. pytest.
    3. 25 live API edge-case checks with curl.
    4. Lint, type-check and build.
    5. A 21-check headless-Chrome suite, including a mobile viewport.
    6. A backend-down resilience test.
  - Created **TESTING.md** with the issue table (T1–T12) and a manual test checklist.
- **Issues found and fixed:**
  - Links and rules were silently deleted on save (sanitizer vs. StarterKit mismatch).
  - Unsaved edits were lost on in-app navigation. Fixed with the data router and `useBlocker`.
  - The Save button was off-screen on mobile.
  - A huge id caused a 500.
  - A no-op save bumped "last edited".
  - Long titles overflowed the list.
  - Offline errors were unfriendly.
  - Tests touched the real `app.db`.
  - Huge ids in the frontend URL showed a raw validation message.
- **Decision:** Fixed everything that was small and contained. For links, I **expanded the allowlist** (with safe URL schemes only) instead of disabling links in the editor, because links are useful in documents and nh3 already blocks `javascript:` URLs. Deferred one item: the httpx deprecation warning, which has no impact.
- **Note on testing approach:** a first run of the browser suite showed 15 failures that cascaded from one harness problem. My test auto-dismissed the "unsaved changes" prompt, so the page never navigated. After fixing the harness, the 4 remaining failures were real bugs.
- **Result:** 12/12 pytest, 21/21 browser checks, lint, types and build clean. Local database reset to empty for manual testing.

### #7: File import (.txt, .md, .docx → editable documents)
- **Date:** 2026-11-22
- **Prompt:** "Next step: file uploads. Add support for importing .txt, .md and .docx as editable documents. Make uploading simple, intuitive and consistent with the existing app. Test the complete flow, update the docs, don't start sharing yet, and push to GitHub."
- **AI output:**
  - First committed the round-1 test fixes separately, so the feature gets a clean commit.
  - **Backend:** `app/importers.py` handles conversion:
    - `.txt`: escaped text; blank lines become paragraphs and newlines become `<br>`. Falls back to cp1252 for non-UTF-8 files.
    - `.md`: the `markdown` library.
    - `.docx`: `mammoth`, after checking the zip signature.
    - Deeper headings become H3.
  - New endpoint `POST /api/documents/import` with an extension allowlist, a 5 MB limit (returns 413), and 400s with readable messages for unsupported, empty or corrupt files. Output goes through the same `nh3` sanitizer as normal saves. The title comes from the filename.
  - **Frontend:** an **⬆ Import file** button beside **+ New document**, drag-and-drop with a dashed overlay, and a visible hint with the supported types and limit. A client-side pre-check gives instant errors. On success it navigates to the new document, the same flow as "New document". Errors use the existing red error box.
  - **Tests:** 14 new pytest tests (real `.docx` generated with python-docx) and a 16-check browser suite for the full flow, including drag-and-drop and mobile.
- **Problem found:** `.docx` underline was silently dropped, because mammoth ignores underline by default. Fixed with `style_map="u => u"`; caught by the browser test against a real generated `.docx`.
- **Decisions:**
  - Import always creates a **new** document instead of merging into an existing one. It's the simplest model and matches the "New document" flow; importing into a draft is listed as a future option.
  - Uploaded files are **converted, not stored**. There's nothing extra to secure or clean up.
  - Validate on **both client and server**: the client for instant feedback, the server as the source of truth.
  - Used `mammoth` instead of `python-docx` for conversion, because it outputs clean semantic HTML directly. python-docx is used only to generate test fixtures.
- **Result:** 26/26 pytest, 16/16 import browser checks, 21/21 core regression checks, lint, types and build clean, 0 known vulnerabilities in the new dependencies.

### #8: Users and document sharing (Google Docs-style)
- **Date:** 2026-11-22
- **Prompt:** "Now users and document sharing. I want it to feel similar to Google Docs: share by email with multiple people, choose viewer or editor access, and revoke access. Use simulated login with a few seeded users for now, but design sharing so it isn't limited to them. Add My documents and Shared with me sections, enforce permissions on the backend, keep the UI clean and minimal, test everything, update the docs and push to GitHub."
- **AI output:**
  - **Data model:**
    - `User` (unique email).
    - `Document.owner_id`.
    - `DocumentShare(document_id, email, role)`, unique per document and email.
    - **Shares are keyed by email, not user id**, so you can share with people who have never signed in, and access appears on their first sign-in.
  - **Auth** (`app/auth.py`): simulated sign-in with any email (the user is created on first sign-in) and three seeded demo users. A signed session cookie (Starlette `SessionMiddleware`, `HttpOnly`, `SameSite=Lax`, optionally `Secure`). `SECRET_KEY` comes from the environment, with a random per-process fallback, so no secret is in the repo.
  - **Permissions** (`app/documents.py`): a single `load_document(..., need="view"|"edit"|"own")` helper returns 404, 403 with a specific message ("no access", "view-only", "only the owner can manage sharing"). Every endpoint uses it.
  - **Share API:** list, add many at once (normalized and deduplicated, max 20, re-sharing updates the role, can't share with yourself), change role, revoke. Share ids are scoped to their document.
  - **Seed data:** Alice's welcome doc (Bob is an editor, Carol a viewer) and Bob's notes (Alice is an editor), so every role can be demonstrated immediately.
  - **Frontend:**
    - `AuthGate` and a sign-in screen (demo accounts plus an email box).
    - A header user menu with **Sign out**.
    - **My documents** and **Shared with me** sections with owner avatars and **Can edit** / **View only** badges.
    - A role-aware editor (viewers get a read-only editor with no toolbar and a read-only title; non-owners see "Owned by …").
    - A **Share dialog**: email chips, typed or pasted, with known-user suggestions; a Viewer/Editor choice; a "People with access" list with role dropdowns and Remove; Esc or a click outside closes it.
    - Signing out with unsaved changes asks first.
  - **Tests:** 29 new pytest tests (55 in total). A 23-check multi-user browser suite with four isolated sessions. The earlier browser suites were updated to sign in first.
- **Problems found and fixed:**
  - A CSS class collision stretched the role badge to 60vh (`.badge.editor` picked up `.editor { min-height: 60vh }`). The automated checks passed; **I only caught it by reviewing the screenshots**. Renamed the classes and added a row-height layout check.
  - The share box could auto-chip a partial email. I caught this in self-review before testing, and fixed it by only chipping on a real suggestion pick.
  - The browser's native email validation replaced our styled error on sign-in.
- **Decisions:**
  - **Owner-only share management** (Google lets editors share by default). It's simpler to reason about and test, and easy to extend.
  - **403 vs. 404:** a missing document is 404 and an existing document without access is 403, so the UI can say "You don't have access" like Google Docs. That reveals that the id exists, which is acceptable for an internal tool.
  - **Login with any email** (not only seeded users), so "share with someone new, then they sign in" can actually be demonstrated.
  - Kept the session cookie approach (no JWT or localStorage), so there's no token handling in JavaScript and the cookie is `HttpOnly`.
- **Result:** 55/55 pytest; 23/23 sharing, 21/21 core and 16/16 import browser checks; lint, types and build clean; 0 known vulnerabilities.

### #9: Planning the remaining work
- **Date:** 2026-11-22
- **Prompt:** "What else is remaining to pass all the requirements and make it look similar to Google Docs (editing style, fonts, font size, tabs, alignment…)? And can you make the UI look closer to Ajaia, using the company colors?"
- **AI output:** Listed the remaining requirements (public deployment, architecture note, README write-up), a Docs-parity plan (menu bar, toolbar formatting, paper page, autosave, Docs-style header and home), and a sanitizer caveat: new inline styles would be stripped unless allowlisted. It looked up Ajaia's brand on **ajaia.ai**: navy `#001D6B`, deep blue `#1B3FA3`, sky `#97C2F8`, paper `#F1F7FF`, Inter. It asked whether "tabs" meant document tabs or the menu bar, which host to use, and whether to use the real logo.
- **Decision:** The user chose the **menu bar**, **Render**, and **Ajaia's actual logo**.

### #10: Docs-style UI, formatting, autosave, Ajaia brand, Render deployment
- **Date:** 2026-11-22
- **Prompt:** "Make the UI feel more like Google Docs (the menu bar works). Use Render for hosting, and use Ajaia's actual logo, text style and colors. Add autosave and other useful formatting features, complete the documentation, and push to GitHub."
- **AI output:**
  - **Sanitizer first** (to avoid repeating the "formatting silently stripped" bug from T1): allowed `style` with a CSS property allowlist (font-family, font-size, color, background-color, text-align, line-height), **value checks** (no `url(`, `expression(`, escapes or markup) and checklist attributes. 22 new tests.
  - **Editor:** TipTap add-ons for font family and size, color, highlight, alignment, checklists, word count and placeholder, plus a small custom extension for paragraph line spacing. A **toolbar** (undo/redo/print, style, font, −/size/+, B/I/U/S, color and highlight pickers, link, alignment, spacing, lists, indent, clear formatting) and a **menu bar** (File, Edit, View, Insert, Format) with shortcuts. A link bar, downloads (`.html`/`.txt`), and print CSS.
  - **Autosave** (`useAutosave`): 800 ms debounce, one save at a time, re-save if edits arrive mid-save, automatic retry when offline ("Offline. Retrying…"), and permanent errors shown. Leaving the page or signing out **saves first** and only asks if that fails. The Save button was removed; Cmd/Ctrl+S saves immediately.
  - **Docs layout and Ajaia brand:** the logo and "Docs" wordmark, the "A" icon as app icon and favicon, Inter, the brand palette, a paper page on a tinted canvas, a sticky header and toolbar, an avatar account menu, and a home page with "Start a new document" tiles plus document tables (Owner, Last modified).
  - **Deployment:**
    - FastAPI serves the built React app (SPA fallback); API docs moved to `/api/docs`.
    - **Postgres** support, because the Render free tier has no persistent disk for SQLite.
    - A request-size middleware.
    - A multi-stage **Dockerfile** (non-root user), and a **`render.yaml` Blueprint** (Docker web service + free Postgres, generated `SECRET_KEY`, `COOKIE_SECURE=1`).
    - Split `requirements.txt` (runtime) from `requirements-dev.txt` (tests).
  - **Production rehearsal:** built the Render image locally, ran it against Postgres 16, and ran all **69 browser checks** against it as well as against the dev servers.
  - **Docs:** a new `ARCHITECTURE.md`; the README rewritten for reviewers (screenshots, features, scope table, quick start, Render steps, API, and all six assessment sections filled in); TESTING.md round 4 (T23–T33) with a refreshed manual checklist; and a richer seeded welcome document that demonstrates the formatting.
- **Problems found and fixed:**
  - **Font-size focus race (T23).** Only the production build showed it: text typed after pressing Enter in the size box landed in the box. TipTap's `focus()` is deferred a frame; the fix is a synchronous `view.focus()`.
  - The font size showed "11" in headings, and the title box was a fixed width (both from screenshot review).
  - nh3 style re-serialization (`Georgia , serif`).
  - Lint issues in the autosave retry and ref usage.
  - SQLite on Render would lose data, so I switched to Postgres.
  - `/docs` (Swagger) collided with the app's `/docs/:id` routes.
- **Decisions:** see D23–D28 below.
- **Result:** 77/77 pytest; browser checks 10/10 core, 20/20 editor, 16/16 import and 23/23 sharing on **both** dev and Docker+Postgres; lint, types and build clean; 0 known vulnerabilities. The Render deploy itself needs the user's Render account (Blueprint → Apply), and the live URL goes into the README afterwards.

---

## Key decisions (running summary)

| # | Decision | Rationale | Status |
|---|----------|-----------|--------|
| D1 | MVP = all five required areas from the brief, at the simplest version of each that works well | Everything in the brief is required, so the stretch work goes into "additional features" | Accepted |
| D2 | "Collaboration" in the MVP = shared access, not real-time co-editing | Real-time editing (CRDTs, WebSockets) is high-risk within a timebox. TipTap keeps the upgrade path open | Accepted |
| D3 | Store document content as server-sanitized HTML | Preserves formatting, works for all import formats, and prevents XSS | Implemented |
| D4 | Simulated auth with seeded users | Allowed by the brief, and keeps the focus on ownership and sharing logic | Implemented |
| D5 | A single deployable service (FastAPI serves the React build) | One URL and no CORS setup in production, which makes deployment simpler | Implemented |
| D6 | Stack: FastAPI + SQLModel/SQLite, React + TypeScript + Vite, TipTap | Confirmed by the user in #3 | Implemented |
| D7 | Backend runs on port 8001 in development; Vite forwards `/api` to it | Port 8000 is used by another local project | Implemented |
| D8 | Explicit Save (button and Cmd/Ctrl+S) for now; autosave later | Simplest reliable behavior first. Autosave is additional feature #1 | Implemented |
| D9 | Load the document before mounting the TipTap editor | Avoids StrictMode and stale-response bugs, and is simpler than calling `setContent` after mount | Implemented |
| D10 | Limit document content to about 1 MB | Cheap protection against oversized requests | Implemented |
| D11 | No secrets in the repo: config via env vars, `.env*` ignored | Safe to publish the repo; ready for deployment config later | Implemented |
| D12 | Sanitizer allows `<a href>` (http, https, mailto only) and `<hr>` | Match what the editor can produce, so formatting is never silently lost | Implemented |
| D13 | Use React Router's data router (`createBrowserRouter`) with `useBlocker` | Needed to warn before in-app navigation discards unsaved edits | Implemented |
| D14 | Only bump `updated_at` on real changes | Keeps "last edited" and list order truthful | Implemented |
| D15 | Import creates a new document (`.txt`, `.md`, `.docx`, 5 MB max); files are converted, not stored | Simplest model, consistent with "New document", with no file storage to secure | Implemented |
| D16 | `.docx` conversion with mammoth (underline enabled); headings deeper than H3 become H3 | Clean semantic HTML that matches what the editor supports | Implemented |
| D17 | Validate uploads on both client and server | Instant feedback in the UI; the server stays the source of truth | Implemented |
| D18 | Shares are keyed by **email**, not user id | Share with anyone, even people who have never signed in; access appears on first sign-in | Implemented |
| D19 | Roles: owner > editor > viewer; only the owner manages sharing | Clear, testable model; editor sharing can be added later | Implemented |
| D20 | One permission helper (`load_document(need=…)`) used by every endpoint | One place to get authorization right; specific 403 messages | Implemented |
| D21 | Signed `HttpOnly` session cookie; `SECRET_KEY` from the environment | No tokens in JavaScript, no secrets in the repo, basic CSRF protection via SameSite=Lax | Implemented |
| D22 | Missing doc → 404, no access → 403 | Lets the UI show "You don't have access", like Google Docs | Implemented |
| D23 | Inline styles allowed through a CSS **property allowlist with value checks** | Fonts, colors, alignment and spacing must round-trip without opening CSS injection | Implemented |
| D24 | **Autosave** replaces the Save button; leaving or signing out saves first | Docs behavior; the only prompt is when saving actually fails | Implemented |
| D25 | Menu bar (File, Edit, View, Insert, Format) instead of document tabs | The user's choice; mostly UI, no schema change | Implemented |
| D26 | Ajaia brand: real logo and icon, Inter, navy/sky palette from ajaia.ai | The user asked for the company look; Docs layout, Ajaia skin | Implemented |
| D27 | Render: Docker web service + **Postgres** via a `render.yaml` Blueprint | The free tier has no persistent disk (SQLite would reset); one-click deploy | Implemented (deploy pending the user's Render account) |
| D28 | FastAPI serves the built UI with an SPA fallback; API docs at `/api/docs` | One service and URL, no CORS; avoids the `/docs` route clash | Implemented |
