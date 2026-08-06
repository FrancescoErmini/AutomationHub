from datetime import date, datetime
from decimal import Decimal

from sqlalchemy import (
    Boolean,
    Date,
    DateTime,
    ForeignKey,
    Numeric,
    String,
    Text,
    UniqueConstraint,
    func,
)
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base

SCHEMA = "core"


class ReferenceVariable(Base):
    """Named constants ingested from the workbook's _VARIABLES sheet (e.g.
    cost_per_hour_FTE), so KPI formulas read them from data instead of
    hardcoding them in Python."""

    __tablename__ = "reference_variable"
    __table_args__ = {"schema": SCHEMA}

    id: Mapped[int] = mapped_column(primary_key=True)
    name: Mapped[str] = mapped_column(String(120), unique=True)
    value: Mapped[Decimal] = mapped_column(Numeric(14, 4))
    note: Mapped[str | None] = mapped_column(Text(), nullable=True)


class Company(Base):
    __tablename__ = "company"
    __table_args__ = {"schema": SCHEMA}

    id: Mapped[int] = mapped_column(primary_key=True)
    name: Mapped[str] = mapped_column(String(120), unique=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())


class Department(Base):
    __tablename__ = "department"
    __table_args__ = {"schema": SCHEMA}

    id: Mapped[int] = mapped_column(primary_key=True)
    name: Mapped[str] = mapped_column(String(200), unique=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())


class RootCause(Base):
    __tablename__ = "root_cause"
    __table_args__ = {"schema": SCHEMA}

    id: Mapped[int] = mapped_column(primary_key=True)
    name: Mapped[str] = mapped_column(String(200), unique=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())


class Priority(Base):
    __tablename__ = "priority"
    __table_args__ = {"schema": SCHEMA}

    id: Mapped[int] = mapped_column(primary_key=True)
    value: Mapped[str] = mapped_column(String(10), unique=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())


class SupportLevel(Base):
    __tablename__ = "support_level"
    __table_args__ = {"schema": SCHEMA}

    id: Mapped[int] = mapped_column(primary_key=True)
    code: Mapped[str] = mapped_column(String(10), unique=True)
    description: Mapped[str | None] = mapped_column(Text(), nullable=True)


class AmsYear(Base):
    __tablename__ = "ams_year"
    __table_args__ = {"schema": SCHEMA}

    id: Mapped[int] = mapped_column(primary_key=True)
    code: Mapped[str] = mapped_column(String(10), unique=True)
    ordinal: Mapped[int] = mapped_column(unique=True)
    year: Mapped[int | None] = mapped_column(nullable=True)


class VirtualMachine(Base):
    __tablename__ = "virtual_machine"
    __table_args__ = {"schema": SCHEMA}

    id: Mapped[int] = mapped_column(primary_key=True)
    normalized_id: Mapped[str] = mapped_column(String(60), unique=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())


class Process(Base):
    __tablename__ = "process"
    __table_args__ = {"schema": SCHEMA}

    id: Mapped[int] = mapped_column(primary_key=True)
    canonical_name: Mapped[str] = mapped_column(String(300), unique=True)
    normalized_key: Mapped[str] = mapped_column(String(300), unique=True, index=True)
    description: Mapped[str | None] = mapped_column(Text(), nullable=True)
    department_id: Mapped[int | None] = mapped_column(
        ForeignKey(f"{SCHEMA}.department.id"), nullable=True
    )
    status: Mapped[str | None] = mapped_column(String(60), nullable=True)
    company_id: Mapped[int | None] = mapped_column(
        ForeignKey(f"{SCHEMA}.company.id"), nullable=True
    )
    ams_year_id: Mapped[int | None] = mapped_column(
        ForeignKey(f"{SCHEMA}.ams_year.id"), nullable=True
    )
    go_live_date: Mapped[date | None] = mapped_column(Date(), nullable=True)
    in_pipeline: Mapped[bool] = mapped_column(Boolean(), default=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())


class Ticket(Base):
    __tablename__ = "ticket"
    __table_args__ = {"schema": SCHEMA}

    id: Mapped[int] = mapped_column(primary_key=True)
    ticket_id: Mapped[str] = mapped_column(String(60), unique=True)
    ams_year_id: Mapped[int | None] = mapped_column(
        ForeignKey(f"{SCHEMA}.ams_year.id"), nullable=True
    )
    ticket_type: Mapped[str] = mapped_column(String(60))
    priority_id: Mapped[int | None] = mapped_column(
        ForeignKey(f"{SCHEMA}.priority.id"), nullable=True
    )
    process_id: Mapped[int | None] = mapped_column(
        ForeignKey(f"{SCHEMA}.process.id"), nullable=True, index=True
    )
    requestor: Mapped[str | None] = mapped_column(String(200), nullable=True)
    start_date: Mapped[date | None] = mapped_column(Date(), nullable=True)
    end_date: Mapped[date | None] = mapped_column(Date(), nullable=True)
    root_cause_id: Mapped[int | None] = mapped_column(
        ForeignKey(f"{SCHEMA}.root_cause.id"), nullable=True, index=True
    )
    is_1l: Mapped[bool] = mapped_column(Boolean())
    support_level_id: Mapped[int | None] = mapped_column(
        ForeignKey(f"{SCHEMA}.support_level.id"), nullable=True
    )
    company_id: Mapped[int | None] = mapped_column(
        ForeignKey(f"{SCHEMA}.company.id"), nullable=True, index=True
    )
    note: Mapped[str | None] = mapped_column(Text(), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())


