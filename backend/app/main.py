from contextlib import asynccontextmanager

from fastapi import Depends, FastAPI, File, HTTPException, UploadFile
from sqlmodel import Session, select

from .database import get_session, init_db
from .importers import MAX_UPLOAD_BYTES, FileImportError, convert_to_html, title_from_filename
from .models import (
    MAX_CONTENT_LENGTH,
    Document,
    DocumentCreate,
    DocumentRead,
    DocumentSummary,
    DocumentUpdate,
    utcnow,
)
from .sanitize import sanitize_html


@asynccontextmanager
async def lifespan(app: FastAPI):
    init_db()
    yield


app = FastAPI(title="Ajaia Docs API", lifespan=lifespan)


MAX_DB_ID = 2**63 - 1  # SQLite INTEGER limit; larger ids would overflow (500)


def get_document_or_404(doc_id: int, session: Session) -> Document:
    doc = session.get(Document, doc_id) if 1 <= doc_id <= MAX_DB_ID else None
    if doc is None:
        raise HTTPException(status_code=404, detail="Document not found")
    return doc


@app.get("/api/health")
def health():
    return {"status": "ok"}


@app.get("/api/documents", response_model=list[DocumentSummary])
def list_documents(session: Session = Depends(get_session)):
    return session.exec(select(Document).order_by(Document.updated_at.desc())).all()


@app.post("/api/documents", response_model=DocumentRead, status_code=201)
def create_document(data: DocumentCreate, session: Session = Depends(get_session)):
    doc = Document(title=data.title, content=sanitize_html(data.content))
    session.add(doc)
    session.commit()
    session.refresh(doc)
    return doc


@app.post("/api/documents/import", response_model=DocumentRead, status_code=201)
async def import_document(file: UploadFile = File(...), session: Session = Depends(get_session)):
    """Create a new editable document from an uploaded .txt, .md or .docx file."""
    data = await file.read(MAX_UPLOAD_BYTES + 1)  # read at most limit+1 bytes
    if len(data) > MAX_UPLOAD_BYTES:
        raise HTTPException(status_code=413, detail="File is too large. The limit is 5 MB.")
    filename = file.filename or ""
    try:
        content = sanitize_html(convert_to_html(filename, data))
    except FileImportError as exc:
        raise HTTPException(status_code=400, detail=str(exc))
    if len(content) > MAX_CONTENT_LENGTH:
        raise HTTPException(status_code=413, detail="The converted document is too large to edit.")

    doc = Document(title=title_from_filename(filename), content=content)
    session.add(doc)
    session.commit()
    session.refresh(doc)
    return doc


@app.get("/api/documents/{doc_id}", response_model=DocumentRead)
def get_document(doc_id: int, session: Session = Depends(get_session)):
    return get_document_or_404(doc_id, session)


@app.patch("/api/documents/{doc_id}", response_model=DocumentRead)
def update_document(doc_id: int, data: DocumentUpdate, session: Session = Depends(get_session)):
    doc = get_document_or_404(doc_id, session)
    changed = False
    if data.title is not None and data.title != doc.title:
        doc.title = data.title
        changed = True
    if data.content is not None:
        content = sanitize_html(data.content)
        if content != doc.content:
            doc.content = content
            changed = True
    # Only bump "last edited" (and reorder the list) when something actually changed.
    if changed:
        doc.updated_at = utcnow()
        session.add(doc)
        session.commit()
        session.refresh(doc)
    return doc
