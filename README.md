# Ajaia Docs: Lightweight Collaborative Document Editor

A small full-stack document editor inspired by Google Docs. It is built for an Ajaia assessment exploring internal productivity tools for teams working on shared documents.

The goal is not to clone Google Docs. It is to ship the strongest working version within the timebox, showing product judgment, full-stack capability, and clear prioritization.

> **Status:** In progress. Editing, file import (.txt, .md, .docx), and **users and sharing** (owner, editor and viewer access by email) work locally. Deployment is next.
> The AI-assisted development process is logged in [AI_WORKFLOW.md](AI_WORKFLOW.md), and test rounds and issues are tracked in [TESTING.md](TESTING.md).

---

## Scope

### MVP (required: must ship)

Everything in this section is a requirement from the brief. The MVP aims for the simplest version of each that works well.

#### 1. Document creation and editing
- [x] Create a new document
- [x] Rename a document
- [x] Edit document content in the browser
- [x] Save and reopen documents
- [x] Rich-text formatting: **bold**, *italic*, underline, headings (H1–H3), bulleted and numbered lists
- [x] An editing flow that feels coherent: toolbar, clear save state, document list ↔ editor navigation

#### 2. File upload
- [x] Upload a `.txt`, `.md`, or `.docx` file and turn it into a new editable document
- [x] Show the supported file types and size limit in the UI and in this README
- [x] Reject unsupported or oversized files with a clear error message

#### 3. Sharing
- [x] Every document has an **owner**
- [x] The owner can grant another user access by email, with **viewer** or **editor** roles, and can change roles or revoke access
- [x] The document list visibly separates **"My documents"** from **"Shared with me"**
- [x] Users are simulated with **seeded accounts and a lightweight login** (no real auth)

#### 4. Persistence
- [x] Documents, owners, and shares persist in a database and survive refresh or restart
- [x] Formatting is preserved: content is stored as sanitized HTML
- [x] Shared access can be demonstrated: log in as user A, share, then log in as user B and see the document

