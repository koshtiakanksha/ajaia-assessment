"""App-level behavior: request size limit, API docs location, SPA serving."""
from fastapi.testclient import TestClient

from app import main
from app.main import MAX_REQUEST_BYTES, SPAStaticFiles


def test_oversized_request_rejected_before_reading_body(client):
    r = client.post(
        "/api/documents/import",
        content=b"x",
        headers={"content-length": str(MAX_REQUEST_BYTES + 1), "content-type": "multipart/form-data; boundary=x"},
    )
    assert r.status_code == 413


def test_api_docs_live_under_api(client):
    assert client.get("/api/docs").status_code == 200
    assert client.get("/api/openapi.json").status_code == 200


def test_spa_fallback_serves_index_for_client_routes(tmp_path):
    from fastapi import FastAPI

    (tmp_path / "index.html").write_text("<html>app shell</html>")
    (tmp_path / "logo.png").write_bytes(b"png")
    spa = FastAPI()

    @spa.get("/api/health")
    def health():
        return {"status": "ok"}

    spa.mount("/", SPAStaticFiles(directory=tmp_path, html=True))
    c = TestClient(spa)
    assert c.get("/").text == "<html>app shell</html>"
    assert c.get("/docs/42").text == "<html>app shell</html>"  # client-side route
    assert c.get("/logo.png").content == b"png"
    assert c.get("/api/health").json() == {"status": "ok"}  # API routes win
    r = c.get("/api/does-not-exist")
    assert r.status_code == 404  # unknown API paths are not swallowed by the SPA


def test_postgres_urls_are_normalized():
    from app.database import _normalize_url

    assert _normalize_url("postgres://u:p@h/db") == "postgresql+psycopg://u:p@h/db"
    assert _normalize_url("postgresql://u:p@h/db") == "postgresql+psycopg://u:p@h/db"
    assert _normalize_url("sqlite:///./app.db") == "sqlite:///./app.db"
    assert main.FRONTEND_DIST.name == "dist"
