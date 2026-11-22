"""Document, import and sharing endpoints, with permission checks.

Access levels: owner > editor > viewer.
  - viewer: read
  - editor: read + edit content and title
  - owner:  everything, including managing who has access
"""
from typing import Literal, Optional

from fastapi import APIRouter, Depends, File, HTTPException, UploadFile
from sqlmodel import Session, select

from .auth import get_current_user
from .database import get_session
from .importers import MAX_UPLOAD_BYTES, FileImportError, convert_to_html, title_from_filename
from .models import (
    MAX_CONTENT_LENGTH,
    AccessRole,
    Document,
    DocumentCreate,
    DocumentRead,
    DocumentShare,
    DocumentSummary,
    DocumentUpdate,
    ShareCreate,
    ShareRead,
    ShareUpdate,
    SharingInfo,
    User,
    UserRead,
    utcnow,
)
from .sanitize import sanitize_html

router = APIRouter(prefix="/api/documents")

MAX_DB_ID = 2**63 - 1  # SQLite INTEGER limit; larger ids would overflow (500)
Need = Literal["view", "edit", "own"]


# ---------- Permission helpers ----------

def get_role(doc: Document, user: User, session: Session) -> Optional[AccessRole]:
    if doc.owner_id == user.id:
        return "owner"
    share = session.exec(
        select(DocumentShare).where(
            DocumentShare.document_id == doc.id, DocumentShare.email == user.email
        )
    ).first()
    return share.role if share else None


def load_document(doc_id: int, user: User, session: Session, need: Need) -> tuple[Document, AccessRole]:
    """Fetch a document and check the user's access, or raise 404/403."""
    doc = session.get(Document, doc_id) if 1 <= doc_id <= MAX_DB_ID else None
    if doc is None:
        raise HTTPException(status_code=404, detail="Document not found")
    role = get_role(doc, user, session)
    if role is None:
        raise HTTPException(status_code=403, detail="You don't have access to this document")
    if need == "edit" and role == "viewer":
        raise HTTPException(status_code=403, detail="You have view-only access to this document")
    if need == "own" and role != "owner":
        raise HTTPException(status_code=403, detail="Only the owner can manage sharing")
    return doc, role


def to_read(doc: Document, role: AccessRole, session: Session) -> DocumentRead:
    owner = session.get(User, doc.owner_id)
    return DocumentRead(
        id=doc.id, title=doc.title, content=doc.content, role=role,
        owner=UserRead.model_validate(owner), created_at=doc.created_at, updated_at=doc.updated_at,
    )


def sharing_info(doc: Document, session: Session) -> SharingInfo:
    shares = session.exec(
        select(DocumentShare).where(DocumentShare.document_id == doc.id).order_by(DocumentShare.created_at)
    ).all()
    names = {
        u.email: u.name
        for u in session.exec(select(User).where(User.email.in_([s.email for s in shares]))).all()
    }
    return SharingInfo(
        owner=UserRead.model_validate(session.get(User, doc.owner_id)),
        shares=[ShareRead(id=s.id, email=s.email, role=s.role, name=names.get(s.email)) for s in shares],
    )


def save_new_document(session: Session, user: User, title: str, content: str) -> DocumentRead:
    doc = Document(owner_id=user.id, title=title, content=content)
    session.add(doc)
    session.commit()
    session.refresh(doc)
    return to_read(doc, "owner", session)


# ---------- Documents ----------