#### 5. Product and engineering quality
- [x] Clear setup and run instructions
- [ ] A working public deployment reviewers can access
- [x] Basic validation and error handling (missing or invalid input, 403/404 responses, upload errors)
- [x] At least one meaningful automated test (for example, that a non-shared user can't access a document)
- [ ] A short architecture note explaining priorities and tradeoffs

### Additional features (after the MVP, in rough priority order)

| # | Feature | Why it's valuable |
|---|---------|-------------------|
| 1 | **Autosave** (debounced) with "Saving… / Saved" indicator | Removes the most common source of lost work |
| 2 | ~~Share roles (viewer vs. editor)~~ | ✅ Built as part of the MVP sharing work |
| 3 | ~~Revoke access and list current collaborators~~ | ✅ Built as part of the MVP sharing work |
| 4 | **Export** a document to `.md` / `.docx` / PDF | Pairs with import; makes content portable |
| 5 | **Search and sort** the document list | Usability once there are many docs |
| 6 | **Version history** (snapshots on save, restore) | Safety net for shared editing |
| 7 | **File attachments** linked to a document | Second upload use case from the brief |
| 8 | **Comments** on a document | Lightweight collaboration without real-time complexity |
| 9 | **Real-time co-editing** (Yjs/CRDT over WebSockets) and presence | The "true" Google Docs experience, but the highest complexity and risk |
| 10 | **Real authentication** (OAuth / magic link) | Needed for production, out of scope for the demo |

---

## Tech stack

| Layer | Choice | Why |
|-------|--------|-----|
| **Backend** | **Python + FastAPI** | Already set up in this repo. Fast to build, typed request/response validation via Pydantic, and auto-generated API docs at `/docs` |
| **ORM / DB** | **SQLModel (SQLAlchemy) + SQLite** | SQLite needs no setup and is ideal for local dev and a small demo. Because it goes through SQLAlchemy, switching to Postgres for deployment only requires changing `DATABASE_URL` |
| **Frontend** | **React + TypeScript + Vite** | The most common, well-supported SPA stack. Vite gives a fast dev loop, and TypeScript catches API-shape bugs early |
| **Rich-text editor** | **TipTap** (built on ProseMirror) | Provides bold, italic, underline, headings, and lists out of the box. Outputs HTML, which is easy to store and to produce from imports. It also has a clear upgrade path to real-time collaboration through its Yjs integration |
| **Content format** | **Sanitized HTML** (via `nh3` on the backend) | Preserves formatting, is easy to generate from `.md` and `.docx` imports, and sanitizing on the server prevents stored XSS |
| **File import** | `mammoth` (`.docx` → HTML), `markdown` (`.md` → HTML), escaped plain text for `.txt`; `python-docx` only in tests, to generate real `.docx` files | Small, reliable libraries. Every import ends up as HTML that TipTap can load |
| **Auth (simulated)** | Seeded users + a "log in as" picker, which issues a signed session cookie | Meets the brief's "mocked auth" allowance while keeping ownership and sharing logic real and testable |
| **Testing** | **pytest** + FastAPI `TestClient` (backend), optionally Vitest for the frontend | Backend tests cover the riskiest logic: permissions, sharing, and upload validation |
| **Deployment** | One service: FastAPI serves the built React app. Hosted on **Render** or **Railway**, with Postgres (or SQLite on a persistent volume) | One deployable unit and one URL, with no CORS setup in production. Both hosts offer free or cheap tiers and deploy from GitHub |

**Notes**
- The backend uses **Python 3.11** (its own venv at `backend/.venv`).
- Real-time co-editing is deliberately **not** in the MVP. Choosing TipTap keeps that door open without paying its cost now.

---

## Project structure

```
backend/                FastAPI + SQLModel + SQLite
  app/main.py           App setup: session middleware, routers, startup (create tables + seed)
  app/auth.py           Simulated sign-in (signed session cookie), current-user dependency
  app/documents.py      Document, import and sharing endpoints + permission checks
  app/models.py         User / Document / DocumentShare tables + request/response schemas
  app/seed.py           Demo users and sample shared documents
  app/database.py       Engine and session (DATABASE_URL, defaults to sqlite:///./app.db)
  app/sanitize.py       HTML allowlist sanitizer (nh3)
  app/importers.py      .txt / .md / .docx → HTML conversion and validation
  tests/                pytest suite (in-memory SQLite via conftest.py)
frontend/               React + TypeScript + Vite
  src/api.ts            Typed fetch wrapper for the API
  src/auth/             AuthGate (session check), Login screen, useAuth()
  src/pages/            DocumentList (My documents / Shared with me), DocumentEditor (role-aware)
  src/components/       Toolbar, ShareDialog, Avatar
```

## Setup & run

**Prerequisites:** Python 3.11+ and Node 20+.

**1. Backend** (http://localhost:8001)
```bash
cd backend
python3.11 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
uvicorn app.main:app --port 8001 --reload
```
The interactive API docs are at http://localhost:8001/docs.

**2. Frontend** (http://localhost:5173), in a second terminal:
```bash
cd frontend
npm install
npm run dev
```
Open http://localhost:5173. Vite forwards `/api/*` requests to the backend on port 8001.

**3. Tests and checks**
```bash
cd backend && source .venv/bin/activate && pytest   # 55 API tests (documents, import, auth and sharing)
cd frontend && npm run lint && npm run build        # lint + type-check + production build
```

**Configuration** (all optional for local development):

| Variable | Default | Purpose |
|---|---|---|
| `DATABASE_URL` | `sqlite:///./app.db` | Database connection |
| `SECRET_KEY` | random per process | Signs the session cookie. **Set it in any shared or deployed environment.** Without it, users are signed out whenever the server restarts |
| `COOKIE_SECURE` | `0` | Set to `1` behind HTTPS so the session cookie is only sent over HTTPS |
| `SEED_DEMO_DATA` | `1` | Seeds demo users and sample documents into an empty database |

No API keys are needed. Keep secrets in a `.env` file; `.gitignore` already excludes it.

> **Upgrading from an earlier checkout?** The database schema gained users and sharing. Delete `backend/app.db` and restart; demo data is re-seeded automatically.

### API

Everything except `/api/health`, `/api/auth/demo-users` and `/api/auth/login` requires a signed-in session (otherwise `401`).

| Method | Path | Who | Description |
|--------|------|-----|-------------|
| GET | `/api/health` | anyone | Health check |
| GET | `/api/auth/demo-users` | anyone | Seeded accounts for the sign-in screen |
| POST | `/api/auth/login` | anyone | `{email}` signs in, creating the user on first sign-in |
| POST | `/api/auth/logout` | signed in | End the session |
| GET | `/api/auth/me` | signed in | Current user |
| GET | `/api/users` | signed in | Other known users (email suggestions in the share dialog) |
| GET | `/api/documents` | signed in | Owned and shared documents, each with your `role` and the `owner` |
| POST | `/api/documents` | signed in | Create a document (you become the owner) |
| GET | `/api/documents/{id}` | owner, editor, viewer | Get one document. Returns `403` without access and `404` if it doesn't exist |
| PATCH | `/api/documents/{id}` | owner, editor | Rename and/or save content. Viewers get `403` |
| POST | `/api/documents/import` | signed in | Upload one file (multipart field `file`) to create a new document. Returns `400` for an unsupported, empty or corrupt file, and `413` if it's over 5 MB |
| GET | `/api/documents/{id}/shares` | owner | The owner and everyone with access |
| POST | `/api/documents/{id}/shares` | owner | `{emails: [...], role: "viewer"\|"editor"}`: share with up to 20 people at once. Re-sharing updates the role |
| PATCH | `/api/documents/{id}/shares/{share_id}` | owner | `{role}`: change someone's access |
| DELETE | `/api/documents/{id}/shares/{share_id}` | owner | Revoke access |

## Users & sharing

**Demo accounts** (no passwords, simulated sign-in):

| Account | Seeded with |
|---|---|
| **Alice Johnson** (alice@example.com) | Owns "Welcome to Ajaia Docs" (Bob is an editor, Carol a viewer). Bob shares "Team meeting notes" with her as an editor |
| **Bob Smith** (bob@example.com) | Owns "Team meeting notes" |
| **Carol Lee** (carol@example.com) | Can view "Welcome to Ajaia Docs" |

You can also sign in with **any email address**; the account is created on first sign-in.

**How sharing works**
- Open a document you own and click **Share**. Type one or more email addresses (press Enter or a comma after each, or paste a list), choose **Viewer** or **Editor**, and click **Share**.
- **People with access** lists the owner and everyone invited. Change a role from the dropdown, or click **Remove** to revoke access. Changes take effect immediately.
- **Sharing isn't limited to existing users.** Access is stored per email address, so you can invite someone who has never signed in. The document appears in their **Shared with me** section the first time they sign in with that email, and the owner then sees their name instead of "Hasn't signed in yet".
- The documents page has two sections: **My documents** and **Shared with me**. Shared rows show the owner and a **Can edit** or **View only** badge.

| | Owner | Editor | Viewer |
|---|:-:|:-:|:-:|
| Open and read | ✅ | ✅ | ✅ |
| Edit content and rename | ✅ | ✅ | ❌ read-only editor, no toolbar |
| Share, change roles, revoke | ✅ | ❌ | ❌ |

**Permissions are enforced on the backend.** The UI hides what you can't do, but every API call checks your role. For example, a viewer's `PATCH` returns `403`, and so does an editor trying to manage shares. If access is revoked while someone has the document open, their next save fails with a clear message.

## File import

Turn an existing file into a new editable document.

**How to use it:** on the **My documents** page, click **⬆ Import file**, or **drag and drop** a file onto the page. The new document opens in the editor right away, just like **+ New document**. Its title is the filename without the extension, and it's a normal document: rename it, edit it, save it.

| Supported type | What's preserved |
|---|---|
| `.txt` | Paragraphs (blank lines) and line breaks. Text is shown exactly as written, so `<tags>` stay literal text |
| `.md` / `.markdown` | Headings, bold, italic, links, bulleted and numbered lists, block quotes, code |
| `.docx` | Headings, bold, italic, underline, links, bulleted and numbered lists |

**Limits and behavior**
- One file at a time, **up to 5 MB**. The supported types and the limit are shown on the page.
- Files are checked in the browser for instant feedback (wrong type, empty, too large), then checked again on the server.
- Headings below H3 become H3, because the editor supports H1–H3.
- Imported HTML goes through the same sanitizer as typed content, so scripts and unsafe links are removed.
- `.txt` files that aren't UTF-8, such as older Windows files, are decoded as Windows-1252.
- **Not supported yet:** images and tables in `.docx` (only the text inside a table is kept), legacy `.doc`, PDF, and importing into an existing document.

## Security notes

- **No secrets in the repo.** The app needs no API keys. `.env*`, key and certificate files, local databases, virtual environments, and `node_modules` are all ignored by git.
- **XSS:** document HTML is sanitized on the server against a strict tag allowlist (`nh3`) before it's stored. Links are limited to `http`, `https` and `mailto`, and the editor renders content through TipTap, never through raw `innerHTML`.
- **Input validation:** titles are trimmed and must be 1–200 characters. Content is limited to about 1 MB. Invalid input returns `422` with a readable message.
- **Uploads:** an extension allowlist (`.txt`, `.md`, `.docx`), a 5 MB limit (the server reads at most limit + 1 bytes), a zip signature check before `.docx` parsing, and sanitized output. Files aren't stored, only the converted document.
- **SQL injection:** all queries go through SQLModel/SQLAlchemy with bound parameters.
- **CORS:** not enabled. The API is same-origin only (Vite proxy in development, one service in production).
- **Sessions:** a signed session cookie (`HttpOnly`, `SameSite=Lax`, and `Secure` when `COOKIE_SECURE=1`). A tampered cookie is rejected. `SameSite=Lax` stops the cookie being sent on cross-site POSTs, which gives basic CSRF protection.
- **Authorization:** every document and share endpoint checks the caller's role on the server. Share ids are scoped to their document, so a share id from one document can't be used to change another.
- **Known limitation (by design for this demo):** sign-in is **simulated**. Anyone can sign in as any email without a password, so this demonstrates the permission model, not identity verification. Real auth (OAuth or magic links) would replace only `app/auth.py`; the sharing logic depends only on the current user.

---

## 1. Problem & assumptions

_To be completed._ Initial assumptions:
- "Collaborative" in the MVP means **shared access**, not simultaneous real-time editing.
- Simulated users are acceptable; the focus is on correct ownership and permission logic.
- With one or two people editing a document, saves can be last-write-wins.

## 2. Plan (steps and why)

_To be completed._

## 3. What I built (and how to use it)

_To be completed._

## 4. How I used AI

The full log is in [AI_WORKFLOW.md](AI_WORKFLOW.md). Summary:

| What I asked | What it gave | What I kept / changed / rejected and why |
|---|---|---|
|   |   |   |

## 5. How I checked the output

See [TESTING.md](TESTING.md) for the full log.

**Round 3 (users and sharing):** 29 new backend tests (55 in total) covering 401, 403 and 404 for every role, sharing with multiple people, sharing with never-seen emails, role changes, revoking, and session tampering. Plus a 23-check multi-user browser suite with four separate sessions (Alice, Bob, Carol, and a newcomer). It found and fixed a CSS class collision that stretched the role badge, the browser's native validation replacing our styled error on sign-in, and a share-box bug that would have cut off emails early.

**Round 2 (file import):** 14 new backend tests and a 16-check browser test of the full import flow (button, drag-and-drop, all three file types, editing after import, client- and server-side rejections, mobile). It found and fixed one issue: `.docx` underline was being dropped.

**Round 1:**
- **Automated:** 12 backend tests, lint, type-check and build, and dependency audits.
- **API edge cases:** 25 live checks.
- **Browser:** 21 headless-Chrome end-to-end checks, including mobile, plus a backend-down resilience test.
- **Fixed:** 9 issues. The most important were links and rules being silently deleted on save, unsaved edits lost on in-app navigation, the Save button hidden on mobile, and a huge id causing a 500.
- [TESTING.md](TESTING.md) also has a manual test checklist.

## 6. Tradeoffs & next steps

_To be completed._
