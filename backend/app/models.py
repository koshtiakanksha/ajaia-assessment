from datetime import datetime, timezone
from typing import Optional

from pydantic import field_validator
from sqlmodel import Field, SQLModel

MAX_TITLE_LENGTH = 200
MAX_CONTENT_LENGTH = 1_000_000  # ~1 MB of HTML; guards against oversized saves


def utcnow() -> datetime:
    return datetime.now(timezone.utc)


class Document(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    title: str = Field(max_length=MAX_TITLE_LENGTH)
    content: str = ""  # sanitized HTML produced by the TipTap editor
    created_at: datetime = Field(default_factory=utcnow)
    updated_at: datetime = Field(default_factory=utcnow)


def _clean_title(value: Optional[str]) -> Optional[str]:
    if value is None:
        return None
    value = value.strip()
    if not value:
        raise ValueError("Title cannot be empty")
    if len(value) > MAX_TITLE_LENGTH:
        raise ValueError(f"Title must be at most {MAX_TITLE_LENGTH} characters")
    return value


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


class DocumentRead(DocumentSummary):
    content: str
    created_at: datetime
