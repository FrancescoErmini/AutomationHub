from datetime import datetime
from typing import Any

from sqlalchemy import DateTime, ForeignKey, String, Text, func
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base

SCHEMA = "staging"


class StagingRowMixin:
    """Shared, source-shaped columns for one raw workbook row.

    ``raw_row`` preserves every original column exactly as read; typed,
    normalized data lives only in ``core``.
    """

    id: Mapped[int] = mapped_column(primary_key=True)
    ingestion_batch_id: Mapped[int] = mapped_column(
        ForeignKey("audit.ingestion_batch.id"), index=True
    )
    source_file: Mapped[str] = mapped_column(String(500))
    source_sheet: Mapped[str] = mapped_column(String(60))
    source_row_number: Mapped[int] = mapped_column()
    source_hash: Mapped[str] = mapped_column(String(64), index=True)
    validation_status: Mapped[str] = mapped_column(String(20))
    rejection_reason: Mapped[str | None] = mapped_column(Text(), nullable=True)
    raw_row: Mapped[dict[str, Any]] = mapped_column(JSONB)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())


class StagingPid(StagingRowMixin, Base):
    __tablename__ = "pid"
    __table_args__ = {"schema": SCHEMA}


class StagingPipeline(StagingRowMixin, Base):
    __tablename__ = "pipeline"
    __table_args__ = {"schema": SCHEMA}


class StagingTickets(StagingRowMixin, Base):
    __tablename__ = "tickets"
    __table_args__ = {"schema": SCHEMA}


class StagingTicketsOut(StagingRowMixin, Base):
    __tablename__ = "tickets_out"
    __table_args__ = {"schema": SCHEMA}


class StagingSchedules(StagingRowMixin, Base):
    __tablename__ = "schedules"
    __table_args__ = {"schema": SCHEMA}


class StagingEconomics(StagingRowMixin, Base):
    __tablename__ = "economics"
    __table_args__ = {"schema": SCHEMA}


class StagingTco(StagingRowMixin, Base):
    __tablename__ = "tco"
    __table_args__ = {"schema": SCHEMA}


class StagingAms1L(StagingRowMixin, Base):
    __tablename__ = "ams_1l"
    __table_args__ = {"schema": SCHEMA}


class StagingAms2L(StagingRowMixin, Base):
    __tablename__ = "ams_2l"
    __table_args__ = {"schema": SCHEMA}


class StagingAmsRfc(StagingRowMixin, Base):
    __tablename__ = "ams_rfc"
    __table_args__ = {"schema": SCHEMA}


class StagingAmsSms(StagingRowMixin, Base):
    __tablename__ = "ams_sms"
    __table_args__ = {"schema": SCHEMA}


class StagingAmsSla(StagingRowMixin, Base):
    __tablename__ = "ams_sla"
    __table_args__ = {"schema": SCHEMA}


class StagingLicenses(StagingRowMixin, Base):
    __tablename__ = "licenses"
    __table_args__ = {"schema": SCHEMA}


class StagingVms(StagingRowMixin, Base):
    __tablename__ = "vms"
    __table_args__ = {"schema": SCHEMA}


class StagingVariables(StagingRowMixin, Base):
    __tablename__ = "variables"
    __table_args__ = {"schema": SCHEMA}
