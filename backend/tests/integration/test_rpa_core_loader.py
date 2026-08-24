from decimal import Decimal
from pathlib import Path

import pytest
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.ingestion.rpa_core_loader import load_core_from_staging
from app.ingestion.rpa_staging_loader import load_staging_from_workbook
from app.models.audit import DataQualityIssue
from app.models.core import (
    Ams1LCost,
    Ams2LCost,
    AmsYear,
    Application,
    Company,
    Department,
    LicenseCost,
    Priority,
    Process,
    ProcessApplication,
    ProcessEconomics,
    ProcessSchedule,
    ReferenceVariable,
    RootCause,
    SupportLevel,
    Ticket,
    VirtualMachine,
    VmCost,
)
from app.models.staging import StagingEconomics

pytestmark = pytest.mark.integration

FIXTURE = Path(__file__).resolve().parents[3] / "data" / "fixtures" / "rpa_sample.xlsx"


def _count(session: Session, model: type) -> int:
    result = session.scalar(select(func.count()).select_from(model))
    assert result is not None
    return result


def _load_fixture(session: Session) -> int:
    staging_result = load_staging_from_workbook(session, FIXTURE)
    load_core_from_staging(session, staging_result.batch_id)
    return staging_result.batch_id


def test_core_load_populates_dimension_tables_from_the_fixture(db_session: Session) -> None:
    _load_fixture(db_session)

    assert _count(db_session, Company) == 2
    assert _count(db_session, Department) == 3
    assert _count(db_session, RootCause) == 2
    assert _count(db_session, Priority) == 1
    assert _count(db_session, SupportLevel) == 2
    assert _count(db_session, AmsYear) == 2
    assert _count(db_session, VirtualMachine) == 2
    assert _count(db_session, Application) == 4
    assert _count(db_session, Process) == 5


def test_core_load_sets_ams_year_calendar_year(db_session: Session) -> None:
    """AmsYear.year drives every year-keyed trend chart (running cost,
    license cost, infra, AMS 1L/2L) -- it must be set on every load, not just
    once by row id, since a full rebuild reissues AmsYear ids."""
    _load_fixture(db_session)

    years_by_code = dict(db_session.execute(select(AmsYear.code, AmsYear.year)).tuples().all())
    assert years_by_code == {"1st": 2024, "2nd": 2025}


def test_core_load_deduplicates_tickets_and_logs_the_duplicate(db_session: Session) -> None:
    _load_fixture(db_session)

    assert _count(db_session, Ticket) == 6

    duplicate_issues = (
        db_session.execute(
            select(DataQualityIssue).where(DataQualityIssue.issue_type == "duplicate_ticket_id")
        )
        .scalars()
        .all()
    )
    assert len(duplicate_issues) == 1
    assert "I240106_000006" in duplicate_issues[0].message


def test_core_load_leaves_process_unmatched_ticket_process_null(db_session: Session) -> None:
    _load_fixture(db_session)

    ticket = db_session.scalar(select(Ticket).where(Ticket.ticket_id == "I240105_000005"))
    assert ticket is not None
    assert ticket.process_id is None


def test_core_load_links_matched_ticket_to_process_and_support_level(db_session: Session) -> None:
    _load_fixture(db_session)

    ticket_1l = db_session.scalar(select(Ticket).where(Ticket.ticket_id == "I240101_000001"))
    ticket_2l = db_session.scalar(select(Ticket).where(Ticket.ticket_id == "I240102_000002"))
    assert ticket_1l is not None and ticket_2l is not None

    process = db_session.get(Process, ticket_1l.process_id)
    assert process is not None
    assert process.canonical_name == "RPA - Test Alpha"

    support_1l = db_session.get(SupportLevel, ticket_1l.support_level_id)
    support_2l = db_session.get(SupportLevel, ticket_2l.support_level_id)
    assert support_1l is not None and support_1l.code == "1L"
    assert support_2l is not None and support_2l.code == "2L"


