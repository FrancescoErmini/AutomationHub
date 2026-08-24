from pathlib import Path

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.ingestion.apqc_loader import load_apqc_taxonomy_from_workbook
from app.models.core import ApqcCategory, ApqcProcess, ApqcProcessGroup

WORKBOOK = (
    Path(__file__).resolve().parents[3]
    / "data"
    / "raw"
    / "K07122_Life_Sciences_v722_vsLife_Sciences_v721_2025.xlsx"
)


def _counts(session: Session) -> tuple[int, int, int]:
    return (
        len(session.scalars(select(ApqcCategory)).all()),
        len(session.scalars(select(ApqcProcessGroup)).all()),
        len(session.scalars(select(ApqcProcess)).all()),
    )


def test_ingestion_loads_the_documented_l1_l2_l3_counts(db_session: Session) -> None:
    summary = load_apqc_taxonomy_from_workbook(db_session, WORKBOOK)

    assert (summary.categories, summary.process_groups, summary.processes) == (13, 76, 353)
    assert _counts(db_session) == (13, 76, 353)


def test_ingestion_is_idempotent(db_session: Session) -> None:
    first = load_apqc_taxonomy_from_workbook(db_session, WORKBOOK)
    second = load_apqc_taxonomy_from_workbook(db_session, WORKBOOK)

    assert first == second
    assert _counts(db_session) == (13, 76, 353)


def test_process_group_and_process_link_to_the_correct_parent(db_session: Session) -> None:
    load_apqc_taxonomy_from_workbook(db_session, WORKBOOK)

    group = db_session.scalar(
        select(ApqcProcessGroup).where(ApqcProcessGroup.hierarchy_id == "1.1")
    )
    assert group is not None
    assert group.category.hierarchy_id == "1.0"

    process = db_session.scalar(select(ApqcProcess).where(ApqcProcess.hierarchy_id == "1.1.1"))
    assert process is not None
    assert process.process_group.hierarchy_id == "1.1"
