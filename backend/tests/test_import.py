import io

import docx
import pytest

from app.importers import MAX_UPLOAD_BYTES


def upload(client, filename, data, content_type="application/octet-stream"):
    return client.post(
        "/api/documents/import", files={"file": (filename, data, content_type)}
    )


def make_docx() -> bytes:
    d = docx.Document()
    d.add_heading("Quarterly Plan", level=1)
    d.add_heading("Deep heading", level=4)
    p = d.add_paragraph("Ship the ")
    p.add_run("bold").bold = True
    p.add_run(" and ")
    p.add_run("italic").italic = True
    p.add_run(" and ")
    p.add_run("underlined").underline = True
    p.add_run(" parts.")
    d.add_paragraph("First bullet", style="List Bullet")
    d.add_paragraph("Second bullet", style="List Bullet")
    d.add_paragraph("Step one", style="List Number")
    buf = io.BytesIO()
    d.save(buf)
    return buf.getvalue()


def test_import_txt_creates_editable_document(client):
    text = "Hello <world> & friends\nsecond line\n\nNew paragraph"
    resp = upload(client, "meeting notes.txt", text.encode())
    assert resp.status_code == 201
    doc = resp.json()
    assert doc["title"] == "meeting notes"
    assert doc["content"] == (
        "<p>Hello &lt;world&gt; &amp; friends<br>second line</p><p>New paragraph</p>"
    )
    # It's a normal document: listed, reopenable and editable.
    assert client.get(f"/api/documents/{doc['id']}").json()["content"] == doc["content"]
    edited = client.patch(f"/api/documents/{doc['id']}", json={"content": "<p>edited</p>"})
    assert edited.status_code == 200


def test_import_markdown_preserves_structure(client):
    md = (
        "# Title\n\nSome **bold**, *italic* and a [link](https://example.com).\n\n"
        "- one\n- two\n\n1. first\n2. second\n\n#### Deep\n\n<script>alert(1)</script>"
    )
    content = upload(client, "README.md", md.encode()).json()["content"]
    for tag in ["<h1>Title</h1>", "<strong>bold</strong>", "<em>italic</em>",
                '<a href="https://example.com"', "<ul>", "<ol>", "<h3>Deep</h3>"]:
        assert tag in content
    assert "<script" not in content


def test_import_docx_preserves_formatting(client):
    resp = upload(client, "Quarterly Plan.docx", make_docx())
    assert resp.status_code == 201
    doc = resp.json()
    assert doc["title"] == "Quarterly Plan"
    content = doc["content"]
    for tag in ["<h1>Quarterly Plan</h1>", "<h3>Deep heading</h3>", "<strong>bold</strong>",
                "<em>italic</em>", "<u>underlined</u>", "<ul><li>First bullet</li><li>Second bullet</li></ul>",
                "<ol><li>Step one</li></ol>"]:
        assert tag in content


def test_import_non_utf8_text_file(client):
    resp = upload(client, "legacy.txt", "café – naïve".encode("cp1252"))
    assert resp.status_code == 201
    assert "café – naïve" in resp.json()["content"]


def test_extension_check_is_case_insensitive(client):
    assert upload(client, "NOTES.TXT", b"hi").status_code == 201


@pytest.mark.parametrize("filename", ["photo.png", "script.js", "noextension", "archive.doc"])
def test_unsupported_type_rejected(client, filename):
    resp = upload(client, filename, b"data")
    assert resp.status_code == 400
    assert "Supported: .txt, .md, .docx" in resp.json()["detail"]


def test_empty_file_rejected(client):
    resp = upload(client, "empty.txt", b"   \n ")
    assert resp.status_code == 400
    assert resp.json()["detail"] == "The file is empty."


def test_corrupt_docx_rejected(client):
    assert upload(client, "fake.docx", b"this is not a zip").status_code == 400
    assert upload(client, "broken.docx", b"PK\x03\x04garbage").status_code == 400


def test_oversized_file_rejected(client):
    resp = upload(client, "big.txt", b"a" * (MAX_UPLOAD_BYTES + 1))
    assert resp.status_code == 413


def test_missing_file_field(client):
    assert client.post("/api/documents/import").status_code == 422


def test_failed_import_creates_no_document(client):
    upload(client, "photo.png", b"data")
    assert client.get("/api/documents").json() == []
