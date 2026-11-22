import pytest
from sqlmodel import Session, select

from app.models import Document, DocumentShare, User
from app.seed import seed_demo_data

ALICE, BOB, CAROL = "alice@example.com", "bob@example.com", "carol@example.com"


def new_doc(client, title="Doc"):
    return client.post("/api/documents", json={"title": title}).json()["id"]


def share(client, doc_id, emails, role="viewer"):
    return client.post(f"/api/documents/{doc_id}/shares", json={"emails": emails, "role": role})


def share_id_for(client, doc_id, email):
    shares = client.get(f"/api/documents/{doc_id}/shares").json()["shares"]
    return next(s["id"] for s in shares if s["email"] == email)


# ---------- Auth ----------

def test_endpoints_require_sign_in(make_client):
    anon = make_client(None)
    assert anon.get("/api/auth/me").status_code == 401
    assert anon.get("/api/documents").status_code == 401
    assert anon.post("/api/documents", json={}).status_code == 401
    assert anon.get("/api/documents/1").status_code == 401
    assert anon.patch("/api/documents/1", json={"title": "x"}).status_code == 401
    assert anon.get("/api/documents/1/shares").status_code == 401
    assert anon.post("/api/documents/import", files={"file": ("a.txt", b"hi")}).status_code == 401
    assert anon.get("/api/health").status_code == 200  # public


def test_login_normalizes_email_and_reuses_user(make_client):
    c = make_client(None)
    first = c.post("/api/auth/login", json={"email": "  Dave.Smith@Example.COM "}).json()
    assert first["email"] == "dave.smith@example.com"
    assert first["name"] == "Dave Smith"
    again = c.post("/api/auth/login", json={"email": "dave.smith@example.com"}).json()
    assert again["id"] == first["id"]
    assert c.get("/api/auth/me").json()["email"] == "dave.smith@example.com"


@pytest.mark.parametrize("email", ["", "not-an-email", "a@b", "two@@x.com", "sp ace@x.com"])
def test_login_rejects_invalid_email(make_client, email):
    assert make_client(None).post("/api/auth/login", json={"email": email}).status_code == 422


def test_logout_ends_session(client):
    assert client.post("/api/auth/logout").status_code == 204
    assert client.get("/api/auth/me").status_code == 401


def test_tampered_session_cookie_is_rejected(make_client):
    c = make_client(ALICE)
    c.cookies.set("ajaia_session", c.cookies.get("ajaia_session")[:-4] + "AAAA")
    assert c.get("/api/auth/me").status_code == 401


def test_users_endpoint_lists_others_for_suggestions(make_client):
    make_client(BOB)
    alice = make_client(ALICE)
    emails = [u["email"] for u in alice.get("/api/users").json()]
    assert emails == [BOB]


# ---------- Ownership & listing ----------

def test_new_and_imported_docs_are_owned_by_creator(client):
    created = client.post("/api/documents", json={"title": "Mine"}).json()
    imported = client.post("/api/documents/import", files={"file": ("n.txt", b"hi")}).json()
    for doc in (created, imported):
        assert doc["role"] == "owner"
        assert doc["owner"]["email"] == ALICE


def test_list_separates_owned_and_shared(make_client):
    alice, bob = make_client(ALICE), make_client(BOB)
    a_doc = new_doc(alice, "Alice's")
    b_doc = new_doc(bob, "Bob's")
    share(bob, b_doc, [ALICE], "editor")

    listed = {d["id"]: d for d in alice.get("/api/documents").json()}
    assert listed[a_doc]["role"] == "owner"
    assert listed[b_doc]["role"] == "editor"
    assert listed[b_doc]["owner"]["email"] == BOB
    # Bob doesn't see Alice's unshared doc.
    assert a_doc not in [d["id"] for d in bob.get("/api/documents").json()]


# ---------- Permission enforcement ----------

def test_no_access_without_share(make_client):
    alice, bob = make_client(ALICE), make_client(BOB)
    doc_id = new_doc(alice)
    r = bob.get(f"/api/documents/{doc_id}")
    assert r.status_code == 403
    assert r.json()["detail"] == "You don't have access to this document"
    assert bob.patch(f"/api/documents/{doc_id}", json={"title": "hack"}).status_code == 403


def test_viewer_can_read_but_not_edit(make_client):
    alice, bob = make_client(ALICE), make_client(BOB)
    doc_id = new_doc(alice, "Read me")
    share(alice, doc_id, [BOB], "viewer")

    doc = bob.get(f"/api/documents/{doc_id}").json()
    assert doc["role"] == "viewer" and doc["title"] == "Read me"
    r = bob.patch(f"/api/documents/{doc_id}", json={"content": "<p>changed</p>"})
    assert r.status_code == 403
    assert r.json()["detail"] == "You have view-only access to this document"
    assert alice.get(f"/api/documents/{doc_id}").json()["content"] == ""


