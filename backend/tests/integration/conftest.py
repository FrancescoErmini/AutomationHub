import os
from collections.abc import Generator

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine, delete, text
from sqlalchemy.orm import Session

from app.db.session import get_db
from app.dependencies import get_current_user
from app.main import app
from app.models.auth import AppUser
from app.models.item import Item

TEST_DATABASE_URL = os.environ.get(
    "DATABASE_URL",
    "postgresql+psycopg://automation_hub:automation_hub_dev@localhost:5432/automation_hub_test",
)
if TEST_DATABASE_URL.rsplit("/", maxsplit=1)[-1] != "automation_hub_test":
    raise RuntimeError("Integration tests must use the automation_hub_test database")

test_engine = create_engine(TEST_DATABASE_URL)

RPA_SCHEMAS = ("staging", "core", "audit")


@pytest.fixture(autouse=True)
def clean_items() -> Generator[None, None, None]:
    with Session(test_engine) as session:
        session.execute(delete(Item))
        session.commit()
    yield
    with Session(test_engine) as session:
        session.execute(delete(Item))
        session.commit()


def _truncate_rpa_schemas() -> None:
    with test_engine.begin() as connection:
        tables = connection.execute(
            text(
                "SELECT table_schema, table_name FROM information_schema.tables "
                "WHERE table_schema = ANY(:schemas) AND table_type = 'BASE TABLE'"
            ),
            {"schemas": list(RPA_SCHEMAS)},
        ).all()
        if tables:
            qualified = ", ".join(f'{schema}."{name}"' for schema, name in tables)
            connection.execute(text(f"TRUNCATE TABLE {qualified} RESTART IDENTITY CASCADE"))


@pytest.fixture(autouse=True)
def clean_rpa_schemas() -> Generator[None, None, None]:
    _truncate_rpa_schemas()
    yield
    _truncate_rpa_schemas()


@pytest.fixture
def db_session() -> Generator[Session, None, None]:
    with Session(test_engine) as session:
        yield session


@pytest.fixture
def client() -> Generator[TestClient, None, None]:
    def override_db() -> Generator[Session, None, None]:
        with Session(test_engine) as session:
            yield session

    def override_current_user() -> AppUser:
        return AppUser(
            id=1, sub="test-sub", email="test@example.com", name="Test User", role="admin"
        )

    app.dependency_overrides[get_db] = override_db
    app.dependency_overrides[get_current_user] = override_current_user
    with TestClient(app) as test_client:
        yield test_client
    app.dependency_overrides.clear()
