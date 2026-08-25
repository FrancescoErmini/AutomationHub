from datetime import date
from pathlib import Path

import pytest
from sqlalchemy import update
from sqlalchemy.orm import Session

from app.ingestion.rpa_pipeline import run_rpa_ingestion
from app.models.core import AmsYear
from app.repositories.analytics import AnalyticsRepository
from app.services.executive import ExecutiveService
from app.services.simple_ops import SimpleOpsService

pytestmark = pytest.mark.integration

FIXTURE = Path(__file__).resolve().parents[3] / "data" / "fixtures" / "rpa_sample.xlsx"


@pytest.fixture
def service(db_session: Session) -> ExecutiveService:
    run_rpa_ingestion(db_session, FIXTURE)
    simple_ops = SimpleOpsService(AnalyticsRepository(db_session))
    return ExecutiveService(AnalyticsRepository(db_session), simple_ops)


@pytest.fixture
def simple_ops(db_session: Session) -> SimpleOpsService:
    run_rpa_ingestion(db_session, FIXTURE)
    db_session.execute(update(AmsYear).where(AmsYear.ordinal == 1).values(year=2024))
    db_session.execute(update(AmsYear).where(AmsYear.ordinal == 2).values(year=2025))
    db_session.commit()
    return SimpleOpsService(AnalyticsRepository(db_session))


def test_kpis_computes_annual_saving_from_reference_variable_and_economics(
    service: ExecutiveService,
) -> None:
    kpis = service.kpis()

    saving = kpis["kpi_annual_saving_eur"]
    assert saving.available
    assert saving.value == pytest.approx(17715.60)

    tickets = kpis["kpi_total_tickets"]
    assert tickets.value == 6


def test_kpis_expose_spend_vs_saving_headline_metrics(service: ExecutiveService) -> None:
    kpis = service.kpis()

    assert kpis["kpi_annual_saving_eur"].value == pytest.approx(17715.60)
    assert kpis["kpi_total_capex_eur"].value == pytest.approx(20700.50)
    assert kpis["kpi_total_saved_to_date_eur"].available
    assert kpis["kpi_total_spend_to_date_eur"].available
    assert kpis["kpi_net_position_eur"].value == pytest.approx(
        kpis["kpi_total_saved_to_date_eur"].value - kpis["kpi_total_spend_to_date_eur"].value
    )


def test_kpis_mark_spend_metrics_unavailable_under_a_company_filter(
    service: ExecutiveService,
) -> None:
    # AMS 1L and license costs are portfolio-level with no documented
    # per-company allocation rule -- filtering by company must not silently
    # attribute the full portfolio cost to one company, so any metric
    # derived from the portfolio running-cost trend becomes unavailable once
    # a company filter is applied, even though it's available unfiltered.
    kpis = service.kpis(company="Menarini")

    for name in ("kpi_total_spend_to_date_eur", "kpi_net_position_eur"):
        metric = kpis[name]
        assert metric.available is False, name
        assert metric.value is None, name
        assert metric.status == "unavailable", name

    # capex and saving ARE legitimately attributable per company/process.
    assert kpis["kpi_total_capex_eur"].available
    assert kpis["kpi_total_capex_eur"].value == pytest.approx(12500.00)
    assert kpis["kpi_total_saved_to_date_eur"].available


def test_kpis_include_the_full_metric_envelope(service: ExecutiveService) -> None:
    kpis = service.kpis()
    metric = kpis["kpi_annual_saving_eur"]

    assert metric.metric_name == "kpi_annual_saving_eur"
    assert metric.unit == "eur"
    assert metric.status == "ok"
    assert metric.calculated_at is not None
    assert isinstance(metric.filters, dict)
    assert isinstance(metric.warnings, list)


def test_kpis_respect_the_company_filter(service: ExecutiveService) -> None:
    codifi = service.kpis(company="Codifi")
    menarini = service.kpis(company="Menarini")

    assert codifi["kpi_annual_saving_eur"].value == pytest.approx(26.60 * 15.5 * 12)
    assert menarini["kpi_annual_saving_eur"].value == pytest.approx(26.60 * 40 * 12)
    assert codifi["kpi_annual_saving_eur"].filters == {"company": "Codifi"}


def test_saving_trend_is_cumulative_by_process_go_live_month(service: ExecutiveService) -> None:
    trend = service.trends()["saving_by_month"]

    months = [point["period"] for point in trend]
    assert months == sorted(months)
    assert trend[-1]["value"] == pytest.approx(17715.60)
    # cumulative: never decreases
    values = [point["value"] for point in trend]
    assert values == sorted(values)


def test_company_summary_lists_each_company_with_its_own_saving(
    service: ExecutiveService,
) -> None:
    summary = service.company_summary()
    by_name = {row["company"]: row for row in summary}

    assert set(by_name) == {"Menarini", "Codifi"}
    assert by_name["Menarini"]["annual_saving_eur"] == pytest.approx(26.60 * 40 * 12)
    assert by_name["Codifi"]["annual_saving_eur"] == pytest.approx(26.60 * 15.5 * 12)