def test_core_load_populates_fact_tables(db_session: Session) -> None:
    _load_fixture(db_session)

    assert _count(db_session, ProcessEconomics) == 2
    assert _count(db_session, Ams1LCost) == 2
    assert _count(db_session, Ams2LCost) == 2
    assert _count(db_session, LicenseCost) == 2
    assert _count(db_session, ProcessSchedule) == 2

    variable = db_session.scalar(
        select(ReferenceVariable).where(ReferenceVariable.name == "cost_per_hour_FTE")
    )
    assert variable is not None
    assert variable.value == Decimal("26.6000")


def test_core_load_mirrors_license_cost_into_vm_cost_at_zero(db_session: Session) -> None:
    _load_fixture(db_session)

    license_pairs = set(
        db_session.execute(select(LicenseCost.year, LicenseCost.virtual_machine_id)).tuples().all()
    )
    vm_cost_rows = db_session.execute(
        select(VmCost.year, VmCost.virtual_machine_id, VmCost.cost_eur)
    ).all()

    assert len(vm_cost_rows) == len(license_pairs)
    assert {(year, vm_id) for year, vm_id, _ in vm_cost_rows} == license_pairs
    assert all(cost_eur == 0 for _, _, cost_eur in vm_cost_rows)


def test_core_load_defaults_process_schedule_time_slot_to_morning(db_session: Session) -> None:
    _load_fixture(db_session)

    time_slots = db_session.scalars(select(ProcessSchedule.time_slot)).all()
    assert len(time_slots) == 2
    assert all(time_slot == "morning" for time_slot in time_slots)


def test_core_load_splits_multi_valued_system_column_into_applications(
    db_session: Session,
) -> None:
    _load_fixture(db_session)

    # SAP (Alpha + Beta), AS400 (Beta), Gmail + excel (Gamma, case-insensitive
    # dedupe within the cell against "Excel") -- Delta has a blank SYSTEM and
    # links to nothing.
    names = set(db_session.scalars(select(Application.name)))
    assert names == {"SAP", "AS400", "Gmail", "excel"}

    alpha = db_session.scalar(select(Process).where(Process.canonical_name == "RPA - Test Alpha"))
    beta = db_session.scalar(select(Process).where(Process.canonical_name == "RPA - Test Beta"))
    delta = db_session.scalar(select(Process).where(Process.canonical_name == "RPA - Test Delta"))
    assert alpha is not None and beta is not None and delta is not None

    assert {app.name for app in alpha.applications} == {"SAP"}
    assert {app.name for app in beta.applications} == {"SAP", "AS400"}
    assert delta.applications == []

    assert _count(db_session, ProcessApplication) == 5


def test_core_load_is_idempotent_across_repeated_ingestions(db_session: Session) -> None:
    _load_fixture(db_session)
    _load_fixture(db_session)

    assert _count(db_session, Process) == 5
    assert _count(db_session, Ticket) == 6
    assert _count(db_session, Company) == 2


def test_core_load_skips_process_economics_with_unmatched_process_and_logs_issue(
    db_session: Session,
) -> None:
    batch_id = _load_fixture(db_session)
    db_session.add(
        StagingEconomics(
            ingestion_batch_id=batch_id,
            source_file=str(FIXTURE),
            source_sheet="ECONOMICS",
            source_row_number=999,
            source_hash="test-hash-unmatched-economics",
            validation_status="valid",
            rejection_reason=None,
            raw_row={
                "PID": "RPA - Does Not Exist",
                "CAPEX": "1,000.00",
                "ROI_EXPECTED_YR": 5,
                "FTE_H_MONTH": 10,
                "EXTRA_ANNUAL_SAVING_EUR": 0,
                "NOTE": "-",
            },
        )
    )
    db_session.commit()

    load_core_from_staging(db_session, batch_id)

    assert _count(db_session, ProcessEconomics) == 2
    issue = db_session.scalar(
        select(DataQualityIssue).where(DataQualityIssue.issue_type == "unmatched_process")
    )
    assert issue is not None
    assert issue.entity == "process_economics"
