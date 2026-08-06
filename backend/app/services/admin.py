from pathlib import Path

from sqlalchemy.orm import Session

from app.core.exceptions import NotFoundError
from app.ingestion.rpa_pipeline import RpaIngestionSummary, run_rpa_ingestion
from app.models.audit import DataQualityIssue, IngestionBatch, RelationshipReconciliation
from app.repositories.admin import AdminRepository


class AdminService:
    def __init__(self, session: Session, repo: AdminRepository) -> None:
        self._session = session
        self._repo = repo

    def trigger_ingestion(self, path: Path) -> RpaIngestionSummary:
        return run_rpa_ingestion(self._session, path)

    def get_batch(self, batch_id: int) -> IngestionBatch:
        batch = self._repo.get_batch(batch_id)
        if batch is None:
            raise NotFoundError(f"Ingestion batch {batch_id} not found")
        return batch

    def get_relationships(self, batch_id: int | None) -> list[RelationshipReconciliation]:
        resolved_id = batch_id if batch_id is not None else self._repo.latest_batch_id()
        if resolved_id is None:
            return []
        return self._repo.relationships_for_batch(resolved_id)

    def get_data_quality_issues(self, batch_id: int | None) -> list[DataQualityIssue]:
        resolved_id = batch_id if batch_id is not None else self._repo.latest_batch_id()
        if resolved_id is None:
            return []
        return self._repo.data_quality_issues_for_batch(resolved_id)
