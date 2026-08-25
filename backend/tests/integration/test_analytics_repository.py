from datetime import date
from decimal import Decimal
from pathlib import Path

import pytest
from sqlalchemy.orm import Session

from app.ingestion.rpa_pipeline import run_rpa_ingestion
from app.repositories.analytics import AnalyticsRepository

pytestmark = pytest.mark.integration

FIXTURE = Path(__file__).resolve().parents[3] / "data" / "fixtures" / "rpa_sample.xlsx"


@pytest.fixture
def repo(db_session: Session) -> AnalyticsRepository:
    run_rpa_ingestion(db_session, FIXTURE)
    return AnalyticsRepository(db_session)


def test_capex_by_year_buckets_by_process_go_live_year(repo: AnalyticsRepository) -> None:
    # Alpha (go-live 2021-06-01, capex 12500.00) and Beta (go-live 2021-09-03,
    # capex 8200.50) both fall in 2021; Gamma has no ECONOMICS row, Delta has
    # a go-live date but no ECONOMICS row either -- neither contributes capex.
    by_year = repo.capex_by_year()

    assert by_year == {2021: pytest.approx(20700.50)}


def test_capex_by_year_respects_the_company_filter(repo: AnalyticsRepository) -> None:
    menarini = repo.capex_by_year(company="Menarini")
    codifi = repo.capex_by_year(company="Codifi")

    assert menarini == {2021: pytest.approx(12500.00)}
    assert codifi == {2021: pytest.approx(8200.50)}


def test_annual_saving_contribution_by_month_respects_the_company_filter(
    repo: AnalyticsRepository,
) -> None:
    all_companies = repo.annual_saving_contribution_by_month()
    menarini_only = repo.annual_saving_contribution_by_month(company="Menarini")

    assert float(sum((v for _, v in all_companies), Decimal("0"))) == pytest.approx(17715.60)
    assert float(sum((v for _, v in menarini_only), Decimal("0"))) == pytest.approx(26.60 * 40 * 12)


def test_process_roi_rows_includes_go_live_date_and_roi_expected_yr(
    repo: AnalyticsRepository,
) -> None:
    rows = {row[0]: row for row in repo.process_roi_rows()}

    alpha = rows["RPA - Test Alpha"]
    assert alpha[1] == "Menarini"  # company_name
    assert alpha[2] == pytest.approx(Decimal("12500.00"))  # capex_eur
    assert alpha[4] == date(2021, 6, 1)  # go_live_date
    assert alpha[5] == 5  # roi_expected_yr

    beta = rows["RPA - Test Beta"]
    assert beta[4] == date(2021, 9, 3)
    assert beta[5] == 5