@router.get("", response_model=list[DocumentSummary])
def list_documents(user: User = Depends(get_current_user), session: Session = Depends(get_session)):
    """Everything the user can open: owned documents plus documents shared with them."""
    owned = session.exec(select(Document).where(Document.owner_id == user.id)).all()
    shared = session.exec(
        select(Document, DocumentShare.role)
        .join(DocumentShare, DocumentShare.document_id == Document.id)
        .where(DocumentShare.email == user.email, Document.owner_id != user.id)
    ).all()
    rows = [(d, "owner") for d in owned] + [(d, role) for d, role in shared]
    owner_ids = {d.owner_id for d, _ in rows}
    owners = {u.id: u for u in session.exec(select(User).where(User.id.in_(owner_ids))).all()}
    rows.sort(key=lambda r: r[0].updated_at, reverse=True)
    return [
        DocumentSummary(id=d.id, title=d.title, updated_at=d.updated_at, role=role,
                        owner=UserRead.model_validate(owners[d.owner_id]))
        for d, role in rows
    ]


@router.post("", response_model=DocumentRead, status_code=201)
def create_document(data: DocumentCreate, user: User = Depends(get_current_user),
                    session: Session = Depends(get_session)):
    return save_new_document(session, user, data.title, sanitize_html(data.content))


@router.post("/import", response_model=DocumentRead, status_code=201)
async def import_document(file: UploadFile = File(...), user: User = Depends(get_current_user),
                          session: Session = Depends(get_session)):
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
    return save_new_document(session, user, title_from_filename(filename), content)


@router.get("/{doc_id}", response_model=DocumentRead)
def get_document(doc_id: int, user: User = Depends(get_current_user),
                 session: Session = Depends(get_session)):
    doc, role = load_document(doc_id, user, session, "view")
    return to_read(doc, role, session)


@router.patch("/{doc_id}", response_model=DocumentRead)
def update_document(doc_id: int, data: DocumentUpdate, user: User = Depends(get_current_user),
                    session: Session = Depends(get_session)):
    doc, role = load_document(doc_id, user, session, "edit")
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
    return to_read(doc, role, session)


# ---------- Sharing (owner only) ----------

@router.get("/{doc_id}/shares", response_model=SharingInfo)
def get_shares(doc_id: int, user: User = Depends(get_current_user),
               session: Session = Depends(get_session)):
    doc, _ = load_document(doc_id, user, session, "own")
    return sharing_info(doc, session)


@router.post("/{doc_id}/shares", response_model=SharingInfo)
def add_shares(doc_id: int, data: ShareCreate, user: User = Depends(get_current_user),
               session: Session = Depends(get_session)):
    """Share with one or more emails. Re-sharing an existing email updates its role."""
    doc, _ = load_document(doc_id, user, session, "own")
    if user.email in data.emails:
        raise HTTPException(status_code=400, detail="You already own this document")
    existing = {
        s.email: s
        for s in session.exec(select(DocumentShare).where(DocumentShare.document_id == doc.id)).all()
    }
    for email in data.emails:
        share = existing.get(email) or DocumentShare(document_id=doc.id, email=email, role=data.role)
        share.role = data.role
        session.add(share)
    session.commit()
    return sharing_info(doc, session)


def _load_share(doc: Document, share_id: int, session: Session) -> DocumentShare:
    share = session.get(DocumentShare, share_id) if 1 <= share_id <= MAX_DB_ID else None
    if share is None or share.document_id != doc.id:
        raise HTTPException(status_code=404, detail="Share not found")
    return share


@router.patch("/{doc_id}/shares/{share_id}", response_model=SharingInfo)
def update_share(doc_id: int, share_id: int, data: ShareUpdate,
                 user: User = Depends(get_current_user), session: Session = Depends(get_session)):
    doc, _ = load_document(doc_id, user, session, "own")
    share = _load_share(doc, share_id, session)
    share.role = data.role
    session.add(share)
    session.commit()
    return sharing_info(doc, session)


@router.delete("/{doc_id}/shares/{share_id}", response_model=SharingInfo)
def revoke_share(doc_id: int, share_id: int, user: User = Depends(get_current_user),
                 session: Session = Depends(get_session)):
    doc, _ = load_document(doc_id, user, session, "own")
    session.delete(_load_share(doc, share_id, session))
    session.commit()
    return sharing_info(doc, session)
