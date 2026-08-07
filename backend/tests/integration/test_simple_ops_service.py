from datetime import date
from pathlib import Path

import pytest
from sqlalchemy import select, update
from sqlalchemy.orm import Session

from app.ingestion.rpa_pipeline import run_rpa_ingestion
from app.models.core import AmsRfcCost, AmsYear, Process, ProcessSchedule, VmCost
from app.repositories.analytics import AnalyticsRepository
from app.services.simple_ops import SimpleOpsService

pytestmark = pytest.mark.integration

FIXTURE = Path(__file__).resolve().parents[3] / "data" / "fixtures" / "rpa_sample.xlsx"


@pytest.fixture
def service(db_session: Session) -> SimpleOpsService:
    run_rpa_ingestion(db_session, FIXTURE)
    # The ingestion loader never writes ams_year.year (a documented, accepted
    # gap -- see docs/dashboard_costi_running_rpa_data_assessment.md); the real
    # DB has it patched directly, so the fixture is patched the same way here.
    db_session.execute(update(AmsYear).where(AmsYear.ordinal == 1).values(year=2024))
    db_session.execute(update(AmsYear).where(AmsYear.ordinal == 2).values(year=2025))
    db_session.commit()
    return SimpleOpsService(AnalyticsRepository(db_session))


def test_header_kpis_sum_the_four_running_cost_components(service: SimpleOpsService) -> None:
    kpis = service.header_kpis(2024)

    # license (2 VMs x 6500 = 13000) + ams_1l (45000)
    # + (1 2L ticket opened in 2024 x 500) + rfc (0, none seeded)
    assert kpis["kpi_total_running_cost_eur"].value == pytest.approx(13000 + 45000 + 500)
    assert kpis["kpi_license_cost_eur"].value == pytest.approx(13000)
    assert kpis["kpi_licensed_vm_count"].value == 2
    assert kpis["kpi_ams_1l_cost_eur"].value == pytest.approx(45000)
    assert kpis["kpi_ticket_2l_cost_eur"].value == pytest.approx(500)
    assert kpis["kpi_ticket_2l_count"].value == 1
    assert kpis["kpi_change_request_cost_eur"].value == pytest.approx(0)
    assert kpis["kpi_process_count"].value == 5
    assert kpis["kpi_avg_cost_per_process_eur"].value == pytest.approx((13000 + 45000 + 500) / 5)


def test_header_kpis_delta_is_unavailable_with_no_prior_year_data(
    service: SimpleOpsService,
) -> None:
    # 2024 is the fixture's first year -- 2023 has no license/AMS/RFC data at
    # all, so every delta must be reported unavailable, not a fabricated 0%.
    kpis = service.header_kpis(2024)

    assert kpis["kpi_total_running_cost_delta_pct"].available is False
    assert kpis["kpi_total_running_cost_delta_pct"].value is None


def test_header_kpis_delta_is_computed_against_the_prior_year(service: SimpleOpsService) -> None:
    kpis = service.header_kpis(2025)

    # 2025: license 0 (no license rows), ams_1l 60000, no 2L tickets, no RFC.
    assert kpis["kpi_total_running_cost_eur"].value == pytest.approx(60000)
    prior_total = 13000 + 45000 + 500
    expected_delta = (60000 - prior_total) / prior_total * 100
    assert kpis["kpi_total_running_cost_delta_pct"].value == pytest.approx(expected_delta, rel=1e-3)


def test_running_cost_trend_projects_the_year_after_the_last_ams_year(
    service: SimpleOpsService,
) -> None:
    trend = service.running_cost_trend()

    assert [point["year"] for point in trend] == [2024, 2025, 2026]
    assert trend[0]["total_eur"] == pytest.approx(58500)
    assert trend[0]["estimate"] is False
    assert trend[1]["total_eur"] == pytest.approx(60000)
    assert trend[1]["estimate"] is False
    # baseline processes grow 4 -> 5 (step +1) -> projected 6 for 2026;
    # projected total = 60000 * (6 / 5) = 72000
    assert trend[2]["year"] == 2026
    assert trend[2]["total_eur"] == pytest.approx(72000)
    assert trend[2]["estimate"] is True


def test_license_cost_trend_reports_zero_for_years_with_no_license_rows(
    service: SimpleOpsService,
) -> None:
    trend = {point["year"]: point["cost_eur"] for point in service.license_cost_trend()}

    assert trend[2024] == pytest.approx(13000)
    assert trend[2025] == pytest.approx(0)


def test_infrastructure_reports_tbd_when_every_vm_cost_row_is_zero(
    service: SimpleOpsService,
) -> None:
    infra = service.infrastructure()

    assert infra["tbd"] is True
    assert infra["vm_count"] == 2
    assert infra["db_count"] == 5


def test_infrastructure_is_not_tbd_once_a_real_vm_cost_is_seeded(
    service: SimpleOpsService, db_session: Session
) -> None:
    row = db_session.scalar(select(VmCost).where(VmCost.year == 2024))
    assert row is not None
    row.cost_eur = 1200
    db_session.commit()

    infra = service.infrastructure()

    assert infra["tbd"] is False
    assert next(p["cost_eur"] for p in infra["trend"] if p["year"] == 2024) == pytest.approx(1200)


