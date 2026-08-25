from pathlib import Path

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import update
from sqlalchemy.orm import Session

from app.ingestion.rpa_pipeline import run_rpa_ingestion
from app.models.core import AmsYear

pytestmark = pytest.mark.integration

FIXTURE = Path(__file__).resolve().parents[3] / "data" / "fixtures" / "rpa_sample.xlsx"


def test_tco_trend_endpoint_returns_a_list_of_year_rows(
    client: TestClient, db_session: Session
) -> None:
    run_rpa_ingestion(db_session, FIXTURE)
    db_session.execute(update(AmsYear).where(AmsYear.ordinal == 1).values(year=2024))
    db_session.execute(update(AmsYear).where(AmsYear.ordinal == 2).values(year=2025))
    db_session.commit()

    response = client.get("/api/v1/executive/tco-trend")

    assert response.status_code == 200
    body = response.json()
    assert [row["year"] for row in body] == [2021, 2024, 2025]
    for row in body:
        assert set(row) == {
            "year",
            "capex_eur",
            "license_eur",
            "infrastructure_eur",
            "ams_eur",
            "total_eur",
        }
