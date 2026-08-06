from decimal import Decimal
from pathlib import Path

import pytest
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.ingestion.rpa_core_loader import load_core_from_staging
from app.ingestion.rpa_relationship_validation import RelationshipCheck, validate_relationships
from app.ingestion.rpa_staging_loader import load_staging_from_workbook
from app.models.audit import RelationshipReconciliation

pytestmark = pytest.mark.integration

FIXTURE = Path(__file__).resolve().parents[3] / "data" / "fixtures" / "rpa_sample.xlsx"


def _load_and_validate(session: Session) -> tuple[int, dict[str, RelationshipCheck]]:
    staging_result = load_staging_from_workbook(session, FIXTURE)
    load_core_from_staging(session, staging_result.batch_id)
    checks = validate_relationships(session, staging_result.batch_id)
    return staging_result.batch_id, {check.relationship_name: check for check in checks}


def test_validate_relationships_covers_every_required_relationship(db_session: Session) -> None:
    _, checks = _load_and_validate(db_session)

    assert set(checks) == {
        "ticket_to_process",
        "ticket_to_company",
        "ticket_to_root_cause",
        "economics_to_process",
        "ams_2l_cost_to_ticket",
        "ams_1l_cost_to_year",
        "license_cost_to_year",
        "schedule_to_vm",
    }


def test_ticket_to_process_excludes_duplicates_and_finds_the_unmatched_process(
    db_session: Session,
) -> None:
    _, checks = _load_and_validate(db_session)
    check = checks["ticket_to_process"]

    assert check.total_rows == 7
    assert check.duplicate_candidates == 1
    assert check.matched_rows == 5
    assert check.unmatched_rows == 1
    assert check.match_pct == Decimal("83.333")
    assert "RPA - Unknown Process" in check.sample_unmatched


def test_ticket_to_process_is_below_the_default_threshold(db_session: Session) -> None:
    _, checks = _load_and_validate(db_session)
    check = checks["ticket_to_process"]

    assert check.threshold_pct == Decimal("95.0")
    assert check.below_threshold


def test_ticket_to_company_is_fully_matched(db_session: Session) -> None:
    _, checks = _load_and_validate(db_session)
    check = checks["ticket_to_company"]

    assert check.matched_rows == 6
    assert check.unmatched_rows == 0
    assert check.match_pct == Decimal("100.000")
    assert not check.below_threshold


def test_ticket_to_root_cause_uses_a_documented_lower_threshold(db_session: Session) -> None:
    _, checks = _load_and_validate(db_session)
    check = checks["ticket_to_root_cause"]

    assert check.matched_rows == 2
    assert check.unmatched_rows == 4
    assert check.threshold_pct < Decimal("95.0")
    assert not check.below_threshold  # low match rate is expected, not a defect


def test_fact_relationships_are_fully_matched_in_the_clean_fixture(db_session: Session) -> None:
    _, checks = _load_and_validate(db_session)

    for name in (
        "economics_to_process",
        "ams_2l_cost_to_ticket",
        "ams_1l_cost_to_year",
        "license_cost_to_year",
        "schedule_to_vm",
    ):
        check = checks[name]
        assert check.matched_rows == check.total_rows, name
        assert check.unmatched_rows == 0, name
        assert not check.below_threshold, name


def test_validate_relationships_persists_one_row_per_relationship(db_session: Session) -> None:
    batch_id, checks = _load_and_validate(db_session)

    count = db_session.scalar(
        select(func.count())
        .select_from(RelationshipReconciliation)
        .where(RelationshipReconciliation.ingestion_batch_id == batch_id)
    )
    assert count == len(checks) == 8
