"""Simulated authentication.

There are no passwords: signing in with an email creates the user on first
use and stores their id in a signed session cookie. A few demo users are
seeded so reviewers can switch accounts in one click. Swapping this module
for real auth (OAuth, magic links) wouldn't affect the sharing logic, which
only depends on `get_current_user`.
"""
from fastapi import APIRouter, Depends, HTTPException, Request
from sqlmodel import Session, select

from .database import get_session
from .models import LoginRequest, User, UserRead

DEMO_USERS = [
    ("alice@example.com", "Alice Johnson"),
    ("bob@example.com", "Bob Smith"),
    ("carol@example.com", "Carol Lee"),
]

router = APIRouter(prefix="/api")


def get_current_user(request: Request, session: Session = Depends(get_session)) -> User:
    user_id = request.session.get("user_id")
    user = session.get(User, user_id) if isinstance(user_id, int) else None
    if user is None:
        raise HTTPException(status_code=401, detail="Please sign in")
    return user


def get_or_create_user(session: Session, email: str, name: str | None = None) -> User:
    user = session.exec(select(User).where(User.email == email)).first()
    if user is None:
        default_name = email.split("@")[0].replace(".", " ").title()
        user = User(email=email, name=name or default_name)
        session.add(user)
        session.commit()
        session.refresh(user)
    return user


@router.get("/auth/demo-users", response_model=list[UserRead])
def demo_users(session: Session = Depends(get_session)):
    """Public: the seeded accounts shown on the sign-in screen."""
    emails = [email for email, _ in DEMO_USERS]
    users = session.exec(select(User).where(User.email.in_(emails))).all()
    return sorted(users, key=lambda u: emails.index(u.email))


@router.post("/auth/login", response_model=UserRead)
def login(data: LoginRequest, request: Request, session: Session = Depends(get_session)):
    user = get_or_create_user(session, data.email)
    request.session.clear()
    request.session["user_id"] = user.id
    return user


@router.post("/auth/logout", status_code=204)
def logout(request: Request):
    request.session.clear()


@router.get("/auth/me", response_model=UserRead)
def me(user: User = Depends(get_current_user)):
    return user


@router.get("/users", response_model=list[UserRead])
def list_users(user: User = Depends(get_current_user), session: Session = Depends(get_session)):
    """Known users, used for email suggestions in the share dialog."""
    return session.exec(select(User).where(User.id != user.id).order_by(User.name)).all()