def test_occupancy_heatmap_groups_by_vm_and_time_slot(
    service: SimpleOpsService, db_session: Session
) -> None:
    schedules = db_session.scalars(select(ProcessSchedule)).all()
    assert len(schedules) == 2
    schedules[1].time_slot = "evening"
    db_session.commit()

    heatmap = {row["vm"]: row for row in service.occupancy_heatmap()}

    assert set(heatmap) == {"RPAP21", "RPAP22"}
    rpap21_cells = {cell["slot"]: cell["count"] for cell in heatmap["RPAP21"]["cells"]}
    rpap22_cells = {cell["slot"]: cell["count"] for cell in heatmap["RPAP22"]["cells"]}
    assert rpap21_cells["morning"] == 1
    assert rpap22_cells["evening"] == 1
    assert rpap22_cells["morning"] == 0


def test_ams_trend_uses_actual_2l_cost_not_the_flat_rate(service: SimpleOpsService) -> None:
    trend = service.ams_trend()

    l1_by_year = {p["year"]: p for p in trend["l1"]}
    assert l1_by_year[2024]["cost_eur"] == pytest.approx(45000)
    assert l1_by_year[2024]["process_count"] == 4
    assert l1_by_year[2025]["cost_eur"] == pytest.approx(60000)

    l2_by_year = {p["year"]: p for p in trend["l2"]}
    # Both AMS 2L fixture rows (500 each) are attached to 2024 tickets --
    # actual cost (1000), not the flat 500 x 1-ticket header-KPI rate.
    assert l2_by_year[2024]["cost_eur"] == pytest.approx(1000)
    assert l2_by_year[2024]["ticket_count"] == 2
    assert l2_by_year[2025]["cost_eur"] == pytest.approx(0)


def test_sla_kpis_compute_year_scoped_values_and_status(service: SimpleOpsService) -> None:
    cards = {card["key"]: card for card in service.sla_kpis(2024, as_of=date(2024, 1, 20))}

    # 1 ticket with root_cause "Problema Funzionale RPA" / 5 non-SR tickets
    rpa = cards["rpa_internal_root_cause_pct"]
    assert rpa["value"] == pytest.approx(20.0)
    assert rpa["status"] == "green"

    # 1 open ticket (#3, no end_date) opened 2024, 17 days old as of 2024-01-20
    # (>14d cutoff) / 6 tickets opened in 2024
    backlog = cards["backlog_aging_pct"]
    assert backlog["value"] == pytest.approx(100 / 6, rel=1e-3)
    assert backlog["status"] == "red"

    # 5 of 6 tickets opened in 2024 are L1
    l1 = cards["l1_ratio_pct"]
    assert l1["value"] == pytest.approx(500 / 6, rel=1e-3)
    assert l1["status"] == "green"

    mttr = cards["median_resolution_days"]
    assert mttr["value"] == pytest.approx(1.0)
    # exactly at the "< 1 day" target boundary -> amber, not green
    assert mttr["status"] == "amber"


def test_sla_kpis_are_unavailable_for_a_year_with_no_tickets(service: SimpleOpsService) -> None:
    cards = {card["key"]: card for card in service.sla_kpis(2099)}

    for key in (
        "rpa_internal_root_cause_pct",
        "backlog_aging_pct",
        "l1_ratio_pct",
        "median_resolution_days",
    ):
        assert cards[key]["available"] is False
        assert cards[key]["status"] == "unavailable"


def test_quality_breakdown_labels_null_root_cause_as_unclassified(
    service: SimpleOpsService,
) -> None:
    breakdown = service.quality_breakdown(2024)

    l1_labels = {row["label"] for row in breakdown["l1"]["root_causes"]}
    assert "unclassified" in l1_labels
    assert breakdown["l1"]["total_tickets"] == 5
    sr_plus_incident = breakdown["l1"]["service_request_pct"] + breakdown["l1"]["incident_pct"]
    assert sr_plus_incident == pytest.approx(100.0)


def test_cost_breakdown_by_process_splits_license_by_vm_and_ams1l_evenly(
    service: SimpleOpsService,
) -> None:
    rows = {row["process"]: row for row in service.cost_breakdown_by_process(2024)}

    assert len(rows) == 5
    # process on VM1 alone: license 6500 / 1 process
    alpha = rows["RPA - Test Alpha"]
    assert alpha["license_eur"] == pytest.approx(6500)
    assert alpha["ams_1l_eur"] == pytest.approx(45000 / 5)
    assert alpha["l2_eur"] == pytest.approx(500)
    assert alpha["total_eur"] == pytest.approx(6500 + 45000 / 5 + 500)

    # process with no process_schedule row at all -> €0 license share
    delta = rows["RPA - Test Delta"]
    assert delta["license_eur"] == pytest.approx(0)
    assert delta["ams_1l_eur"] == pytest.approx(45000 / 5)
    assert delta["l2_eur"] == pytest.approx(0)


def test_cost_breakdown_by_process_uses_actual_2l_cost_for_the_2l_ticket_process(
    service: SimpleOpsService, db_session: Session
) -> None:
    only_in_pid = db_session.scalar(
        select(Process).where(Process.canonical_name == "RPA - Only In PID")
    )
    assert only_in_pid is not None

    rows = {row["process"]: row for row in service.cost_breakdown_by_process(2024)}
    assert rows["RPA - Only In PID"]["l2_eur"] == pytest.approx(500)


def test_header_kpis_include_a_seeded_ams_rfc_change_request_cost(
    service: SimpleOpsService, db_session: Session
) -> None:
    db_session.add(AmsRfcCost(year=2024, cost_eur=1200, rfc_ref="RFC-1"))
    db_session.commit()

    kpis = service.header_kpis(2024)

    assert kpis["kpi_change_request_cost_eur"].value == pytest.approx(1200)
    assert kpis["kpi_change_request_count"].value == 1
    assert kpis["kpi_total_running_cost_eur"].value == pytest.approx(13000 + 45000 + 500 + 1200)
