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
            "<p>This document is owned by <strong>Alice</strong>. It's shared with "
            "<strong>Bob</strong> as an <em>editor</em> and <strong>Carol</strong> as a <em>viewer</em>. "
            "Sign in as each of them to see how access changes.</p>"
            "<h2>Try it</h2>"
            '<ul data-type="taskList">'
            '<li data-type="taskItem" data-checked="true"><label><input type="checkbox" checked=""><span></span></label>'
            "<div><p>Open this document</p></div></li>"
            '<li data-type="taskItem" data-checked="false"><label><input type="checkbox"><span></span></label>'
            "<div><p>Click <strong>Share</strong> and invite anyone by email as a viewer or editor</p></div></li>"
            '<li data-type="taskItem" data-checked="false"><label><input type="checkbox"><span></span></label>'
            "<div><p>Import a .txt, .md or .docx file from the documents page</p></div></li>"
            "</ul>"
            "<h2>Formatting, like you'd expect</h2>"
            '<p><span style="font-family: Georgia, serif;">Fonts</span>, '
            '<span style="font-size: 16pt;">sizes</span>, '
            '<span style="color: #1b3fa3;">colors</span>, '
            '<mark data-color="#fff59d" style="background-color: #fff59d; color: inherit;">highlights</mark>, '
            "<strong>bold</strong>, <em>italic</em>, <u>underline</u> and <s>strikethrough</s>.</p>"
            '<p style="text-align: center;">Center, right or justify paragraphs.</p>'
            "<ol><li><p>Numbered lists</p></li><li><p>Bulleted lists and checklists</p></li></ol>"
            "<blockquote><p>Everything saves automatically. There's no Save button.</p></blockquote>"
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
