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
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base
from app.models.audit import IngestionBatch

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


class Application(Base):
    """A system/application used by one or more processes, sourced from
    PIPELINE's SYSTEM column (e.g. SAP, AS400, Archiflow)."""

    __tablename__ = "application"
    __table_args__ = {"schema": SCHEMA}

    id: Mapped[int] = mapped_column(primary_key=True)
    name: Mapped[str] = mapped_column(String(120), unique=True)
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

    department: Mapped["Department | None"] = relationship()
    company: Mapped["Company | None"] = relationship()
    ams_year: Mapped["AmsYear | None"] = relationship()
    applications: Mapped[list["Application"]] = relationship(
        secondary=f"{SCHEMA}.process_application", viewonly=True, order_by="Application.name"
    )


class ProcessApplication(Base):
    """Link between a process and one application it uses. A process's SYSTEM
    value in PIPELINE is often multi-valued (e.g. "SAP\\nAS400"), hence the
    many-to-many rather than a single FK on process."""

    __tablename__ = "process_application"
    __table_args__ = (
        UniqueConstraint("process_id", "application_id", name="uq_process_application"),
        {"schema": SCHEMA},
    )

    id: Mapped[int] = mapped_column(primary_key=True)
    process_id: Mapped[int] = mapped_column(ForeignKey(f"{SCHEMA}.process.id"), index=True)
    application_id: Mapped[int] = mapped_column(ForeignKey(f"{SCHEMA}.application.id"), index=True)

    process: Mapped["Process"] = relationship()
    application: Mapped["Application"] = relationship()


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

    ams_year: Mapped["AmsYear | None"] = relationship()
    priority: Mapped["Priority | None"] = relationship()
    process: Mapped["Process | None"] = relationship()
    root_cause: Mapped["RootCause | None"] = relationship()
    support_level: Mapped["SupportLevel | None"] = relationship()
    company: Mapped["Company | None"] = relationship()


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

    process: Mapped["Process"] = relationship()


class Ams1LCost(Base):
    __tablename__ = "ams_1l_cost"
    __table_args__ = {"schema": SCHEMA}

    id: Mapped[int] = mapped_column(primary_key=True)
    ams_year_id: Mapped[int] = mapped_column(ForeignKey(f"{SCHEMA}.ams_year.id"), unique=True)
    annual_fee_eur: Mapped[Decimal] = mapped_column(Numeric(14, 2))
    n_processes_baseline: Mapped[int]

    ams_year: Mapped["AmsYear"] = relationship()


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

    ticket: Mapped["Ticket"] = relationship()
    company: Mapped["Company | None"] = relationship()


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

    virtual_machine: Mapped["VirtualMachine"] = relationship()


class VmCost(Base):
    """General VM running cost by year, distinct from license_cost. Mirrors
    license_cost's (year, VM) keying; seeded at 0 until real opex figures are
    available."""

    __tablename__ = "vm_cost"
    __table_args__ = (
        UniqueConstraint("year", "virtual_machine_id", name="uq_vm_cost_year_vm"),
        {"schema": SCHEMA},
    )

    id: Mapped[int] = mapped_column(primary_key=True)
    year: Mapped[int]
    virtual_machine_id: Mapped[int] = mapped_column(ForeignKey(f"{SCHEMA}.virtual_machine.id"))
    cost_eur: Mapped[Decimal] = mapped_column(Numeric(14, 2))

    virtual_machine: Mapped["VirtualMachine"] = relationship()


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
    # Heatmap bucket for "machine occupancy by time slot". No source column
    # for this exists yet, so every row defaults to 'morning' until real
    # values are back-filled per row.
    time_slot: Mapped[str] = mapped_column(String(20), default="morning")

    process: Mapped["Process"] = relationship()
    virtual_machine: Mapped["VirtualMachine | None"] = relationship()