def test_cost_breakdown_returns_each_run_cost_component(service: ExecutiveService) -> None:
    breakdown = {metric.metric_name: metric for metric in service.cost_breakdown()}

    assert breakdown["cost_breakdown_capex_eur"].value == pytest.approx(20700.50)
    assert breakdown["cost_breakdown_ams_1l_cost_eur"].value == pytest.approx(105000.00)
    assert breakdown["cost_breakdown_ams_2l_cost_eur"].value == pytest.approx(1000.00)
    assert breakdown["cost_breakdown_license_cost_eur"].value == pytest.approx(13000.00)


def test_tco_trend_composes_capex_with_simple_ops_running_cost_components(
    db_session: Session, simple_ops: SimpleOpsService
) -> None:
    service = ExecutiveService(AnalyticsRepository(db_session), simple_ops)

    trend = service.tco_trend()

    assert [row["year"] for row in trend] == [2021, 2024, 2025]
    license_by_year = {p["year"]: p["cost_eur"] for p in simple_ops.license_cost_trend()}
    infra_by_year = {p["year"]: p["cost_eur"] for p in simple_ops.infrastructure()["trend"]}
    ams = simple_ops.ams_trend()
    ams_1l_by_year = {p["year"]: p["cost_eur"] for p in ams["l1"]}
    ams_2l_by_year = {p["year"]: p["cost_eur"] for p in ams["l2"]}

    for row in trend:
        yr = row["year"]
        assert row["license_eur"] == pytest.approx(license_by_year.get(yr, 0.0))
        assert row["infrastructure_eur"] == pytest.approx(infra_by_year.get(yr, 0.0))
        assert row["ams_eur"] == pytest.approx(
            ams_1l_by_year.get(yr, 0.0) + ams_2l_by_year.get(yr, 0.0)
        )
        assert row["total_eur"] == pytest.approx(
            row["capex_eur"] + row["license_eur"] + row["infrastructure_eur"] + row["ams_eur"]
        )


def test_tco_trend_includes_a_year_with_capex_but_no_running_cost_data(
    db_session: Session, simple_ops: SimpleOpsService
) -> None:
    # 2021 has capex (20700.50) but is outside the AMS-year range (2024-2025),
    # so it has no license/infra/AMS data. tco_trend must still surface it --
    # a CIO must see where CAPEX landed even if the running-cost feed doesn't
    # go back that far.
    service = ExecutiveService(AnalyticsRepository(db_session), simple_ops)

    trend = {row["year"]: row for row in service.tco_trend()}

    assert 2021 in trend
    assert trend[2021]["capex_eur"] == pytest.approx(20700.50)
    assert trend[2021]["license_eur"] == pytest.approx(0.0)
    assert trend[2021]["total_eur"] == pytest.approx(20700.50)


def test_savings_payback_trend_accumulates_spend_and_saving_by_year(
    db_session: Session, simple_ops: SimpleOpsService
) -> None:
    service = ExecutiveService(AnalyticsRepository(db_session), simple_ops)

    payback = service.savings_payback_trend()
    tco = service.tco_trend()

    years = [row["year"] for row in tco]
    assert [row["year"] for row in payback] == years

    running_spend = 0.0
    for tco_row, payback_row in zip(tco, payback, strict=True):
        running_spend += tco_row["total_eur"]
        assert payback_row["cumulative_spend_eur"] == pytest.approx(running_spend)
    savings = [row["cumulative_saving_eur"] for row in payback]
    assert savings == sorted(savings)


def test_process_roi_table_computes_expected_and_actual_roi(service: ExecutiveService) -> None:
    rows = {row["process"]: row for row in service.process_roi_table(as_of=date(2026, 6, 1))}

    alpha = rows["RPA - Test Alpha"]
    # go-live 2021-06-01 -> as_of 2026-06-01 is exactly 60 whole months.
    assert alpha["go_live_date"] == date(2021, 6, 1)
    assert alpha["capex_eur"] == pytest.approx(12500.00)
    assert alpha["annual_saving_eur"] == pytest.approx(12768.00)
    expected_cumulative = 12768.00 / 12 * 60
    assert alpha["cumulative_saving_since_go_live_eur"] == pytest.approx(
        expected_cumulative, rel=1e-3
    )
    expected_actual_roi = (expected_cumulative - 12500.00) / 12500.00 * 100
    assert alpha["actual_roi_pct"] == pytest.approx(expected_actual_roi, rel=1e-3)
    expected_roi = (12768.00 * 5 - 12500.00) / 12500.00 * 100  # roi_expected_yr = 5
    assert alpha["expected_roi_pct"] == pytest.approx(expected_roi, rel=1e-3)
    assert alpha["payback_months"] == pytest.approx(12500.00 / (12768.00 / 12), rel=1e-3)


def test_process_roi_table_orders_best_actual_roi_first(service: ExecutiveService) -> None:
    rows = service.process_roi_table(as_of=date(2026, 6, 1))
    scored = [row["actual_roi_pct"] for row in rows if row["actual_roi_pct"] is not None]

    assert scored == sorted(scored, reverse=True)


def test_process_roi_table_never_reports_negative_cumulative_saving(
    service: ExecutiveService,
) -> None:
    # Before any process has gone live, cumulative saving must clamp at 0,
    # never go negative.
    rows = service.process_roi_table(as_of=date(2020, 1, 1))

    for row in rows:
        assert row["cumulative_saving_since_go_live_eur"] >= 0
