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

---

## Key decisions (running summary)

| # | Decision | Rationale | Status |
|---|----------|-----------|--------|
| D1 | MVP = all five required areas from the brief, at the simplest version of each that works well | Everything in the brief is required, so the stretch work goes into "additional features" | Accepted |
| D2 | "Collaboration" in the MVP = shared access, not real-time co-editing | Real-time editing (CRDTs, WebSockets) is high-risk within a timebox. TipTap keeps the upgrade path open | Accepted |
| D3 | Store document content as server-sanitized HTML | Preserves formatting, works for all import formats, and prevents XSS | Implemented |
| D4 | Simulated auth with seeded users | Allowed by the brief, and keeps the focus on ownership and sharing logic | Accepted (not built yet) |
| D5 | A single deployable service (FastAPI serves the React build) | One URL and no CORS setup in production, which makes deployment simpler | Accepted (deployment pending) |
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
