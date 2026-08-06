from collections.abc import Generator
from pathlib import Path

import pytest
from fastapi.testclient import TestClient
from sqlalchemy.orm import Session

from app.dependencies import get_rpa_workbook_path
from app.ingestion.rpa_pipeline import run_rpa_ingestion
from app.main import app

pytestmark = pytest.mark.integration

FIXTURE = Path(__file__).resolve().parents[3] / "data" / "fixtures" / "rpa_sample.xlsx"


@pytest.fixture
def seeded_client(db_session: Session, client: TestClient) -> Generator[TestClient, None, None]:
    run_rpa_ingestion(db_session, FIXTURE)
    yield client


def test_metadata_filters_lists_the_ingested_companies(seeded_client: TestClient) -> None:
    response = seeded_client.get("/api/v1/metadata/filters")

    assert response.status_code == 200
    assert set(response.json()["companies"]) == {"Menarini", "Codifi"}


def test_executive_kpis_returns_the_full_metric_envelope(seeded_client: TestClient) -> None:
    response = seeded_client.get("/api/v1/executive/kpis")

    assert response.status_code == 200
    body = response.json()
    saving = body["kpi_annual_saving_eur"]
    assert saving["value"] == pytest.approx(17715.60)
    assert saving["available"] is True
    assert saving["unit"] == "eur"
    assert "calculated_at" in saving


def test_executive_kpis_respects_the_company_query_param(seeded_client: TestClient) -> None:
    response = seeded_client.get("/api/v1/executive/kpis", params={"company": "Codifi"})

    assert response.status_code == 200
    body = response.json()
    assert body["kpi_run_cost_3y_eur"]["available"] is False
    assert body["kpi_annual_saving_eur"]["available"] is True


def test_executive_trends_and_company_summary_and_cost_breakdown(
    seeded_client: TestClient,
) -> None:
    trends = seeded_client.get("/api/v1/executive/trends")
    assert trends.status_code == 200
    assert len(trends.json()["saving_by_month"]) == 2

    summary = seeded_client.get("/api/v1/executive/company-summary")
    assert summary.status_code == 200
    assert {row["company"] for row in summary.json()} == {"Menarini", "Codifi"}

    breakdown = seeded_client.get("/api/v1/executive/cost-breakdown")
    assert breakdown.status_code == 200
    assert len(breakdown.json()) == 4


def test_operations_endpoints(seeded_client: TestClient) -> None:
    kpis = seeded_client.get("/api/v1/operations/kpis")
    assert kpis.status_code == 200
    assert kpis.json()["ops_total_tickets"]["value"] == 6

    trend = seeded_client.get("/api/v1/operations/support-level-trend")
    assert trend.status_code == 200

    pareto = seeded_client.get("/api/v1/operations/root-cause-pareto")
    assert pareto.status_code == 200
    assert len(pareto.json()) == 2

    top = seeded_client.get("/api/v1/operations/top-processes")
    assert top.status_code == 200
    assert top.json()[0]["process"] == "RPA - Test Alpha"

    aging = seeded_client.get("/api/v1/operations/backlog-aging", params={"as_of": "2024-01-20"})
    assert aging.status_code == 200
    assert aging.json()["backlog_over_15_days"] == 1


def test_roi_endpoints(seeded_client: TestClient) -> None:
    kpis = seeded_client.get("/api/v1/roi/kpis")
    assert kpis.status_code == 200
    assert kpis.json()["roi_status"]["value"] == "improving"

    processes = seeded_client.get("/api/v1/roi/processes")
    assert processes.status_code == 200
    assert len(processes.json()) == 2

    companies = seeded_client.get("/api/v1/roi/companies")
    assert companies.status_code == 200

    quick_wins = seeded_client.get("/api/v1/roi/quick-wins")
    assert quick_wins.status_code == 200
    assert quick_wins.json()[0]["process"] == "RPA - Test Alpha"

    cost_stack = seeded_client.get("/api/v1/roi/cost-stack")
    assert cost_stack.status_code == 200
    assert len(cost_stack.json()) == 4


def test_service_performance_endpoints(seeded_client: TestClient) -> None:
    kpis = seeded_client.get("/api/v1/service-performance/kpis", params={"as_of": "2024-01-20"})
    assert kpis.status_code == 200
    assert kpis.json()["sla_compliance_pct"]["value"] == pytest.approx(100.0)

    trend = seeded_client.get("/api/v1/service-performance/sla-trend")
    assert trend.status_code == 200

    resolution = seeded_client.get("/api/v1/service-performance/resolution")
    assert resolution.status_code == 200
    assert "by_root_cause" in resolution.json()

    dq = seeded_client.get("/api/v1/service-performance/data-quality")
    assert dq.status_code == 200
    assert len(dq.json()) == 3


def test_admin_ingestion_trigger_and_batch_lookup(client: TestClient) -> None:
    app.dependency_overrides[get_rpa_workbook_path] = lambda: FIXTURE
    try:
        triggered = client.post("/api/v1/admin/ingestion")
        assert triggered.status_code == 201
        body = triggered.json()
        assert body["core_counts"]["process"] == 5
        assert len(body["relationships"]) == 8
        batch_id = body["batch_id"]

        batch = client.get(f"/api/v1/admin/ingestion/{batch_id}")
        assert batch.status_code == 200
        assert batch.json()["status"] == "completed"

        relationships = client.get("/api/v1/admin/relationships")
        assert relationships.status_code == 200
        assert len(relationships.json()) == 8

        dq = client.get("/api/v1/admin/data-quality")
        assert dq.status_code == 200
    finally:
        del app.dependency_overrides[get_rpa_workbook_path]


def test_admin_ingestion_batch_not_found_returns_404(client: TestClient) -> None:
    response = client.get("/api/v1/admin/ingestion/999999")
    assert response.status_code == 404
    assert response.json()["error"]["code"] == "not_found"
