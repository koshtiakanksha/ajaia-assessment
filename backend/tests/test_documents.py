import pytest
from fastapi.testclient import TestClient
from sqlalchemy.pool import StaticPool
from sqlmodel import Session, SQLModel, create_engine

from app.database import get_session
from app.main import app


@pytest.fixture
def client():
    # Fresh in-memory database for every test.
    engine = create_engine(
        "sqlite://", connect_args={"check_same_thread": False}, poolclass=StaticPool
    )
    SQLModel.metadata.create_all(engine)

    def override_session():
        with Session(engine) as session:
            yield session

    app.dependency_overrides[get_session] = override_session
    with TestClient(app) as c:
        yield c
    app.dependency_overrides.clear()


def test_health(client):
    assert client.get("/api/health").json() == {"status": "ok"}


def test_create_save_and_reopen_document(client):
    created = client.post("/api/documents", json={"title": "Plan"})
    assert created.status_code == 201
    doc_id = created.json()["id"]

    html = "<h1>Goals</h1><p><strong>Ship</strong> the <em>MVP</em></p><ul><li>one</li></ul>"
    saved = client.patch(f"/api/documents/{doc_id}", json={"content": html})
    assert saved.status_code == 200

    reopened = client.get(f"/api/documents/{doc_id}").json()
    assert reopened["title"] == "Plan"
    assert reopened["content"] == html  # formatting preserved

    listed = client.get("/api/documents").json()
    assert [d["id"] for d in listed] == [doc_id]


def test_rename_document(client):
    doc_id = client.post("/api/documents", json={}).json()["id"]
    resp = client.patch(f"/api/documents/{doc_id}", json={"title": "  Renamed  "})
    assert resp.status_code == 200
    assert resp.json()["title"] == "Renamed"


@pytest.mark.parametrize("title", ["", "   ", "x" * 201])
def test_invalid_title_rejected(client, title):
    assert client.post("/api/documents", json={"title": title}).status_code == 422


def test_missing_document_returns_404(client):
    assert client.get("/api/documents/999").status_code == 404
    assert client.patch("/api/documents/999", json={"title": "x"}).status_code == 404


def test_content_is_sanitized(client):
    doc_id = client.post("/api/documents", json={}).json()["id"]
    dirty = '<p onclick="alert(1)">hi</p><script>alert(1)</script>'
    resp = client.patch(f"/api/documents/{doc_id}", json={"content": dirty})
    assert resp.json()["content"] == "<p>hi</p>"


def test_oversized_content_rejected(client):
    from app.models import MAX_CONTENT_LENGTH

    doc_id = client.post("/api/documents", json={}).json()["id"]
    too_big = "<p>" + "a" * MAX_CONTENT_LENGTH + "</p>"
    assert client.patch(f"/api/documents/{doc_id}", json={"content": too_big}).status_code == 422
    assert client.post("/api/documents", json={"content": too_big}).status_code == 422
