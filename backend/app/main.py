import logging
import os
import secrets
from contextlib import asynccontextmanager
from pathlib import Path

from fastapi import FastAPI, Request
from fastapi.responses import JSONResponse
from fastapi.staticfiles import StaticFiles
from sqlmodel import Session
from starlette.exceptions import HTTPException as StarletteHTTPException
from starlette.middleware.sessions import SessionMiddleware

from . import auth, documents
from .database import engine, init_db
from .importers import MAX_UPLOAD_BYTES
from .seed import seed_demo_data

logger = logging.getLogger("uvicorn.error")

# Reject oversized requests before reading the body (uploads are 5 MB max;
# JSON saves are ~1 MB max). Leaves headroom for multipart overhead.
MAX_REQUEST_BYTES = MAX_UPLOAD_BYTES + 512 * 1024


@asynccontextmanager
async def lifespan(app: FastAPI):
    init_db()
    if os.getenv("SEED_DEMO_DATA", "1") == "1":
        with Session(engine) as session:
            seed_demo_data(session)
    yield


SECRET_KEY = os.getenv("SECRET_KEY")
if not SECRET_KEY:
    # Fine for local development; sign-ins reset whenever the server restarts.
    # Set SECRET_KEY in any shared or deployed environment.
    SECRET_KEY = secrets.token_urlsafe(32)
    logger.warning("SECRET_KEY not set; using a random key (sessions reset on restart).")

app = FastAPI(
    title="Ajaia Docs API",
    lifespan=lifespan,
    docs_url="/api/docs",  # keep /docs/* free for the frontend's document URLs
    redoc_url=None,
    openapi_url="/api/openapi.json",
)
app.add_middleware(
    SessionMiddleware,
    secret_key=SECRET_KEY,
    session_cookie="ajaia_session",
    max_age=7 * 24 * 3600,
    same_site="lax",  # cookie isn't sent on cross-site POSTs (basic CSRF protection)
    https_only=os.getenv("COOKIE_SECURE", "0") == "1",
)


@app.middleware("http")
async def limit_request_size(request: Request, call_next):
    length = request.headers.get("content-length")
    if length and length.isdigit() and int(length) > MAX_REQUEST_BYTES:
        return JSONResponse({"detail": "Request is too large. The upload limit is 5 MB."}, status_code=413)
    return await call_next(request)


app.include_router(auth.router)
app.include_router(documents.router)


@app.get("/api/health")
def health():
    return {"status": "ok"}


# ---------- Serve the built React app (production: one service, one URL) ----------

class SPAStaticFiles(StaticFiles):
    """Static files with a fallback to index.html for client-side routes like /docs/5."""

    async def get_response(self, path: str, scope):
        try:
            return await super().get_response(path, scope)
        except StarletteHTTPException as exc:
            if exc.status_code != 404 or path.startswith("api"):
                raise  # unknown /api/* routes stay a JSON 404
            return await super().get_response("index.html", scope)


FRONTEND_DIST = Path(os.getenv("FRONTEND_DIST", Path(__file__).resolve().parents[2] / "frontend" / "dist"))
if (FRONTEND_DIST / "index.html").is_file():
    app.mount("/", SPAStaticFiles(directory=FRONTEND_DIST, html=True), name="frontend")
