from pathlib import Path

import pytest
from sqlalchemy.orm import Session

from app.ingestion.rpa_pipeline import run_rpa_ingestion
from app.models.audit import IngestionBatch

pytestmark = pytest.mark.integration

FIXTURE = Path(__file__).resolve().parents[3] / "data" / "fixtures" / "rpa_sample.xlsx"


def test_run_rpa_ingestion_executes_the_full_pipeline(db_session: Session) -> None:
    summary = run_rpa_ingestion(db_session, FIXTURE)

    assert summary.staging.total_rows > 0
    assert summary.core.counts["process"] == 5
    assert len(summary.relationships) == 8

    batch = db_session.get(IngestionBatch, summary.staging.batch_id)
    assert batch is not None
    assert batch.status == "completed"


def test_run_rpa_ingestion_is_idempotent(db_session: Session) -> None:
    first = run_rpa_ingestion(db_session, FIXTURE)
    second = run_rpa_ingestion(db_session, FIXTURE)

    assert second.staging.batch_id != first.staging.batch_id
    assert second.core.counts["process"] == first.core.counts["process"]
    assert second.core.counts["ticket"] == first.core.counts["ticket"]
