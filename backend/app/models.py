import re
from datetime import datetime, timezone
from typing import Literal, Optional

from pydantic import field_validator
from sqlalchemy import UniqueConstraint
from sqlmodel import Field, SQLModel

MAX_TITLE_LENGTH = 200
MAX_CONTENT_LENGTH = 1_000_000  # ~1 MB of HTML; guards against oversized saves
MAX_EMAIL_LENGTH = 254
MAX_SHARE_EMAILS = 20  # per request

ShareRole = Literal["viewer", "editor"]
AccessRole = Literal["owner", "editor", "viewer"]

_EMAIL_RE = re.compile(r"^[^@\s]+@[^@\s]+\.[^@\s]+$")


def utcnow() -> datetime:
    return datetime.now(timezone.utc)


def normalize_email(value: str) -> str:
    value = value.strip().lower()
    if len(value) > MAX_EMAIL_LENGTH or not _EMAIL_RE.match(value):
        raise ValueError(f"'{value}' is not a valid email address")
    return value


# ---------- Tables ----------

class User(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    email: str = Field(index=True, unique=True, max_length=MAX_EMAIL_LENGTH)
    name: str


class Document(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    owner_id: int = Field(foreign_key="user.id", index=True)
    title: str = Field(max_length=MAX_TITLE_LENGTH)
    content: str = ""  # sanitized HTML produced by the TipTap editor
    created_at: datetime = Field(default_factory=utcnow)
    updated_at: datetime = Field(default_factory=utcnow)


class DocumentShare(SQLModel, table=True):
    """Access granted to an email address.

    Shares are keyed by email, not user id, so a document can be shared with
    someone who has never signed in. They see it as soon as they sign in
    with that email.
    """

    __table_args__ = (UniqueConstraint("document_id", "email"),)

    id: Optional[int] = Field(default=None, primary_key=True)
    document_id: int = Field(foreign_key="document.id", index=True)
    email: str = Field(index=True, max_length=MAX_EMAIL_LENGTH)
    role: str  # ShareRole
    created_at: datetime = Field(default_factory=utcnow)


# ---------- Request / response schemas ----------

def _clean_title(value: Optional[str]) -> Optional[str]:
    if value is None:
        return None
    value = value.strip()
    if not value:
        raise ValueError("Title cannot be empty")
    if len(value) > MAX_TITLE_LENGTH:
        raise ValueError(f"Title must be at most {MAX_TITLE_LENGTH} characters")
    return value


class UserRead(SQLModel):
    id: int
    email: str
    name: str


class LoginRequest(SQLModel):
    email: str

    _normalize = field_validator("email")(normalize_email)


class DocumentCreate(SQLModel):
    title: str = "Untitled document"
    content: str = Field(default="", max_length=MAX_CONTENT_LENGTH)

    _validate_title = field_validator("title")(_clean_title)


class DocumentUpdate(SQLModel):
    title: Optional[str] = None
    content: Optional[str] = Field(default=None, max_length=MAX_CONTENT_LENGTH)

    _validate_title = field_validator("title")(_clean_title)


class DocumentSummary(SQLModel):
    id: int
    title: str
    updated_at: datetime
    role: AccessRole  # the current user's access to this document
    owner: UserRead


class DocumentRead(DocumentSummary):
    content: str
    created_at: datetime


class ShareCreate(SQLModel):
    emails: list[str] = Field(min_length=1, max_length=MAX_SHARE_EMAILS)
    role: ShareRole = "viewer"

    @field_validator("emails")
    @classmethod
    def _normalize_emails(cls, values: list[str]) -> list[str]:
        cleaned = [normalize_email(v) for v in values]
        return list(dict.fromkeys(cleaned))  # de-duplicate, keep order


class ShareUpdate(SQLModel):
    role: ShareRole


class ShareRead(SQLModel):
    id: int
    email: str
    role: ShareRole
    name: Optional[str] = None  # set if this email belongs to a known user


class SharingInfo(SQLModel):
    owner: UserRead
    shares: list[ShareRead]
