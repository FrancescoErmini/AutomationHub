from datetime import datetime
from decimal import Decimal

from sqlalchemy import DateTime, ForeignKey, Numeric, String, Text, func
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base

SCHEMA = "audit"


class IngestionBatch(Base):
    __tablename__ = "ingestion_batch"
    __table_args__ = {"schema": SCHEMA}

    id: Mapped[int] = mapped_column(primary_key=True)
    source_file: Mapped[str] = mapped_column(String(500))
    source_hash: Mapped[str] = mapped_column(String(64), index=True)
    status: Mapped[str] = mapped_column(String(20), default="running")
    total_rows: Mapped[int] = mapped_column(default=0)
    valid_rows: Mapped[int] = mapped_column(default=0)
    rejected_rows: Mapped[int] = mapped_column(default=0)
    started_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    finished_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)

    data_quality_issues: Mapped[list["DataQualityIssue"]] = relationship(back_populates="batch")
    relationship_reconciliations: Mapped[list["RelationshipReconciliation"]] = relationship(
        back_populates="batch"
    )


class DataQualityIssue(Base):
    __tablename__ = "data_quality_issue"
    __table_args__ = {"schema": SCHEMA}

    id: Mapped[int] = mapped_column(primary_key=True)
    ingestion_batch_id: Mapped[int] = mapped_column(
        ForeignKey(f"{SCHEMA}.ingestion_batch.id"), index=True
    )
    source_sheet: Mapped[str] = mapped_column(String(60))
    source_row_number: Mapped[int | None] = mapped_column(nullable=True)
    entity: Mapped[str] = mapped_column(String(60))
    issue_type: Mapped[str] = mapped_column(String(80))
    severity: Mapped[str] = mapped_column(String(20))
    message: Mapped[str] = mapped_column(Text())
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    batch: Mapped[IngestionBatch] = relationship(back_populates="data_quality_issues")


class RelationshipReconciliation(Base):
    __tablename__ = "relationship_reconciliation"
    __table_args__ = {"schema": SCHEMA}

    id: Mapped[int] = mapped_column(primary_key=True)
    ingestion_batch_id: Mapped[int] = mapped_column(
        ForeignKey(f"{SCHEMA}.ingestion_batch.id"), index=True
    )
    relationship_name: Mapped[str] = mapped_column(String(80))
    total_rows: Mapped[int]
    matched_rows: Mapped[int]
    unmatched_rows: Mapped[int]
    duplicate_candidates: Mapped[int]
    match_pct: Mapped[Decimal] = mapped_column(Numeric(6, 3))
    threshold_pct: Mapped[Decimal] = mapped_column(Numeric(6, 3))
    sample_unmatched: Mapped[list[str]] = mapped_column(JSONB)
    computed_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )

    batch: Mapped[IngestionBatch] = relationship(back_populates="relationship_reconciliations")
