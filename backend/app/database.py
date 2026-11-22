import os

from sqlmodel import Session, SQLModel, create_engine


def _normalize_url(url: str) -> str:
    # Render/Heroku-style "postgres://" URLs -> SQLAlchemy + psycopg 3 driver.
    for prefix in ("postgres://", "postgresql://"):
        if url.startswith(prefix):
            return "postgresql+psycopg://" + url[len(prefix):]
    return url


DATABASE_URL = _normalize_url(os.getenv("DATABASE_URL", "sqlite:///./app.db"))

if DATABASE_URL.startswith("sqlite"):
    # FastAPI may use a session from a different thread than the one that created it.
    engine = create_engine(DATABASE_URL, connect_args={"check_same_thread": False})
else:
    # pool_pre_ping: transparently replace connections the server has closed.
    engine = create_engine(DATABASE_URL, pool_pre_ping=True)


def init_db() -> None:
    SQLModel.metadata.create_all(engine)


def get_session():
    with Session(engine) as session:
        yield session
