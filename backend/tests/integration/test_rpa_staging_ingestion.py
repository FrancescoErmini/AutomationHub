from pathlib import Path

import pytest
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.ingestion.rpa_staging_loader import load_staging_from_workbook
from app.models.audit import IngestionBatch
from app.models.staging import StagingPid, StagingTickets

pytestmark = pytest.mark.integration

FIXTURE = Path(__file__).resolve().parents[3] / "data" / "fixtures" / "rpa_sample.xlsx"


def test_load_staging_creates_a_completed_batch(db_session: Session) -> None:
    result = load_staging_from_workbook(db_session, FIXTURE)

    assert result.total_rows > 0
    assert result.total_rows == result.valid_rows + result.rejected_rows

    batch = db_session.get(IngestionBatch, result.batch_id)
    assert batch is not None
    assert batch.status == "completed"
    assert batch.total_rows == result.total_rows
    assert batch.valid_rows == result.valid_rows
    assert batch.rejected_rows == result.rejected_rows
    assert batch.finished_at is not None


def test_every_staged_ticket_row_has_a_validation_status(db_session: Session) -> None:
    load_staging_from_workbook(db_session, FIXTURE)

    statuses = db_session.execute(select(StagingTickets.validation_status)).scalars().all()
    assert statuses
    assert all(status in {"valid", "rejected"} for status in statuses)


def test_row_missing_required_ticket_id_is_rejected_with_a_reason(db_session: Session) -> None:
    load_staging_from_workbook(db_session, FIXTURE)

    rejected = (
        db_session.execute(
            select(StagingTickets).where(StagingTickets.validation_status == "rejected")
        )
        .scalars()
        .all()
    )

    assert len(rejected) == 1
    assert rejected[0].rejection_reason == "missing_required_value:TICKET_ID"
    assert rejected[0].raw_row["NOTE"] == "missing ticket id - must be rejected"


def test_pid_sheet_rows_are_all_staged(db_session: Session) -> None:
    load_staging_from_workbook(db_session, FIXTURE)

    count = db_session.scalar(select(func.count()).select_from(StagingPid))
    assert count == 5


def test_reingesting_the_same_workbook_creates_a_new_batch_and_keeps_history(
    db_session: Session,
) -> None:
    first = load_staging_from_workbook(db_session, FIXTURE)
    second = load_staging_from_workbook(db_session, FIXTURE)

    assert second.batch_id != first.batch_id
    assert second.total_rows == first.total_rows

    batch_count = db_session.scalar(select(func.count()).select_from(IngestionBatch))
    assert batch_count == 2

    pid_count = db_session.scalar(select(func.count()).select_from(StagingPid))
    assert pid_count == 5 * 2
