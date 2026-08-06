from pathlib import Path

import pytest
from sqlalchemy.orm import Session

from app.ingestion.rpa_pipeline import run_rpa_ingestion
from app.repositories.analytics import AnalyticsRepository
from app.services.roi import RoiService

pytestmark = pytest.mark.integration

FIXTURE = Path(__file__).resolve().parents[3] / "data" / "fixtures" / "rpa_sample.xlsx"


@pytest.fixture
def service(db_session: Session) -> RoiService:
    run_rpa_ingestion(db_session, FIXTURE)
    return RoiService(AnalyticsRepository(db_session))


def test_kpis_match_the_documented_formulas(service: RoiService) -> None:
    kpis = service.kpis()

    assert kpis["roi_annual_saving_eur"].value == pytest.approx(17715.60)
    assert kpis["roi_capex_eur"].value == pytest.approx(20700.50)
    assert kpis["roi_run_cost_3y_eur"].value == pytest.approx(119000.00)
    assert kpis["roi_tco_3y_eur"].value == pytest.approx(139700.50)
    assert kpis["roi_net_benefit_3y_eur"].value == pytest.approx(17715.60 * 3 - 139700.50)

    expected_1_5y = (17715.60 * 1.5 - 20700.50) / 20700.50 * 100
    assert kpis["roi_1_5y_pct"].value == pytest.approx(expected_1_5y, rel=1e-3)

    expected_5y = (17715.60 * 5 - 20700.50) / 20700.50 * 100
    assert kpis["roi_5y_pct"].value == pytest.approx(expected_5y, rel=1e-3)

    expected_payback = 20700.50 / (17715.60 / 12)
    assert kpis["roi_payback_months"].value == pytest.approx(expected_payback, rel=1e-3)


def test_roi_status_is_improving_when_1_5y_positive_but_3y_full_cost_negative(
    service: RoiService,
) -> None:
    kpis = service.kpis()
    # 1.5y ROI is positive but 3y full-cost ROI (which includes AMS run
    # cost) is negative in the fixture -- "improving", not "on_track".
    assert kpis["roi_status"].value == "improving"


def test_process_summary_computes_payback_and_roi_1_5y_per_process(service: RoiService) -> None:
    summary = {row["process"]: row for row in service.process_summary()}

    alpha = summary["RPA - Test Alpha"]
    assert alpha["capex_eur"] == pytest.approx(12500.00)
    assert alpha["annual_saving_eur"] == pytest.approx(12768.00)
    assert alpha["payback_months"] == pytest.approx(12500.00 / (12768.00 / 12), rel=1e-3)
    assert alpha["roi_1_5y_pct"] == pytest.approx(
        (12768.00 * 1.5 - 12500.00) / 12500.00 * 100, rel=1e-3
    )
    assert alpha["process_tco_available"] is False

    beta = summary["RPA - Test Beta"]
    assert beta["roi_1_5y_pct"] < 0


def test_quick_wins_ranks_the_fastest_payback_process_first(service: RoiService) -> None:
    quick_wins = service.quick_wins()

    assert quick_wins[0]["process"] == "RPA - Test Alpha"
    paybacks = [row["payback_months"] for row in quick_wins]
    assert paybacks == sorted(paybacks)


def test_company_summary_matches_per_company_saving_and_capex(service: RoiService) -> None:
    summary = {row["company"]: row for row in service.company_summary()}

    assert summary["Menarini"]["annual_saving_eur"] == pytest.approx(12768.00)
    assert summary["Codifi"]["annual_saving_eur"] == pytest.approx(4947.60)


def test_cost_stack_returns_capex_and_run_cost_components(service: RoiService) -> None:
    stack = {metric.metric_name: metric for metric in service.cost_stack()}

    assert stack["roi_cost_stack_capex_eur"].value == pytest.approx(20700.50)
    assert stack["roi_cost_stack_ams_1l_cost_eur"].value == pytest.approx(105000.00)
    assert stack["roi_cost_stack_ams_2l_cost_eur"].value == pytest.approx(1000.00)
    assert stack["roi_cost_stack_license_cost_eur"].value == pytest.approx(13000.00)
