"""Reconciles PostgreSQL-derived metrics against the independent Excel
oracle (tests/oracle/excel_oracle.py), per the brief's "At minimum
reconcile" list. Runs against the real workbook, not the synthetic fixture.

Ingestion of the real ~70MB workbook is expensive (~20s), so this module
ingests once (module-scoped fixture, overriding the per-test truncation
fixture from tests/integration/conftest.py by name) and every test here is
read-only against that shared, already-ingested state.
"""

import os
import sys
from collections.abc import Generator
from pathlib import Path

import pytest
from sqlalchemy import create_engine, func, select, text
from sqlalchemy.orm import Session

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from oracle import excel_oracle  # type: ignore[import-not-found]

from app.ingestion.rpa_pipeline import run_rpa_ingestion
from app.models.core import LicenseCost, Ticket
from app.models.staging import StagingTickets
from app.repositories.analytics import AnalyticsRepository
from app.services.executive import ExecutiveService

pytestmark = pytest.mark.integration

WORKBOOK = Path(__file__).resolve().parents[3] / "data" / "raw" / "RPA - o365.xlsx"

_DATABASE_URL = os.environ.get(
    "DATABASE_URL",
    "postgresql+psycopg://automation_hub:automation_hub_dev@localhost:5432/automation_hub_test",
)
if _DATABASE_URL.rsplit("/", maxsplit=1)[-1] != "automation_hub_test":
    raise RuntimeError("Integration tests must use the automation_hub_test database")
_engine = create_engine(_DATABASE_URL)


def _truncate_rpa_schemas() -> None:
    with _engine.begin() as connection:
        tables = connection.execute(
            text(
                "SELECT table_schema, table_name FROM information_schema.tables "
                "WHERE table_schema = ANY(:schemas) AND table_type = 'BASE TABLE'"
            ),
            {"schemas": ["staging", "core", "audit"]},
        ).all()
        if tables:
            qualified = ", ".join(f'{schema}."{name}"' for schema, name in tables)
            connection.execute(text(f"TRUNCATE TABLE {qualified} RESTART IDENTITY CASCADE"))


@pytest.fixture(autouse=True, scope="module")
def clean_rpa_schemas() -> Generator[None, None, None]:
    """Overrides conftest's per-test fixture of the same name: this module
    ingests once and every test is read-only, so truncation only needs to
    happen once at module start/end."""
    _truncate_rpa_schemas()
    yield
    _truncate_rpa_schemas()


@pytest.fixture(scope="module")
def repo() -> Generator[AnalyticsRepository, None, None]:
    with Session(_engine) as session:
        run_rpa_ingestion(session, WORKBOOK)
        yield AnalyticsRepository(session)


@pytest.fixture(scope="module")
def db_session(repo: AnalyticsRepository) -> Session:
    return repo._session


@pytest.fixture(scope="module")
def oracle_ticket_stats() -> excel_oracle.TicketOracle:
    return excel_oracle.compute_ticket_oracle(WORKBOOK)


def _normalize(label: str) -> str:
    return " ".join(label.split()).strip().casefold()


def test_raw_and_distinct_ticket_count(
    repo: AnalyticsRepository, oracle_ticket_stats: excel_oracle.TicketOracle, db_session: Session
) -> None:
    staging_raw_count = db_session.scalar(select(func.count()).select_from(StagingTickets))

    assert staging_raw_count == oracle_ticket_stats.raw_row_count
    assert repo.ticket_counts().total == oracle_ticket_stats.distinct_ticket_count


def test_open_and_closed_tickets(
    repo: AnalyticsRepository, oracle_ticket_stats: excel_oracle.TicketOracle
) -> None:
    counts = repo.ticket_counts()
    assert counts.open == oracle_ticket_stats.open_count
    assert counts.closed == oracle_ticket_stats.closed_count


def test_l1_and_l2_tickets(
    repo: AnalyticsRepository, oracle_ticket_stats: excel_oracle.TicketOracle
) -> None:
    counts = repo.ticket_counts()
    assert counts.l1 == oracle_ticket_stats.l1_count
    assert counts.l2 == oracle_ticket_stats.l2_count


def test_annual_saving_eur(repo: AnalyticsRepository) -> None:
    expected = excel_oracle.compute_annual_saving_eur(WORKBOOK)
    actual = ExecutiveService(repo).kpis()["kpi_annual_saving_eur"].value
    assert actual == pytest.approx(float(expected), rel=1e-6)


def test_ams_1l_cost_total(repo: AnalyticsRepository) -> None:
    expected = excel_oracle.compute_ams_1l_cost_total(WORKBOOK)
    actual, years_used = repo.ams_1l_cost_recent_years(3)
    assert years_used == 3  # real data has exactly 3 AMS years
    assert actual == expected


def test_ams_2l_cost_total(repo: AnalyticsRepository, db_session: Session) -> None:
    valid_ticket_ids = set(db_session.scalars(select(Ticket.ticket_id)))
    expected = excel_oracle.compute_ams_2l_cost_total(WORKBOOK, valid_ticket_ids=valid_ticket_ids)
    actual = repo.ams_2l_cost_total()
    assert actual == expected


def test_license_cost_by_year(repo: AnalyticsRepository, db_session: Session) -> None:
    expected = excel_oracle.compute_license_cost_by_year(WORKBOOK)

    rows = (
        db_session.execute(
            select(LicenseCost.year, func.sum(LicenseCost.cost_year_eur)).group_by(LicenseCost.year)
        )
        .tuples()
        .all()
    )
    actual: dict[int, object] = dict(rows)

    assert actual == expected


def test_company_totals(
    repo: AnalyticsRepository, oracle_ticket_stats: excel_oracle.TicketOracle
) -> None:
    actual = {_normalize(name): count for name, count in repo.ticket_volume_by_company()}
    assert actual == oracle_ticket_stats.company_totals


def test_process_totals(
    repo: AnalyticsRepository, oracle_ticket_stats: excel_oracle.TicketOracle
) -> None:
    actual = {
        _normalize(name): count for name, count in repo.top_processes_by_ticket_volume(limit=500)
    }
    assert actual == oracle_ticket_stats.process_totals


def test_root_cause_totals(
    repo: AnalyticsRepository, oracle_ticket_stats: excel_oracle.TicketOracle
) -> None:
    actual = {_normalize(name): count for name, count in repo.root_cause_pareto()}
    assert actual == oracle_ticket_stats.root_cause_totals


def test_resolution_day_stats(repo: AnalyticsRepository) -> None:
    oracle_days = sorted(excel_oracle.compute_resolution_days(WORKBOOK))
    assert len(oracle_days) > 0
    oracle_avg = sum(oracle_days) / len(oracle_days)

    stats = repo.resolution_stats()
    assert stats.closed_with_dates == len(oracle_days)
    assert stats.avg_days is not None
    assert float(stats.avg_days) == pytest.approx(oracle_avg, rel=1e-6)