class AmsRfcCost(Base):
    """Typed promotion of the curated AMS RFC/amendment CSV -- distinct from
    the raw, unvalidated staging.ams_rfc workbook dump. root_cause_raw is
    kept unnormalized: some source rows carry Excel date serials instead of
    text, not worth guessing at."""

    __tablename__ = "ams_rfc_cost"
    __table_args__ = {"schema": SCHEMA}

    id: Mapped[int] = mapped_column(primary_key=True)
    process_id: Mapped[int | None] = mapped_column(
        ForeignKey(f"{SCHEMA}.process.id"), nullable=True, index=True
    )
    rfc_ref: Mapped[str | None] = mapped_column(String(120), nullable=True)
    year: Mapped[int]
    description: Mapped[str | None] = mapped_column(Text(), nullable=True)
    man_days: Mapped[Decimal | None] = mapped_column(Numeric(10, 2), nullable=True)
    root_cause_raw: Mapped[str | None] = mapped_column(Text(), nullable=True)
    note: Mapped[str | None] = mapped_column(Text(), nullable=True)
    cost_eur: Mapped[Decimal] = mapped_column(Numeric(14, 2))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    process: Mapped["Process | None"] = relationship()


class TcoCost(Base):
    """The curated portfolio cost ledger -- one row per line item, CAPEX or
    OPEX, dated. Distinct from the
    per-process ProcessEconomics.capex_eur and license/infra/AMS running
    costs used elsewhere: this is the standalone TCO & ROI chart's source."""

    __tablename__ = "tco_cost"
    __table_args__ = {"schema": SCHEMA}

    id: Mapped[int] = mapped_column(primary_key=True)
    cost_date: Mapped[date] = mapped_column(Date(), index=True)
    cost_eur: Mapped[Decimal] = mapped_column(Numeric(14, 2))
    cost_type: Mapped[str] = mapped_column(String(10))
    subtype: Mapped[str | None] = mapped_column(String(60), nullable=True)
    description: Mapped[str | None] = mapped_column(Text(), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())


class ApqcCategory(Base):
    """APQC PCF Life Sciences taxonomy, level 1 (e.g. Hierarchy ID '1.0')."""

    __tablename__ = "apqc_category"
    __table_args__ = {"schema": SCHEMA}

    id: Mapped[int] = mapped_column(primary_key=True)
    pcf_id: Mapped[int] = mapped_column(unique=True, index=True)
    hierarchy_id: Mapped[str] = mapped_column(String(20), unique=True)
    name: Mapped[str] = mapped_column(String(300))
    description: Mapped[str | None] = mapped_column(Text(), nullable=True)


class ApqcProcessGroup(Base):
    """APQC PCF taxonomy, level 2 (e.g. Hierarchy ID '1.1')."""

    __tablename__ = "apqc_process_group"
    __table_args__ = {"schema": SCHEMA}

    id: Mapped[int] = mapped_column(primary_key=True)
    pcf_id: Mapped[int] = mapped_column(unique=True, index=True)
    hierarchy_id: Mapped[str] = mapped_column(String(20), unique=True)
    name: Mapped[str] = mapped_column(String(300))
    description: Mapped[str | None] = mapped_column(Text(), nullable=True)
    category_id: Mapped[int] = mapped_column(ForeignKey(f"{SCHEMA}.apqc_category.id"), index=True)

    category: Mapped["ApqcCategory"] = relationship()


class ApqcProcess(Base):
    """APQC PCF taxonomy, level 3 (e.g. Hierarchy ID '1.1.1')."""

    __tablename__ = "apqc_process"
    __table_args__ = {"schema": SCHEMA}

    id: Mapped[int] = mapped_column(primary_key=True)
    pcf_id: Mapped[int] = mapped_column(unique=True, index=True)
    hierarchy_id: Mapped[str] = mapped_column(String(20), unique=True)
    name: Mapped[str] = mapped_column(String(300))
    description: Mapped[str | None] = mapped_column(Text(), nullable=True)
    process_group_id: Mapped[int] = mapped_column(
        ForeignKey(f"{SCHEMA}.apqc_process_group.id"), index=True
    )

    process_group: Mapped["ApqcProcessGroup"] = relationship()


