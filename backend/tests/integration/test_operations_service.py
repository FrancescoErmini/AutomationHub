from datetime import date
from pathlib import Path

import pytest
from sqlalchemy.orm import Session

from app.ingestion.rpa_pipeline import run_rpa_ingestion
from app.repositories.analytics import AnalyticsRepository
from app.services.operations import OperationsService

pytestmark = pytest.mark.integration

FIXTURE = Path(__file__).resolve().parents[3] / "data" / "fixtures" / "rpa_sample.xlsx"


@pytest.fixture
def service(db_session: Session) -> OperationsService:
    run_rpa_ingestion(db_session, FIXTURE)
    return OperationsService(AnalyticsRepository(db_session))


def test_kpis_counts_and_ratios(service: OperationsService) -> None:
    kpis = service.kpis()

    assert kpis["ops_total_tickets"].value == 6
    assert kpis["ops_closed_tickets"].value == 5
    assert kpis["ops_open_backlog"].value == 1
    assert kpis["ops_l1_tickets"].value == 5
    assert kpis["ops_l2_tickets"].value == 1
    assert kpis["ops_l1_ratio"].value == pytest.approx(5 / 6, abs=1e-4)
    assert kpis["ops_l2_ratio"].value == pytest.approx(1 / 6, abs=1e-4)


def test_kpis_resolution_stats_match_percentile_cont(service: OperationsService) -> None:
    kpis = service.kpis()

    assert kpis["ops_avg_resolution_days"].value == pytest.approx(1.0)
    assert kpis["ops_median_resolution_days"].value == pytest.approx(1.0)
    assert kpis["ops_p90_resolution_days"].value == pytest.approx(2.2)


def test_kpis_sla_proxy_is_within_3_days_over_closed_with_valid_dates(
    service: OperationsService,
) -> None:
    kpis = service.kpis()

    assert kpis["ops_sla_proxy_le_3d_pct"].value == pytest.approx(100.0)
    assert kpis["ops_sla_breach_pct"].value == pytest.approx(0.0)


def test_kpis_l2_cost_per_ticket_uses_ams_2l_ticket_count_not_the_is_1l_flag(
    service: OperationsService,
) -> None:
    kpis = service.kpis()

    # Both AMS 2L fixture rows are attached to IS_1L=True tickets -- the
    # per-ticket rate must come from AMS-2L-costed ticket count (2), not the
    # IS_1L=False ticket count (1), recovering the source's flat 500 rate.
    assert kpis["ops_l2_cost_per_ticket"].value == pytest.approx(500.0)

    # (105000 ams_1l + 1000 ams_2l + 13000 license) / 6 tickets
    assert kpis["ops_cost_per_ticket"].value == pytest.approx(119000 / 6)


def test_root_cause_pareto_orders_by_ticket_count_descending(service: OperationsService) -> None:
    pareto = service.root_cause_pareto()

    assert pareto[0]["count"] >= pareto[-1]["count"]
    assert {row["root_cause"] for row in pareto} == {"Problema Funzionale RPA", "Evasione SR"}


def test_top_processes_orders_by_ticket_count_descending(service: OperationsService) -> None:
    top = service.top_processes()

    assert top[0]["process"] == "RPA - Test Alpha"
    assert top[0]["ticket_count"] == 2


def test_backlog_aging_buckets_the_open_ticket_by_age(service: OperationsService) -> None:
    aging = service.backlog_aging(as_of=date(2024, 1, 20))

    # ticket id3 started 2024-01-03, still open -> 17 days old at as_of
    assert aging["backlog_over_15_days"] == 1
    assert aging["backlog_0_3_days"] == 0
    assert aging["backlog_4_7_days"] == 0
    assert aging["backlog_8_15_days"] == 0
