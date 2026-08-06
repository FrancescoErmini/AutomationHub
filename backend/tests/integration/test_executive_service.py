from pathlib import Path

import pytest
from sqlalchemy.orm import Session

from app.ingestion.rpa_pipeline import run_rpa_ingestion
from app.repositories.analytics import AnalyticsRepository
from app.services.executive import ExecutiveService

pytestmark = pytest.mark.integration

FIXTURE = Path(__file__).resolve().parents[3] / "data" / "fixtures" / "rpa_sample.xlsx"


@pytest.fixture
def service(db_session: Session) -> ExecutiveService:
    run_rpa_ingestion(db_session, FIXTURE)
    return ExecutiveService(AnalyticsRepository(db_session))


def test_kpis_computes_annual_saving_from_reference_variable_and_economics(
    service: ExecutiveService,
) -> None:
    kpis = service.kpis()

    saving = kpis["kpi_annual_saving_eur"]
    assert saving.available
    assert saving.value == pytest.approx(17715.60)

    tickets = kpis["kpi_total_tickets"]
    assert tickets.value == 6


def test_kpis_run_cost_and_tco_sum_the_three_run_cost_components(
    service: ExecutiveService,
) -> None:
    kpis = service.kpis()

    # ams_1l (2 years=105000) + ams_2l (1000) + license (1 year=13000)
    run_cost = kpis["kpi_run_cost_3y_eur"]
    assert run_cost.value == pytest.approx(119000.00)
    assert any("AMS 1L" in w for w in run_cost.warnings)
    assert any("license" in w for w in run_cost.warnings)

    tco = kpis["kpi_tco_3y_eur"]
    assert tco.value == pytest.approx(20700.50 + 119000.00)

    net_benefit = kpis["kpi_net_benefit_3y_eur"]
    assert net_benefit.value == pytest.approx(17715.60 * 3 - (20700.50 + 119000.00))


def test_kpis_roi_percentages_match_the_documented_formulas(service: ExecutiveService) -> None:
    kpis = service.kpis()

    roi_1_5y = kpis["kpi_roi_1_5y_ok_pct"]
    assert roi_1_5y.available
    expected_1_5y = (17715.60 * 1.5 - 20700.50) / 20700.50 * 100
    assert roi_1_5y.value == pytest.approx(expected_1_5y, rel=1e-3)

    roi_3y = kpis["kpi_roi_3y_full_cost_pct"]
    tco = 20700.50 + 119000.00
    net_benefit = 17715.60 * 3 - tco
    expected_3y = net_benefit / tco * 100
    assert roi_3y.value == pytest.approx(expected_3y, rel=1e-3)


def test_kpis_mark_shared_cost_metrics_unavailable_under_a_company_filter(
    service: ExecutiveService,
) -> None:
    # AMS 1L and license costs are portfolio-level with no documented
    # per-company allocation rule -- filtering by company must not silently
    # attribute the full portfolio cost to one company, so every metric
    # derived from run_cost_3y_eur becomes unavailable once a company filter
    # is applied, even though the same metrics are available unfiltered.
    kpis = service.kpis(company="Menarini")

    for name in (
        "kpi_run_cost_3y_eur",
        "kpi_tco_3y_eur",
        "kpi_net_benefit_3y_eur",
        "kpi_roi_3y_full_cost_pct",
    ):
        metric = kpis[name]
        assert metric.available is False, name
        assert metric.value is None, name
        assert metric.status == "unavailable", name

    # capex and saving ARE legitimately attributable per company/process.
    assert kpis["kpi_annual_saving_eur"].available
    assert kpis["kpi_roi_1_5y_ok_pct"].available


def test_kpis_are_unavailable_not_zero_when_capex_is_zero(service: ExecutiveService) -> None:
    # A company filter that matches no economics rows drives capex to zero
    # for real, through the actual repository/service stack.
    kpis = service.kpis(company="Nonexistent Co")

    roi_1_5y = kpis["kpi_roi_1_5y_ok_pct"]
    assert roi_1_5y.available is False
    assert roi_1_5y.value is None
    assert roi_1_5y.status == "unavailable"


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
