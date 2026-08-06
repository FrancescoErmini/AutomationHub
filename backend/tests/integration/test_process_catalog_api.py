from pathlib import Path

import pytest
from fastapi.testclient import TestClient
from sqlalchemy.orm import Session

from app.ingestion.rpa_pipeline import run_rpa_ingestion

pytestmark = pytest.mark.integration

FIXTURE = Path(__file__).resolve().parents[3] / "data" / "fixtures" / "rpa_sample.xlsx"


def test_list_process_catalog_splits_live_from_pipeline(
    client: TestClient, db_session: Session
) -> None:
    run_rpa_ingestion(db_session, FIXTURE)

    response = client.get("/api/v1/process-catalog")

    assert response.status_code == 200
    items = response.json()
    assert len(items) == 4

    by_title = {item["title"]: item for item in items}
    assert by_title["RPA - Test Alpha"]["department"] == "Finance"
    assert by_title["RPA - Test Alpha"]["is_live"] is True
    assert by_title["RPA - Test Beta"]["department"] == "Supply Chain"
    assert by_title["RPA - Test Beta"]["is_live"] is True
    assert by_title["RPA - Test Delta"]["department"] == "Customer Service"
    assert by_title["RPA - Test Delta"]["is_live"] is True
    assert by_title["rpa - test gamma"]["department"] == "Finance"
    assert by_title["rpa - test gamma"]["is_live"] is False

    live_count = sum(1 for item in items if item["is_live"])
    assert live_count == 3