class Idea(Base):
    """A submitted automation candidate: wizard inputs plus computed scoring
    engine outputs (ROI, feasibility, technology category, classification)."""

    __tablename__ = "idea"
    __table_args__ = {"schema": SCHEMA}

    id: Mapped[int] = mapped_column(primary_key=True)
    title: Mapped[str] = mapped_column(String(300))
    submitter_name: Mapped[str] = mapped_column(String(200))
    apqc_process_id: Mapped[int] = mapped_column(
        ForeignKey(f"{SCHEMA}.apqc_process.id"), index=True
    )

    # Step 3 -- Process Overview & Business Goals
    primary_goal: Mapped[str] = mapped_column(String(60))
    process_stability: Mapped[str] = mapped_column(String(60))
    system_stability: Mapped[str] = mapped_column(String(60))

    # Step 4 -- Volumetry & Human Effort
    task_frequency: Mapped[str] = mapped_column(String(20))
    transaction_volume: Mapped[Decimal] = mapped_column(Numeric(14, 2))
    headcount_fte: Mapped[Decimal] = mapped_column(Numeric(10, 2))
    avg_time_per_task_minutes: Mapped[Decimal] = mapped_column(Numeric(10, 2))
    error_rate_pct: Mapped[Decimal] = mapped_column(Numeric(6, 3))
    avg_rework_time_minutes: Mapped[Decimal] = mapped_column(Numeric(10, 2))
    audit_rate_pct: Mapped[Decimal] = mapped_column(Numeric(6, 3))
    avg_loaded_fte_cost_eur: Mapped[Decimal] = mapped_column(Numeric(14, 2))

    # Step 5 -- Complexity & Standardisation
    number_of_steps: Mapped[str] = mapped_column(String(20))
    decision_logic: Mapped[str] = mapped_column(String(60))
    process_variations: Mapped[str] = mapped_column(String(30))

    # Step 6 -- Systems & Environment
    primary_input_format: Mapped[str] = mapped_column(String(60))
    number_of_systems: Mapped[str] = mapped_column(String(10))
    system_interface: Mapped[str] = mapped_column(String(60))

    # Step 7 -- AI Assessment
    unstructured_data: Mapped[str] = mapped_column(String(60))
    cognitive_reasoning: Mapped[str] = mapped_column(String(60))
    computer_vision: Mapped[str] = mapped_column(String(60))
    ai_output_risk: Mapped[str] = mapped_column(String(60))

    # Scoring engine outputs, computed server-side on submit
    annual_transactions: Mapped[Decimal] = mapped_column(Numeric(16, 2))
    base_hours: Mapped[Decimal] = mapped_column(Numeric(16, 2))
    rework_hours: Mapped[Decimal] = mapped_column(Numeric(16, 2))
    total_hours_saved: Mapped[Decimal] = mapped_column(Numeric(16, 2))
    gross_roi_eur: Mapped[Decimal] = mapped_column(Numeric(16, 2))
    feasibility_score: Mapped[int]
    feasibility_band: Mapped[str] = mapped_column(String(10))
    technology_category: Mapped[str] = mapped_column(String(60))
    final_classification: Mapped[str] = mapped_column(String(60))

    status: Mapped[str] = mapped_column(String(20), default="Submitted")
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    apqc_process: Mapped["ApqcProcess"] = relationship()


class ValueNormalization(Base):
    """Audit trail for every inferred/normalized value: original, normalized,
    method, and confidence, per the ingestion normalization contract."""

    __tablename__ = "value_normalization"
    __table_args__ = {"schema": SCHEMA}

    id: Mapped[int] = mapped_column(primary_key=True)
    ingestion_batch_id: Mapped[int | None] = mapped_column(
        ForeignKey("audit.ingestion_batch.id"), nullable=True, index=True
    )
    ingestion_batch: Mapped["IngestionBatch | None"] = relationship()
    entity: Mapped[str] = mapped_column(String(60))
    source_sheet: Mapped[str] = mapped_column(String(60))
    source_row_number: Mapped[int | None] = mapped_column(nullable=True)
    original_value: Mapped[str] = mapped_column(Text())
    normalized_value: Mapped[str] = mapped_column(Text())
    method: Mapped[str] = mapped_column(String(60))
    confidence: Mapped[Decimal] = mapped_column(Numeric(4, 3))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