class ProcessEconomics(Base):
    __tablename__ = "process_economics"
    __table_args__ = {"schema": SCHEMA}

    id: Mapped[int] = mapped_column(primary_key=True)
    process_id: Mapped[int] = mapped_column(ForeignKey(f"{SCHEMA}.process.id"), unique=True)
    capex_eur: Mapped[Decimal] = mapped_column(Numeric(14, 2))
    roi_expected_yr: Mapped[int | None] = mapped_column(nullable=True)
    fte_hours_month_actual: Mapped[Decimal] = mapped_column(Numeric(10, 2))
    extra_annual_saving_eur: Mapped[Decimal] = mapped_column(Numeric(14, 2), default=Decimal("0"))
    note: Mapped[str | None] = mapped_column(Text(), nullable=True)


class Ams1LCost(Base):
    __tablename__ = "ams_1l_cost"
    __table_args__ = {"schema": SCHEMA}

    id: Mapped[int] = mapped_column(primary_key=True)
    ams_year_id: Mapped[int] = mapped_column(ForeignKey(f"{SCHEMA}.ams_year.id"), unique=True)
    annual_fee_eur: Mapped[Decimal] = mapped_column(Numeric(14, 2))
    n_processes_baseline: Mapped[int]


class Ams2LCost(Base):
    __tablename__ = "ams_2l_cost"
    __table_args__ = {"schema": SCHEMA}

    # Not unique on ticket_id: the source has tickets with multiple 2L cost
    # entries (verified against the real workbook: I260302_000312 has 3 rows).
    id: Mapped[int] = mapped_column(primary_key=True)
    ticket_id: Mapped[int] = mapped_column(ForeignKey(f"{SCHEMA}.ticket.id"), index=True)
    company_id: Mapped[int | None] = mapped_column(
        ForeignKey(f"{SCHEMA}.company.id"), nullable=True
    )
    closed_date: Mapped[date | None] = mapped_column(Date(), nullable=True)
    cost_per_ticket_eur: Mapped[Decimal] = mapped_column(Numeric(14, 2))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())


class LicenseCost(Base):
    __tablename__ = "license_cost"
    __table_args__ = (
        UniqueConstraint("year", "virtual_machine_id", name="uq_license_cost_year_vm"),
        {"schema": SCHEMA},
    )

    id: Mapped[int] = mapped_column(primary_key=True)
    year: Mapped[int]
    virtual_machine_id: Mapped[int] = mapped_column(ForeignKey(f"{SCHEMA}.virtual_machine.id"))
    cost_year_eur: Mapped[Decimal] = mapped_column(Numeric(14, 2))


class ProcessSchedule(Base):
    __tablename__ = "process_schedule"
    __table_args__ = {"schema": SCHEMA}

    id: Mapped[int] = mapped_column(primary_key=True)
    process_id: Mapped[int] = mapped_column(ForeignKey(f"{SCHEMA}.process.id"), index=True)
    scheduled_description: Mapped[str | None] = mapped_column(Text(), nullable=True)
    # Both are free-text in the source (schedule notes / multi-line run times,
    # e.g. "09:30\n12:30\n15:00"), not fixed-format fields -- kept unbounded.
    frequency: Mapped[str | None] = mapped_column(Text(), nullable=True)
    run_time: Mapped[str | None] = mapped_column(Text(), nullable=True)
    avg_minutes: Mapped[Decimal | None] = mapped_column(Numeric(10, 2), nullable=True)
    virtual_machine_id: Mapped[int | None] = mapped_column(
        ForeignKey(f"{SCHEMA}.virtual_machine.id"), nullable=True
    )
    run_user: Mapped[str | None] = mapped_column(String(120), nullable=True)
    rpa_hours_month: Mapped[Decimal | None] = mapped_column(Numeric(10, 2), nullable=True)


class ValueNormalization(Base):
    """Audit trail for every inferred/normalized value: original, normalized,
    method, and confidence, per the ingestion normalization contract."""

    __tablename__ = "value_normalization"
    __table_args__ = {"schema": SCHEMA}

    id: Mapped[int] = mapped_column(primary_key=True)
    ingestion_batch_id: Mapped[int | None] = mapped_column(
        ForeignKey("audit.ingestion_batch.id"), nullable=True, index=True
    )
    entity: Mapped[str] = mapped_column(String(60))
    source_sheet: Mapped[str] = mapped_column(String(60))
    source_row_number: Mapped[int | None] = mapped_column(nullable=True)
    original_value: Mapped[str] = mapped_column(Text())
    normalized_value: Mapped[str] = mapped_column(Text())
    method: Mapped[str] = mapped_column(String(60))
    confidence: Mapped[Decimal] = mapped_column(Numeric(4, 3))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
