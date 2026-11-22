import logging
import os
import secrets
from contextlib import asynccontextmanager

from fastapi import FastAPI
from sqlmodel import Session
from starlette.middleware.sessions import SessionMiddleware

from . import auth, documents
from .database import engine, init_db
from .seed import seed_demo_data

logger = logging.getLogger("uvicorn.error")


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

app = FastAPI(title="Ajaia Docs API", lifespan=lifespan)
app.add_middleware(
    SessionMiddleware,
    secret_key=SECRET_KEY,
    session_cookie="ajaia_session",
    max_age=7 * 24 * 3600,
    same_site="lax",  # cookie isn't sent on cross-site POSTs (basic CSRF protection)
    https_only=os.getenv("COOKIE_SECURE", "0") == "1",
)
app.include_router(auth.router)
app.include_router(documents.router)


@app.get("/api/health")
def health():
    return {"status": "ok"}
