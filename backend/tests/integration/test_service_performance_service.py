from datetime import date
from pathlib import Path

import pytest
from sqlalchemy.orm import Session

from app.ingestion.rpa_pipeline import run_rpa_ingestion
from app.repositories.analytics import AnalyticsRepository
from app.services.service_performance import ServicePerformanceService

pytestmark = pytest.mark.integration

FIXTURE = Path(__file__).resolve().parents[3] / "data" / "fixtures" / "rpa_sample.xlsx"


@pytest.fixture
def service(db_session: Session) -> ServicePerformanceService:
    run_rpa_ingestion(db_session, FIXTURE)
    return ServicePerformanceService(AnalyticsRepository(db_session))


def test_kpis_sla_and_resolution(service: ServicePerformanceService) -> None:
    kpis = service.kpis(as_of=date(2024, 1, 20))

    assert kpis["sla_compliance_pct"].value == pytest.approx(100.0)
    assert kpis["sla_breach_pct"].value == pytest.approx(0.0)
    assert kpis["sla_breach_tickets"].value == 0
    assert kpis["sla_p90_resolution_days"].value == pytest.approx(2.2)


def test_kpis_backlog_buckets_the_one_open_ticket(service: ServicePerformanceService) -> None:
    kpis = service.kpis(as_of=date(2024, 1, 20))

    assert kpis["backlog_over_15_days"].value == 1
    assert kpis["backlog_0_3_days"].value == 0
    assert kpis["backlog_4_7_days"].value == 0
    assert kpis["backlog_8_15_days"].value == 0


def test_kpis_data_quality_percentages(service: ServicePerformanceService) -> None:
    kpis = service.kpis(as_of=date(2024, 1, 20))

    assert kpis["dq_root_cause_not_classified_pct"].value == pytest.approx(4 / 6 * 100, abs=1e-2)
    assert kpis["dq_tickets_without_process_mapping_pct"].value == pytest.approx(
        1 / 6 * 100, abs=1e-2
    )
    assert kpis["dq_tickets_without_company_pct"].value == pytest.approx(0.0)


def test_avg_resolution_by_root_cause(service: ServicePerformanceService) -> None:
    rows = {row["label"]: row["avg_days"] for row in service.avg_resolution_by_root_cause()}

    assert rows["Evasione SR"] == pytest.approx(0.0)
    assert rows["Problema Funzionale RPA"] == pytest.approx(1.0)


def test_avg_resolution_by_process(service: ServicePerformanceService) -> None:
    rows = {row["label"]: row["avg_days"] for row in service.avg_resolution_by_process()}

    assert rows["RPA - Test Alpha"] == pytest.approx(0.5)
    assert rows["RPA - Test Beta"] == pytest.approx(3.0)


def test_avg_resolution_by_company(service: ServicePerformanceService) -> None:
    rows = {row["label"]: row["avg_days"] for row in service.avg_resolution_by_company()}

    assert rows["Menarini"] == pytest.approx((1 + 1 + 0) / 3)
    assert rows["Codifi"] == pytest.approx((3 + 0) / 2)


def test_data_quality_summary_bundles_the_three_dq_percentages(
    service: ServicePerformanceService,
) -> None:
    summary = service.data_quality_summary()

    names = {metric.metric_name for metric in summary}
    assert names == {
        "dq_root_cause_not_classified_pct",
        "dq_tickets_without_process_mapping_pct",
        "dq_tickets_without_company_pct",
    }