def test_editor_can_edit_but_not_manage_sharing(make_client):
    alice, bob = make_client(ALICE), make_client(BOB)
    doc_id = new_doc(alice)
    share(alice, doc_id, [BOB], "editor")

    r = bob.patch(f"/api/documents/{doc_id}", json={"title": "Bob renamed", "content": "<p>by bob</p>"})
    assert r.status_code == 200
    assert alice.get(f"/api/documents/{doc_id}").json()["content"] == "<p>by bob</p>"

    assert bob.get(f"/api/documents/{doc_id}/shares").status_code == 403
    assert share(bob, doc_id, [CAROL], "editor").status_code == 403
    sid = share_id_for(alice, doc_id, BOB)
    assert bob.patch(f"/api/documents/{doc_id}/shares/{sid}", json={"role": "editor"}).status_code == 403
    assert bob.delete(f"/api/documents/{doc_id}/shares/{sid}").status_code == 403


# ---------- Share management ----------

def test_share_with_multiple_people_at_once(make_client):
    alice = make_client(ALICE)
    doc_id = new_doc(alice)
    r = share(alice, doc_id, [BOB, " Carol@Example.com ", BOB], "editor")
    assert r.status_code == 200
    info = r.json()
    assert info["owner"]["email"] == ALICE
    assert [(s["email"], s["role"]) for s in info["shares"]] == [(BOB, "editor"), (CAROL, "editor")]


def test_share_with_email_that_has_never_signed_in(make_client):
    alice = make_client(ALICE)
    doc_id = new_doc(alice, "For a newcomer")
    info = share(alice, doc_id, ["newcomer@partner.org"], "viewer").json()
    assert info["shares"][0]["name"] is None  # not a known user yet

    newcomer = make_client("newcomer@partner.org")  # first sign-in
    listed = newcomer.get("/api/documents").json()
    assert [(d["title"], d["role"]) for d in listed] == [("For a newcomer", "viewer")]
    # Their name now shows in the owner's share list.
    assert alice.get(f"/api/documents/{doc_id}/shares").json()["shares"][0]["name"] == "Newcomer"


def test_resharing_updates_role_instead_of_duplicating(make_client):
    alice = make_client(ALICE)
    doc_id = new_doc(alice)
    share(alice, doc_id, [BOB], "viewer")
    shares = share(alice, doc_id, [BOB], "editor").json()["shares"]
    assert [(s["email"], s["role"]) for s in shares] == [(BOB, "editor")]


def test_change_role_takes_effect_immediately(make_client):
    alice, bob = make_client(ALICE), make_client(BOB)
    doc_id = new_doc(alice)
    share(alice, doc_id, [BOB], "viewer")
    assert bob.patch(f"/api/documents/{doc_id}", json={"title": "x"}).status_code == 403

    sid = share_id_for(alice, doc_id, BOB)
    assert alice.patch(f"/api/documents/{doc_id}/shares/{sid}", json={"role": "editor"}).status_code == 200
    assert bob.patch(f"/api/documents/{doc_id}", json={"title": "x"}).status_code == 200


def test_revoke_removes_access(make_client):
    alice, bob = make_client(ALICE), make_client(BOB)
    doc_id = new_doc(alice)
    share(alice, doc_id, [BOB], "editor")
    sid = share_id_for(alice, doc_id, BOB)

    assert alice.delete(f"/api/documents/{doc_id}/shares/{sid}").json()["shares"] == []
    assert bob.get(f"/api/documents/{doc_id}").status_code == 403
    assert doc_id not in [d["id"] for d in bob.get("/api/documents").json()]


def test_cannot_share_with_yourself(client):
    doc_id = new_doc(client)
    r = share(client, doc_id, ["ALICE@example.com"])
    assert r.status_code == 400
    assert r.json()["detail"] == "You already own this document"


@pytest.mark.parametrize(
    "body",
    [
        {"emails": [], "role": "viewer"},
        {"emails": ["not-an-email"], "role": "viewer"},
        {"emails": [BOB], "role": "owner"},
        {"emails": [BOB], "role": "admin"},
        {"emails": [f"u{i}@x.com" for i in range(21)], "role": "viewer"},
    ],
)
def test_invalid_share_requests_rejected(client, body):
    doc_id = new_doc(client)
    assert client.post(f"/api/documents/{doc_id}/shares", json=body).status_code == 422


def test_share_ids_are_scoped_to_their_document(make_client):
    alice = make_client(ALICE)
    doc_a, doc_b = new_doc(alice), new_doc(alice)
    share(alice, doc_a, [BOB])
    sid = share_id_for(alice, doc_a, BOB)
    # Using doc_a's share id under doc_b must not touch it.
    assert alice.delete(f"/api/documents/{doc_b}/shares/{sid}").status_code == 404
    assert alice.delete(f"/api/documents/{doc_a}/shares/999").status_code == 404
    assert len(alice.get(f"/api/documents/{doc_a}/shares").json()["shares"]) == 1


# ---------- Seed data ----------

def test_seed_creates_demo_users_and_shared_docs_once(engine):
    with Session(engine) as s:
        seed_demo_data(s)
        seed_demo_data(s)  # idempotent
        assert sorted(u.email for u in s.exec(select(User)).all()) == [ALICE, BOB, CAROL]
        assert len(s.exec(select(Document)).all()) == 2
        roles = {(sh.email, sh.role) for sh in s.exec(select(DocumentShare)).all()}
        assert roles == {(BOB, "editor"), (CAROL, "viewer"), (ALICE, "editor")}


def test_demo_users_endpoint_is_public(engine, make_client):
    with Session(engine) as s:
        seed_demo_data(s)
    users = make_client(None).get("/api/auth/demo-users").json()
    assert [u["email"] for u in users] == [ALICE, BOB, CAROL]
