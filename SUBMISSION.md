# Submission: Ajaia Docs (Lightweight Collaborative Document Editor)

## Deliverables

| Deliverable | Link |
|---|---|
| **Live app** | **https://ajaia-docs-e26f.onrender.com** |
| **Source code** (public GitHub) | https://github.com/koshtiakanksha/ajaia-assessment |
| **README**: overview, setup and run, deployment, API, write-up (problem, plan, what I built, AI use, checks, tradeoffs) | [README.md](README.md) |
| **Architecture note**: design, priorities, tradeoffs | [ARCHITECTURE.md](ARCHITECTURE.md) |
| **Testing log**: test rounds, issues found (T1–T33), live verification, manual checklist | [TESTING.md](TESTING.md) |
| **AI workflow log**: prompts, AI output, decisions, results | [AI_WORKFLOW.md](AI_WORKFLOW.md) |
| **Automated tests**: 77 backend tests (pytest) | [`backend/tests/`](backend/tests/) |
| **Deployment config**: Docker image and Render Blueprint (web service + Postgres) | [Dockerfile](Dockerfile) · [render.yaml](render.yaml) |

> **Note:** the app runs on Render's free tier. If it has been idle for about 15 minutes, the first page load takes **about 50 seconds** while it wakes up. After that it's fast.

---

## Try it in 5 minutes

**Sign in:** no password needed. Click a demo account, or type any email to create a new user.

| Account | What to look at |
|---|---|
| **Alice Johnson** | Owns "Welcome to Ajaia Docs" (shared with Bob as editor, Carol as viewer). Bob's "Team meeting notes" is under **Shared with me** |
| **Bob Smith** | Can **edit** Alice's welcome doc, but has no Share button |
| **Carol Lee** | Can only **view** it: read-only page, no toolbar |

1. **Edit and autosave:** as Alice, open *Welcome to Ajaia Docs*. Change fonts, sizes, colors, alignment, add a checklist. The status shows "Saving…" then "All changes saved". Refresh, and everything is kept.
2. **Import:** on the home page, click **Import file** (or drag a file onto the page) and choose a `.docx`, `.md` or `.txt` file. It opens as a new editable document.
3. **Share:** click **Share**, add any email as a **Viewer** or **Editor**, change the role, or click **Remove**.
4. **See the roles:** use the avatar menu (top right) to **Sign out**, then sign in as Bob (editor) or Carol (viewer).
5. **Share with someone new:** share with an email that has never signed in, then sign in with that email. The document is waiting under **Shared with me**.

---

## What's included

| Brief requirement | Delivered |
|---|---|
| Document creation and editing | Create, rename, edit, autosave, reopen. Rich text: bold, italic, underline, strikethrough, headings, bulleted, numbered and check lists, plus font family, size, color, highlight, alignment, line spacing and links. A Google Docs-style menu bar and toolbar |
| File upload | `.txt`, `.md` and `.docx` (up to 5 MB) become new editable documents. Supported types are shown in the UI. Invalid files get clear errors |
| Sharing | Every document has an owner. Share by email with several people as Viewer or Editor, change roles, revoke. **My documents** and **Shared with me** sections. Shares work for people who haven't signed in yet |
| Persistence | Postgres in production (SQLite locally). Formatting is stored as sanitized HTML and survives reloads, sessions and redeploys |
| Engineering quality | Setup and run instructions, a live deployment, validation and error handling (401, 403, 404, 413, 422 with readable messages), **77 automated tests**, and an architecture note |

**Beyond the brief:** Ajaia branding (logo, colors, Inter font), autosave with offline recovery, export to `.html` and `.txt`, print layout, word count, and a mobile-friendly layout.

---

## How it was verified

- **77 backend tests** (pytest): documents, validation, file import (with real `.docx` files), authentication, permissions for every role, sharing, the HTML sanitizer and XSS payloads, deployment behavior.
- **69 browser checks** (headless Chrome, 4 suites) run against **both** the local dev setup **and** the production Docker image with Postgres.
- **Live site verification** (2026-11-22). All passed:
  - HTTPS, the secure session cookie and permission checks.
  - The full create → edit → autosave → reopen flow in a fresh session.
  - `.docx` and `.txt` import.
  - Share → view-only (server returns 403 on edit) → editor → revoke.
  - Data persisting across sessions and a redeploy.
- **Security:** dependency audits (`npm audit`, `pip-audit`: 0 known vulnerabilities) and a clean secret scan of the full git history.
- **Issues:** over 20 real bugs found and fixed during development. Each is logged with how it was found and fixed in [TESTING.md](TESTING.md).

---

## Known limitations (by design for this scope)

- **No real-time co-editing.** Saves are last-write-wins: if two people edit the same document at the same moment, the later save wins.
- **Simulated sign-in.** Anyone can sign in as any email, without a password. This demonstrates ownership and permissions, not identity verification.
- **Only the owner can manage sharing.** Google Docs also lets editors share.
- **Import** creates a new document. Images and tables inside `.docx` files aren't imported.
- **Hosting:** Render's free tier sleeps when idle (slow first load), and the free database expires 30 days after creation.

Next steps and tradeoffs are covered in [README §6](README.md#6-tradeoffs--next-steps) and [ARCHITECTURE.md](ARCHITECTURE.md#tradeoffs).

---

## Run it locally

```bash
# Backend (Python 3.11+): http://localhost:8001
cd backend && python3.11 -m venv .venv && source .venv/bin/activate
pip install -r requirements-dev.txt
SECRET_KEY=dev uvicorn app.main:app --port 8001 --reload

# Frontend (Node 20.19+): http://localhost:5173, in a second terminal
cd frontend && npm install && npm run dev

# Tests
cd backend && pytest
```

Full instructions are in the [README](README.md#quick-start-local).
