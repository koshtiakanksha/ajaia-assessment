import pytest


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


def test_links_and_rules_kept_but_unsafe_urls_stripped(client):
    doc_id = client.post("/api/documents", json={}).json()["id"]
    html = (
        '<p><a href="https://example.com" target="_blank">ok</a></p><hr>'
        '<p><a href="javascript:alert(1)">bad</a></p>'
    )
    content = client.patch(f"/api/documents/{doc_id}", json={"content": html}).json()["content"]
    assert 'href="https://example.com"' in content
    assert "<hr>" in content
    assert "javascript:" not in content


def test_out_of_range_id_returns_404_not_500(client):
    assert client.get("/api/documents/99999999999999999999999").status_code == 404
    assert client.get("/api/documents/-1").status_code == 404


def test_noop_update_does_not_bump_updated_at(client):
    doc = client.post("/api/documents", json={"title": "Same"}).json()
    after = client.patch(f"/api/documents/{doc['id']}", json={"title": "Same"}).json()
    assert after["updated_at"] == doc["updated_at"]
    after_empty = client.patch(f"/api/documents/{doc['id']}", json={}).json()
    assert after_empty["updated_at"] == doc["updated_at"]
