# Architecture Note

A short overview of how Ajaia Docs is built, what I prioritized, and the tradeoffs I made.

## Shape of the system

```
Browser (React + TipTap)                         FastAPI (one process)                    Database
┌───────────────────────────────┐   /api/*     ┌─────────────────────────────────┐   SQLAlchemy   ┌───────────────┐
│ Sign-in · Docs home · Editor  │ ───────────▶ │ auth.py        sessions, users  │ ─────────────▶ │ SQLite (dev)  │
│ Menu bar · Toolbar · Share    │  JSON +      │ documents.py   docs, import,    │                │ Postgres      │
│ Autosave (debounced PATCH)    │  session     │                sharing + perms  │                │ (production)  │
└───────────────────────────────┘  cookie      │ sanitize.py    HTML allowlist   │                └───────────────┘
            ▲                                  │ importers.py   txt/md/docx→HTML │
            └──────── static files ─────────── │ SPA fallback   serves React app │
                                               └─────────────────────────────────┘
```

- **One deployable service.** In production, FastAPI serves both `/api/*` and the built React app, with a fallback to `index.html` for client-side routes like `/docs/5`. That means one URL, no CORS, and same-site cookies. Locally, Vite serves the UI and forwards `/api` to FastAPI.
- **Data model.** `User(email)`, `Document(owner_id, title, content, timestamps)` and `DocumentShare(document_id, email, role)`.
  - **Shares are keyed by email, not user id.** You can share with someone who has never signed in, and the document appears the first time they sign in.
- **Content is stored as sanitized HTML.** TipTap produces it, the importers produce it, and the server cleans everything with one allowlist (`nh3`):
  - Tags and attributes the editor can produce.
  - A short list of CSS properties (font, size, color, highlight, alignment, line height) with value checks, so `url(…)`, `expression(…)` and similar are rejected.
  - Links limited to `http`, `https` and `mailto`.
- **Authorization lives in one function.** `load_document(doc_id, user, need="view"|"edit"|"own")` returns the document or raises 404 or 403 with a specific message. Every document and share endpoint goes through it. The UI hides actions you can't take, but the server is the source of truth.
- **Auth is deliberately simulated.** Signing in with an email creates the user and sets a signed `HttpOnly`, `SameSite=Lax` session cookie (`Secure` in production). Real auth (OAuth or magic links) would replace only `auth.py`; sharing depends only on `get_current_user`.

## What I prioritized, and why

1. **Correct core behavior over breadth.** Create, edit, save, reopen, import and share all work end to end, with server-side validation and permission checks. Tests prove those first.
2. **Never lose work.** Autosave (800 ms debounce, one save at a time, automatic retry when offline), plus saving before leaving the page or signing out, with a warning only if saving fails. Several bugs I found were data-loss bugs: formatting silently stripped on save, edits lost on navigation, and keystrokes landing in the wrong field. They got priority.
3. **Security by default.** Server-side sanitizing, role checks on every endpoint, signed cookies, no secrets in the repo, upload limits, and a request-size limit applied before the body is read.
4. **A familiar UX.** Google Docs conventions (menu bar, toolbar, paper page, Share dialog with email chips and roles, "Saving… / All changes saved") in Ajaia's brand (logo, navy, sky, Inter), so the app needs no explanation.
5. **Proof, not claims.** 77 backend tests and 69 browser checks across four suites. The browser checks run against both the dev servers and the production Docker image with Postgres. Each test round is logged in [TESTING.md](TESTING.md).

## Tradeoffs

| Decision | Benefit | Cost / what I'd do next |
|---|---|---|
| **No real-time co-editing**; saves are last-write-wins | Simple and reliable, and fits the timebox | Two editors typing at once can overwrite each other. Next: Yjs (CRDT) through TipTap's collaboration extension, plus presence |
| Simulated sign-in | Easy to demo every role | Not secure identity. Next: OAuth or magic link replacing `auth.py` |
| Sanitized HTML as the storage format | One format for editor, import and export | Less structured than ProseMirror JSON for diffing or versioning |
| Only the owner manages sharing | A clear, testable model | Docs also lets editors share. Easy to add as a flag |
| Missing doc → 404, no access → 403 | The UI can say "You don't have access" | Reveals that an id exists. Acceptable for an internal tool |
| Import creates a **new** document and files aren't stored | No file storage to secure or clean up | No "import into the current doc", and no attachments yet |
| `create_all` instead of migrations | No migration tooling for a young schema | Next: Alembic before the schema changes again |
| Render free tier (Docker + free Postgres) | One-click Blueprint deploy, $0 | Cold starts (about 50 s after idle) and a 30-day free database. Paid tier for real use |
| Browser tests run as local scripts, not in CI | Fast to iterate while building | Next: move them into the repo as a Playwright suite and run them in CI |
