from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.models.audit import DataQualityIssue, IngestionBatch, RelationshipReconciliation


class AdminRepository:
    def __init__(self, session: Session) -> None:
        self._session = session

    def get_batch(self, batch_id: int) -> IngestionBatch | None:
        return self._session.get(IngestionBatch, batch_id)

    def latest_batch_id(self) -> int | None:
        return self._session.scalar(select(func.max(IngestionBatch.id)))

    def relationships_for_batch(self, batch_id: int) -> list[RelationshipReconciliation]:
        stmt = select(RelationshipReconciliation).where(
            RelationshipReconciliation.ingestion_batch_id == batch_id
        )
        return list(self._session.scalars(stmt))

    def data_quality_issues_for_batch(
        self, batch_id: int, limit: int = 200
    ) -> list[DataQualityIssue]:
        stmt = (
            select(DataQualityIssue)
            .where(DataQualityIssue.ingestion_batch_id == batch_id)
            .order_by(DataQualityIssue.id)
            .limit(limit)
        )
        return list(self._session.scalars(stmt))
