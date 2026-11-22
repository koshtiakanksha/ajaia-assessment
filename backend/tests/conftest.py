import os

# Point the app at a throwaway in-memory database *before* it is imported,
# so running the tests never touches the real local app.db.
os.environ["DATABASE_URL"] = "sqlite://"
os.environ["SEED_DEMO_DATA"] = "0"

import pytest  # noqa: E402
from fastapi.testclient import TestClient  # noqa: E402
from sqlalchemy.pool import StaticPool  # noqa: E402
from sqlmodel import Session, SQLModel, create_engine  # noqa: E402

from app.database import get_session  # noqa: E402
from app.main import app  # noqa: E402


@pytest.fixture
def engine():
    # Fresh in-memory database for every test.
    engine = create_engine(
        "sqlite://", connect_args={"check_same_thread": False}, poolclass=StaticPool
    )
    SQLModel.metadata.create_all(engine)

    def override_session():
        with Session(engine) as session:
            yield session

    app.dependency_overrides[get_session] = override_session
    yield engine
    app.dependency_overrides.clear()


@pytest.fixture
def make_client(engine):
    """Factory: make_client("bob@example.com") -> a TestClient signed in as Bob.

    Each client has its own cookie jar, so several users can act in one test.
    Pass email=None for a signed-out client.
    """
    clients = []

    def _make(email="alice@example.com"):
        c = TestClient(app)
        c.__enter__()
        clients.append(c)
        if email:
            assert c.post("/api/auth/login", json={"email": email}).status_code == 200
        return c

    yield _make
    for c in clients:
        c.__exit__(None, None, None)


@pytest.fixture
def client(make_client):
    """A client signed in as alice@example.com."""
    return make_client()
