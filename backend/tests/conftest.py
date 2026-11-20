"""
Pytest fixtures for Neeva AI Backend (Phase 2 — Cloud Firestore Operational Database).
Resets the operational Firestore repository before each test and provides deterministic
Firebase Auth token mocking for User A (`user_alice`), User B (`user_bob`), and Moderator (`mod_priya`).
"""
from __future__ import annotations

from collections.abc import AsyncGenerator
from unittest.mock import patch

import pytest
from httpx import ASGITransport, AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession, create_async_engine
from sqlalchemy.orm import sessionmaker

from app.database.firestore_db import get_firestore_repo
from app.database.session import Base, get_db
from app.main import app

TEST_TOKENS: dict[str, dict] = {
    "token_alice": {
        "uid": "firebase_uid_alice_001",
        "email": "alice@neeva.in",
        "name": "Alice Sharma",
        "email_verified": True,
        "role": "user",
    },
    "token_bob": {
        "uid": "firebase_uid_bob_002",
        "email": "bob@neeva.in",
        "name": "Bob Patel",
        "email_verified": True,
        "role": "user",
    },
    "token_moderator": {
        "uid": "firebase_uid_mod_003",
        "email": "mod@neeva.in",
        "name": "Priya Moderator",
        "email_verified": True,
        "role": "moderator",
    },
}


def _mock_verify_firebase_token(id_token: str) -> dict:
    from fastapi import HTTPException, status

    if id_token in TEST_TOKENS:
        return TEST_TOKENS[id_token]
    raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid ID token.")


@pytest.fixture
def anyio_backend():
    return "asyncio"


@pytest.fixture
async def db_session() -> AsyncGenerator[AsyncSession, None]:
    test_engine = create_async_engine("sqlite+aiosqlite:///:memory:", echo=False)
    async with test_engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)

    session_factory = sessionmaker(bind=test_engine, class_=AsyncSession, expire_on_commit=False)
    async with session_factory() as session:
        yield session

    await test_engine.dispose()


@pytest.fixture
async def client(db_session: AsyncSession) -> AsyncGenerator[AsyncClient, None]:
    fs_repo = get_firestore_repo()
    await fs_repo.reset_store()

    async def _override_get_db() -> AsyncGenerator[AsyncSession, None]:
        yield db_session

    app.dependency_overrides[get_db] = _override_get_db
    with patch("app.core.security.verify_firebase_token", side_effect=_mock_verify_firebase_token):
        transport = ASGITransport(app=app)
        async with AsyncClient(transport=transport, base_url="http://testserver") as ac:
            yield ac
    app.dependency_overrides.clear()
