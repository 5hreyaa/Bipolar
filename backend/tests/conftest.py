import os
from typing import Dict, Generator

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import text
from sqlalchemy.orm import Session, sessionmaker

from app.config import get_settings
from app.database import Base, build_engine, get_db
from app.main import app
from app.models.snack import Snack, SnackCategory
from app.models.user import User, UserRole
from app.services.auth import create_access_token, hash_password


@pytest.fixture()
def db_engine(tmp_path):
    settings = get_settings()
    if settings.TEST_DATABASE_URL:
        engine = build_engine(settings.TEST_DATABASE_URL)
        Base.metadata.drop_all(bind=engine)
        Base.metadata.create_all(bind=engine)
        yield engine
        Base.metadata.drop_all(bind=engine)
        engine.dispose()
    else:
        db_file = tmp_path / "test_snack_overflow.db"
        engine = build_engine(f"sqlite:///{db_file}")
        Base.metadata.create_all(bind=engine)
        yield engine
        Base.metadata.drop_all(bind=engine)
        engine.dispose()


@pytest.fixture()
def session_factory(db_engine):
    return sessionmaker(autocommit=False, autoflush=False, bind=db_engine, class_=Session)


@pytest.fixture()
def db_session(session_factory) -> Generator[Session, None, None]:
    session = session_factory()
    try:
        yield session
    finally:
        session.close()


@pytest.fixture()
def client(session_factory) -> Generator[TestClient, None, None]:
    def override_get_db() -> Generator[Session, None, None]:
        db = session_factory()
        try:
            yield db
        finally:
            db.close()

    app.dependency_overrides[get_db] = override_get_db
    with TestClient(app) as test_client:
        yield test_client
    app.dependency_overrides.clear()


@pytest.fixture()
def admin_user(db_session: Session) -> User:
    user = User(
        name="Test Admin",
        email="admin@test.com",
        password_hash=hash_password("adminpass123"),
        role=UserRole.ADMIN.value,
    )
    db_session.add(user)
    db_session.commit()
    db_session.refresh(user)
    return user


@pytest.fixture()
def member_user(db_session: Session) -> User:
    user = User(
        name="Test Member",
        email="member@test.com",
        password_hash=hash_password("memberpass123"),
        role=UserRole.MEMBER.value,
    )
    db_session.add(user)
    db_session.commit()
    db_session.refresh(user)
    return user


@pytest.fixture()
def second_member(db_session: Session) -> User:
    user = User(
        name="Second Member",
        email="member2@test.com",
        password_hash=hash_password("memberpass123"),
        role=UserRole.MEMBER.value,
    )
    db_session.add(user)
    db_session.commit()
    db_session.refresh(user)
    return user


@pytest.fixture()
def admin_headers(admin_user: User) -> Dict[str, str]:
    token = create_access_token(admin_user)
    return {"Authorization": f"Bearer {token}"}


@pytest.fixture()
def member_headers(member_user: User) -> Dict[str, str]:
    token = create_access_token(member_user)
    return {"Authorization": f"Bearer {token}"}


@pytest.fixture()
def second_member_headers(second_member: User) -> Dict[str, str]:
    token = create_access_token(second_member)
    return {"Authorization": f"Bearer {token}"}


@pytest.fixture()
def seeded_snacks(db_session: Session) -> list[Snack]:
    snacks = [
        Snack(name="Almond Chocolate", category=SnackCategory.SWEET.value, quantity=12, low_stock_threshold=5),
        Snack(name="Spicy Chips", category=SnackCategory.SAVOURY.value, quantity=3, low_stock_threshold=5),
        Snack(name="Oat Latte", category=SnackCategory.DRINK.value, quantity=0, low_stock_threshold=4),
        Snack(name="Protein Bar", category=SnackCategory.HEALTHY_ISH.value, quantity=8, low_stock_threshold=5),
    ]
    db_session.add_all(snacks)
    db_session.commit()
    for s in snacks:
        db_session.refresh(s)
    return snacks

