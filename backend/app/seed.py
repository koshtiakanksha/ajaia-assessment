"""Demo data so the app is explorable right after setup."""
from sqlmodel import Session, select

from .auth import DEMO_USERS, get_or_create_user
from .models import Document, DocumentShare, User


def seed_demo_data(session: Session) -> None:
    if session.exec(select(User)).first() is not None:
        return  # only seed an empty database

    alice, bob, _carol = (get_or_create_user(session, e, n) for e, n in DEMO_USERS)

    welcome = Document(
        owner_id=alice.id,
        title="Welcome to Ajaia Docs",
        content=(
            "<h1>Welcome to Ajaia Docs 👋</h1>"
            "<p>This document is owned by <strong>Alice</strong>. "
            "It's shared with <strong>Bob</strong> as an <em>editor</em> and "
            "<strong>Carol</strong> as a <em>viewer</em>.</p>"
            "<h2>Try it</h2><ul>"
            "<li><p>Sign in as different users (top right) to see how access changes.</p></li>"
            "<li><p>Use <strong>Share</strong> to invite anyone by email.</p></li>"
            "<li><p>Import a .txt, .md or .docx file from the documents page.</p></li>"
            "</ul>"
        ),
    )
    notes = Document(
        owner_id=bob.id,
        title="Team meeting notes",
        content="<h2>Agenda</h2><ol><li><p>Roadmap</p></li><li><p>Hiring</p></li></ol>",
    )
    session.add_all([welcome, notes])
    session.commit()
    session.add_all([
        DocumentShare(document_id=welcome.id, email="bob@example.com", role="editor"),
        DocumentShare(document_id=welcome.id, email="carol@example.com", role="viewer"),
        DocumentShare(document_id=notes.id, email="alice@example.com", role="editor"),
    ])
    session.commit()
