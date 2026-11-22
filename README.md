# Ajaia Docs: Lightweight Collaborative Document Editor

A small full-stack document editor inspired by Google Docs. It is built for an Ajaia assessment exploring internal productivity tools for teams working on shared documents.

The goal is not to clone Google Docs. It is to ship the strongest working version within the timebox, showing product judgment, full-stack capability, and clear prioritization.

> **Status:** In progress. Document creation, the rich-text editor, rename, and save/reopen work locally. Upload, sharing, and deployment are next.
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
- [ ] Upload a `.txt`, `.md`, or `.docx` file and turn it into a new editable document
- [ ] Show the supported file types and size limit in the UI and in this README
- [ ] Reject unsupported or oversized files with a clear error message

#### 3. Sharing
- [ ] Every document has an **owner**
- [ ] The owner can grant another user access (by email or username)
- [ ] The document list visibly separates **"My documents"** from **"Shared with me"**
- [ ] Users are simulated with **seeded accounts and a lightweight login** (no real auth)

#### 4. Persistence
- [ ] Documents, owners, and shares persist in a database and survive refresh or restart
- [ ] Formatting is preserved: content is stored as sanitized HTML
- [ ] Shared access can be demonstrated: log in as user A, share, then log in as user B and see the document

#### 5. Product and engineering quality
- [x] Clear setup and run instructions
- [ ] A working public deployment reviewers can access
- [ ] Basic validation and error handling (missing or invalid input, 403/404 responses, upload errors)
- [ ] At least one meaningful automated test (for example, that a non-shared user can't access a document)
- [ ] A short architecture note explaining priorities and tradeoffs

### Additional features (after the MVP, in rough priority order)

| # | Feature | Why it's valuable |
|---|---------|-------------------|
| 1 | **Autosave** (debounced) with "Saving… / Saved" indicator | Removes the most common source of lost work |
| 2 | **Share roles**: viewer vs. editor | A natural next step for access control; read-only mode in the editor |
| 3 | **Revoke access** and list current collaborators | Completes the sharing lifecycle |
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
| **File import** | `python-docx`/`mammoth` (`.docx` → HTML), `markdown` (`.md` → HTML), escaped plain text for `.txt` | Small, reliable libraries. Every import ends up as HTML that TipTap can load |
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
  app/main.py           API routes
  app/models.py         Document table + request/response schemas and validation
  app/database.py       Engine and session (DATABASE_URL, defaults to sqlite:///./app.db)
  app/sanitize.py       HTML allowlist sanitizer (nh3)
  tests/                pytest suite (in-memory SQLite via conftest.py)
frontend/               React + TypeScript + Vite
  src/api.ts            Typed fetch wrapper for the API
  src/pages/            DocumentList, DocumentEditor (with unsaved-changes guard)
  src/components/       Toolbar (TipTap formatting buttons)
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
cd backend && source .venv/bin/activate && pytest   # 12 API tests
cd frontend && npm run lint && npm run build        # lint + type-check + production build
```

**Configuration:** the only setting is `DATABASE_URL`, an optional environment variable that defaults to the local SQLite file `backend/app.db`. No API keys or secrets are needed. Keep any future secrets in a `.env` file; `.gitignore` already excludes it.

### API (so far)

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/health` | Health check |
| GET | `/api/documents` | List documents (most recently edited first) |
| POST | `/api/documents` | Create a document (`title` is optional and defaults to "Untitled document") |
| GET | `/api/documents/{id}` | Get one document, including its content |
| PATCH | `/api/documents/{id}` | Rename and/or save content. Content is sanitized HTML |

## Security notes

- **No secrets in the repo.** The app needs no API keys. `.env*`, key and certificate files, local databases, virtual environments, and `node_modules` are all ignored by git.
- **XSS:** document HTML is sanitized on the server against a strict tag allowlist (`nh3`) before it's stored. Links are limited to `http`, `https` and `mailto`, and the editor renders content through TipTap, never through raw `innerHTML`.
- **Input validation:** titles are trimmed and must be 1–200 characters. Content is limited to about 1 MB. Invalid input returns `422` with a readable message.
- **SQL injection:** all queries go through SQLModel/SQLAlchemy with bound parameters.
- **CORS:** not enabled. The API is same-origin only (Vite proxy in development, one service in production).
- **Known gap (intentional for now):** there's **no authentication yet**, so anyone who can reach the API can read and edit every document. Simulated users, ownership, and sharing are the next MVP step, and the app should not be deployed publicly with real data before then.

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

See [TESTING.md](TESTING.md) for the full log. Round 1 so far:
- **Automated:** 12 backend tests, lint, type-check and build, and dependency audits.
- **API edge cases:** 25 live checks.
- **Browser:** 21 headless-Chrome end-to-end checks, including mobile, plus a backend-down resilience test.
- **Fixed:** 9 issues. The most important were links and rules being silently deleted on save, unsaved edits lost on in-app navigation, the Save button hidden on mobile, and a huge id causing a 500.
- [TESTING.md](TESTING.md) also has a manual test checklist.

## 6. Tradeoffs & next steps

_To be completed._
