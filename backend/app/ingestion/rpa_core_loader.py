"""Normalize validated staging rows into the core relational model.

Idempotent by full rebuild: every call truncates the core dimension/fact
tables (children before parents, respecting foreign keys) and repopulates
them from the given batch's currently-valid staging rows. Audit tables
(``audit.data_quality_issue``, ``core.value_normalization``) are append-only
history and are never truncated.

Any row whose non-nullable foreign key cannot be resolved is skipped and
logged as a ``data_quality_issue`` -- never silently dropped. Nullable
foreign keys that cannot be resolved (e.g. a ticket referencing an unknown
process) are simply left null; relationship coverage is measured separately.
"""

from collections.abc import Iterable
from dataclasses import dataclass
from decimal import Decimal
from typing import TypeVar

from sqlalchemy import delete, select
from sqlalchemy.orm import Session

from app.db.base import Base
from app.ingestion.normalization import (
    NormalizedValue,
    ams_year_ordinal,
    normalize_ams_year,
    normalize_bool,
    normalize_company,
    normalize_date_european,
    normalize_decimal,
    normalize_text_key,
    normalize_vm_id,
    process_matching_key,
)
from app.models.audit import DataQualityIssue
from app.models.core import (
    Ams1LCost,
    Ams2LCost,
    AmsYear,
    Company,
    Department,
    LicenseCost,
    Priority,
    Process,
    ProcessEconomics,
    ProcessSchedule,
    ReferenceVariable,
    RootCause,
    SupportLevel,
    Ticket,
    ValueNormalization,
    VirtualMachine,
    VmCost,
)
from app.models.staging import (
    StagingAms1L,
    StagingAms2L,
    StagingEconomics,
    StagingLicenses,
    StagingPid,
    StagingPipeline,
    StagingRowMixin,
    StagingSchedules,
    StagingTickets,
    StagingVariables,
    StagingVms,
)

_T = TypeVar("_T", bound=StagingRowMixin)

# Children before parents.
_CORE_DELETE_ORDER: list[type[Base]] = [
    ProcessSchedule,
    Ams2LCost,
    ProcessEconomics,
    Ams1LCost,
    VmCost,
    LicenseCost,
    Ticket,
    Process,
    VirtualMachine,
    AmsYear,
    SupportLevel,
    Priority,
    RootCause,
    Department,
    Company,
    ReferenceVariable,
]


@dataclass(frozen=True)
class CoreLoadResult:
    batch_id: int
    counts: dict[str, int]


def _is_blank(value: object) -> bool:
    return value is None or (isinstance(value, str) and not value.strip())


def _valid_rows(session: Session, model: type[_T], batch_id: int) -> list[_T]:
    stmt = (
        select(model)
        .where(model.ingestion_batch_id == batch_id)
        .where(model.validation_status == "valid")
        .order_by(model.source_row_number)
    )
    return list(session.scalars(stmt))


def _log_issue(
    session: Session,
    batch_id: int,
    *,
    source_sheet: str,
    source_row_number: int | None,
    entity: str,
    issue_type: str,
    severity: str,
    message: str,
) -> None:
    session.add(
        DataQualityIssue(
            ingestion_batch_id=batch_id,
            source_sheet=source_sheet,
            source_row_number=source_row_number,
            entity=entity,
            issue_type=issue_type,
            severity=severity,
            message=message,
        )
    )


def _log_normalization(
    session: Session,
    batch_id: int,
    *,
    entity: str,
    source_sheet: str,
    source_row_number: int | None,
    value: NormalizedValue,
) -> None:
    if value.original == value.normalized:
        return
    session.add(
        ValueNormalization(
            ingestion_batch_id=batch_id,
            entity=entity,
            source_sheet=source_sheet,
            source_row_number=source_row_number,
            original_value=value.original,
            normalized_value=value.normalized,
            method=value.method,
            confidence=value.confidence,
        )
    )


def _clear_core_tables(session: Session) -> None:
    for model in _CORE_DELETE_ORDER:
        session.execute(delete(model))
    session.flush()


def load_core_from_staging(session: Session, batch_id: int) -> CoreLoadResult:
    _clear_core_tables(session)

    reference_variables = _load_reference_variables(session, batch_id)
    companies = _load_companies(session, batch_id)
    departments = _load_departments(session, batch_id)
    root_causes = _load_root_causes(session, batch_id)
    priorities = _load_priorities(session, batch_id)
    support_levels = _load_support_levels(session)
    ams_years = _load_ams_years(session, batch_id)
    virtual_machines = _load_virtual_machines(session, batch_id)
    processes = _load_processes(session, batch_id, departments, companies, ams_years)
    tickets = _load_tickets(
        session, batch_id, processes, companies, root_causes, priorities, ams_years, support_levels
    )
    process_economics = _load_process_economics(session, batch_id, processes)
    ams_1l_costs = _load_ams_1l_costs(session, batch_id, ams_years)
    ams_2l_costs = _load_ams_2l_costs(session, batch_id, tickets, companies)
    license_costs = _load_license_costs(session, batch_id, virtual_machines)
    vm_costs = _load_vm_costs(session)
    process_schedules = _load_process_schedules(session, batch_id, processes, virtual_machines)

    session.commit()

    return CoreLoadResult(
        batch_id=batch_id,
        counts={
            "reference_variable": len(reference_variables),
            "company": len(companies),
            "department": len(departments),
            "root_cause": len(root_causes),
            "priority": len(priorities),
            "support_level": len(support_levels),
            "ams_year": len(ams_years),
            "virtual_machine": len(virtual_machines),
            "process": len(processes),
            "ticket": len(tickets),
            "process_economics": process_economics,
            "ams_1l_cost": ams_1l_costs,
            "ams_2l_cost": ams_2l_costs,
            "license_cost": license_costs,
            "vm_cost": vm_costs,
            "process_schedule": process_schedules,
        },
    )


def _load_reference_variables(session: Session, batch_id: int) -> dict[str, ReferenceVariable]:
    variables: dict[str, ReferenceVariable] = {}
    for row in _valid_rows(session, StagingVariables, batch_id):
        name = str(row.raw_row.get("NAME") or "").strip()
        if not name:
            continue
        value = normalize_decimal(row.raw_row.get("VALUE"))
        if value is None:
            _log_issue(
                session,
                batch_id,
                source_sheet=row.source_sheet,
                source_row_number=row.source_row_number,
                entity="reference_variable",
                issue_type="invalid_value",
                severity="error",
                message=f"VALUE could not be parsed for variable '{name}'",
            )
            continue
        note = row.raw_row.get("NOTE")
        variable = ReferenceVariable(
            name=name, value=value, note=str(note) if note is not None else None
        )
        session.add(variable)
        variables[name] = variable
    session.flush()
    return variables


def _load_companies(session: Session, batch_id: int) -> dict[str, Company]:
    sources: Iterable[tuple[type[StagingRowMixin], str]] = (
        (StagingTickets, "COMPANY"),
        (StagingPipeline, "Company"),
        (StagingAms2L, "COMPANY"),
    )
    companies: dict[str, Company] = {}
    for model, key in sources:
        for row in _valid_rows(session, model, batch_id):
            raw = row.raw_row.get(key)
            if _is_blank(raw):
                continue
            result = normalize_company(str(raw))
            if result is None:
                _log_issue(
                    session,
                    batch_id,
                    source_sheet=row.source_sheet,
                    source_row_number=row.source_row_number,
                    entity="company",
                    issue_type="unmapped_company",
                    severity="warning",
                    message=f"Company value '{raw}' has no alias mapping",
                )
                continue
            _log_normalization(
                session,
                batch_id,
                entity="company",
                source_sheet=row.source_sheet,
                source_row_number=row.source_row_number,
                value=result,
            )
            if result.normalized not in companies:
                company = Company(name=result.normalized)
                session.add(company)
                companies[result.normalized] = company
    session.flush()
    return companies


def _load_departments(session: Session, batch_id: int) -> dict[str, Department]:
    departments: dict[str, Department] = {}
    for row in _valid_rows(session, StagingPipeline, batch_id):
        raw = row.raw_row.get("DEPARTEMENT")
        if _is_blank(raw):
            continue
        result = normalize_text_key(str(raw))
        _log_normalization(
            session,
            batch_id,
            entity="department",
            source_sheet=row.source_sheet,
            source_row_number=row.source_row_number,
            value=result,
        )
        if result.normalized not in departments:
            department = Department(name=result.normalized)
            session.add(department)
            departments[result.normalized] = department
    session.flush()
    return departments


def _load_root_causes(session: Session, batch_id: int) -> dict[str, RootCause]:
    root_causes: dict[str, RootCause] = {}
    for row in _valid_rows(session, StagingTickets, batch_id):
        raw = row.raw_row.get("ROOT_CAUSE")
        if _is_blank(raw):
            continue
        result = normalize_text_key(str(raw))
        _log_normalization(
            session,
            batch_id,
            entity="root_cause",
            source_sheet=row.source_sheet,
            source_row_number=row.source_row_number,
            value=result,
        )
        if result.normalized not in root_causes:
            root_cause = RootCause(name=result.normalized)
            session.add(root_cause)
            root_causes[result.normalized] = root_cause
    session.flush()
    return root_causes


def _load_priorities(session: Session, batch_id: int) -> dict[str, Priority]:
    priorities: dict[str, Priority] = {}
    sources: Iterable[type[StagingRowMixin]] = (StagingTickets,)
    for model in sources:
        for row in _valid_rows(session, model, batch_id):
            raw = row.raw_row.get("PRIORITY")
            if _is_blank(raw):
                continue
            value = str(raw).strip()
            if value not in priorities:
                priority = Priority(value=value)
                session.add(priority)
                priorities[value] = priority
    session.flush()
    return priorities


def _load_support_levels(session: Session) -> dict[str, SupportLevel]:
    levels = {
        "1L": SupportLevel(code="1L", description="First-line AMS support"),
        "2L": SupportLevel(code="2L", description="Second-line AMS support"),
    }
    session.add_all(levels.values())
    session.flush()
    return levels


def _load_ams_years(session: Session, batch_id: int) -> dict[str, AmsYear]:
    sources: Iterable[tuple[type[StagingRowMixin], str]] = (
        (StagingTickets, "AMS_YEAR"),
        (StagingPipeline, "AMS Year"),
        (StagingAms1L, "AMS Year"),
    )
    ams_years: dict[str, AmsYear] = {}
    for model, key in sources:
        for row in _valid_rows(session, model, batch_id):
            raw = row.raw_row.get(key)
            if _is_blank(raw):
                continue
            result = normalize_ams_year(str(raw))
            if result is None:
                _log_issue(
                    session,
                    batch_id,
                    source_sheet=row.source_sheet,
                    source_row_number=row.source_row_number,
                    entity="ams_year",
                    issue_type="unrecognized_ams_year",
                    severity="warning",
                    message=f"AMS year value '{raw}' does not match I/II/III or 1st/2nd/3rd",
                )
                continue
            _log_normalization(
                session,
                batch_id,
                entity="ams_year",
                source_sheet=row.source_sheet,
                source_row_number=row.source_row_number,
                value=result,
            )
            if result.normalized not in ams_years:
                ams_year = AmsYear(
                    code=result.normalized, ordinal=ams_year_ordinal(result.normalized)
                )
                session.add(ams_year)
                ams_years[result.normalized] = ams_year
    session.flush()
    return ams_years


def _load_virtual_machines(session: Session, batch_id: int) -> dict[str, VirtualMachine]:
    sources: Iterable[tuple[type[StagingRowMixin], str]] = (
        (StagingVms, "VM"),
        (StagingSchedules, "VM"),
        (StagingLicenses, "VM"),
    )
    machines: dict[str, VirtualMachine] = {}
    for model, key in sources:
        for row in _valid_rows(session, model, batch_id):
            raw = row.raw_row.get(key)
            if _is_blank(raw):
                continue
            result = normalize_vm_id(str(raw))
            _log_normalization(
                session,
                batch_id,
                entity="virtual_machine",
                source_sheet=row.source_sheet,
                source_row_number=row.source_row_number,
                value=result,
            )
            if result.normalized not in machines:
                machine = VirtualMachine(normalized_id=result.normalized)
                session.add(machine)
                machines[result.normalized] = machine
    session.flush()
    return machines


def _load_processes(
    session: Session,
    batch_id: int,
    departments: dict[str, Department],
    companies: dict[str, Company],
    ams_years: dict[str, AmsYear],
) -> dict[str, Process]:
    pipeline_rows = {
        process_matching_key(str(row.raw_row["PID"])): row
        for row in _valid_rows(session, StagingPipeline, batch_id)
        if not _is_blank(row.raw_row.get("PID"))
    }

    processes: dict[str, Process] = {}
    for row in _valid_rows(session, StagingPid, batch_id):
        raw_name = row.raw_row.get("PID")
        if _is_blank(raw_name):
            continue
        key = process_matching_key(str(raw_name))
        if key in processes:
            continue
        pipeline_row = pipeline_rows.get(key)
        canonical_name = normalize_text_key(
            str(pipeline_row.raw_row["PID"]) if pipeline_row is not None else str(raw_name)
        ).normalized

        department_id = None
        company_id = None
        ams_year_id = None
        status = None
        description = None
        go_live_date = None
        if pipeline_row is not None:
            department_raw = pipeline_row.raw_row.get("DEPARTEMENT")
            if not _is_blank(department_raw):
                department = departments.get(normalize_text_key(str(department_raw)).normalized)
                department_id = department.id if department is not None else None
            company_raw = pipeline_row.raw_row.get("Company")
            if not _is_blank(company_raw):
                company_result = normalize_company(str(company_raw))
                company = companies.get(company_result.normalized) if company_result else None
                company_id = company.id if company is not None else None
            ams_year_raw = pipeline_row.raw_row.get("AMS Year")
            if not _is_blank(ams_year_raw):
                ams_year_result = normalize_ams_year(str(ams_year_raw))
                ams_year = ams_years.get(ams_year_result.normalized) if ams_year_result else None
                ams_year_id = ams_year.id if ams_year is not None else None
            status_raw = pipeline_row.raw_row.get("STATUS")
            status = str(status_raw).strip() if not _is_blank(status_raw) else None
            description_raw = pipeline_row.raw_row.get("DESCRIPTION")
            description = str(description_raw).strip() if not _is_blank(description_raw) else None
            go_live_date = normalize_date_european(pipeline_row.raw_row.get("Go-Live date"))

        process = Process(
            canonical_name=canonical_name,
            normalized_key=key,
            description=description,
            department_id=department_id,
            status=status,
            company_id=company_id,
            ams_year_id=ams_year_id,
            go_live_date=go_live_date,
            in_pipeline=pipeline_row is not None,
        )
        session.add(process)
        processes[key] = process

    # Any process present in PIPELINE but missing from the PID master list is
    # still real source data -- add it, description-first, rather than drop it.
    for key, pipeline_row in pipeline_rows.items():
        if key in processes:
            continue
        canonical_name = normalize_text_key(str(pipeline_row.raw_row["PID"])).normalized
        process = Process(
            canonical_name=canonical_name,
            normalized_key=key,
            description=str(pipeline_row.raw_row.get("DESCRIPTION") or "").strip() or None,
            in_pipeline=True,
        )
        session.add(process)
        processes[key] = process

    session.flush()
    return processes


def _load_tickets(
    session: Session,
    batch_id: int,
    processes: dict[str, Process],
    companies: dict[str, Company],
    root_causes: dict[str, RootCause],
    priorities: dict[str, Priority],
    ams_years: dict[str, AmsYear],
    support_levels: dict[str, SupportLevel],
) -> dict[str, Ticket]:
    tickets: dict[str, Ticket] = {}
    for row in _valid_rows(session, StagingTickets, batch_id):
        raw = row.raw_row
        ticket_id = str(raw["TICKET_ID"]).strip()
        if ticket_id in tickets:
            _log_issue(
                session,
                batch_id,
                source_sheet=row.source_sheet,
                source_row_number=row.source_row_number,
                entity="ticket",
                issue_type="duplicate_ticket_id",
                severity="warning",
                message=f"Ticket id '{ticket_id}' appears more than once in TICKETS; "
                "kept the earliest occurrence for core.ticket",
            )
            continue

        process_id = None
        process_raw = raw.get("PID")
        if not _is_blank(process_raw):
            process = processes.get(process_matching_key(str(process_raw)))
            process_id = process.id if process is not None else None

        company_id = None
        company_raw = raw.get("COMPANY")
        if not _is_blank(company_raw):
            company_result = normalize_company(str(company_raw))
            company = companies.get(company_result.normalized) if company_result else None
            company_id = company.id if company is not None else None

        root_cause_id = None
        root_cause_raw = raw.get("ROOT_CAUSE")
        if not _is_blank(root_cause_raw):
            root_cause = root_causes.get(normalize_text_key(str(root_cause_raw)).normalized)
            root_cause_id = root_cause.id if root_cause is not None else None

        priority_id = None
        priority_raw = raw.get("PRIORITY")
        if not _is_blank(priority_raw):
            priority = priorities.get(str(priority_raw).strip())
            priority_id = priority.id if priority is not None else None

        ams_year_id = None
        ams_year_raw = raw.get("AMS_YEAR")
        if not _is_blank(ams_year_raw):
            ams_year_result = normalize_ams_year(str(ams_year_raw))
            ams_year = ams_years.get(ams_year_result.normalized) if ams_year_result else None
            ams_year_id = ams_year.id if ams_year is not None else None

        is_1l = normalize_bool(raw.get("IS_1L"))
        if is_1l is None:
            _log_issue(
                session,
                batch_id,
                source_sheet=row.source_sheet,
                source_row_number=row.source_row_number,
                entity="ticket",
                issue_type="unrecognized_support_level",
                severity="warning",
                message=f"IS_1L value '{raw.get('IS_1L')}' could not be parsed as boolean",
            )
            is_1l = False
        support_level = support_levels["1L" if is_1l else "2L"]

        ticket = Ticket(
            ticket_id=ticket_id,
            ams_year_id=ams_year_id,
            ticket_type=str(raw.get("TICKET_TYPE") or "").strip(),
            priority_id=priority_id,
            process_id=process_id,
            requestor=str(raw.get("REQUESTOR")).strip()
            if not _is_blank(raw.get("REQUESTOR"))
            else None,
            start_date=normalize_date_european(raw.get("START_DATE")),
            end_date=normalize_date_european(raw.get("END_DATE")),
            root_cause_id=root_cause_id,
            is_1l=is_1l,
            support_level_id=support_level.id,
            company_id=company_id,
            note=str(raw.get("NOTE")).strip() if not _is_blank(raw.get("NOTE")) else None,
        )
        session.add(ticket)
        tickets[ticket_id] = ticket

    session.flush()
    return tickets


def _load_process_economics(session: Session, batch_id: int, processes: dict[str, Process]) -> int:
    count = 0
    for row in _valid_rows(session, StagingEconomics, batch_id):
        raw = row.raw_row
        process = processes.get(process_matching_key(str(raw["PID"])))
        if process is None:
            _log_issue(
                session,
                batch_id,
                source_sheet=row.source_sheet,
                source_row_number=row.source_row_number,
                entity="process_economics",
                issue_type="unmatched_process",
                severity="error",
                message=f"ECONOMICS row references unknown process '{raw['PID']}'",
            )
            continue
        capex = normalize_decimal(raw.get("CAPEX")) or Decimal("0")
        fte_hours = normalize_decimal(raw.get("FTE_H_MONTH")) or Decimal("0")
        extra_saving = normalize_decimal(raw.get("EXTRA_ANNUAL_SAVING_EUR")) or Decimal("0")
        roi_expected_raw = raw.get("ROI_EXPECTED_YR")
        roi_expected = int(roi_expected_raw) if isinstance(roi_expected_raw, int | float) else None
        note_raw = raw.get("NOTE")
        session.add(
            ProcessEconomics(
                process_id=process.id,
                capex_eur=capex,
                roi_expected_yr=roi_expected,
                fte_hours_month_actual=fte_hours,
                extra_annual_saving_eur=extra_saving,
                note=str(note_raw) if not _is_blank(note_raw) else None,
            )
        )
        count += 1
    session.flush()
    return count


def _load_ams_1l_costs(session: Session, batch_id: int, ams_years: dict[str, AmsYear]) -> int:
    count = 0
    for row in _valid_rows(session, StagingAms1L, batch_id):
        raw = row.raw_row
        ams_year_result = normalize_ams_year(str(raw["AMS Year"]))
        ams_year = ams_years.get(ams_year_result.normalized) if ams_year_result else None
        if ams_year is None:
            _log_issue(
                session,
                batch_id,
                source_sheet=row.source_sheet,
                source_row_number=row.source_row_number,
                entity="ams_1l_cost",
                issue_type="unmatched_ams_year",
                severity="error",
                message=f"AMS 1L row references unrecognized AMS year '{raw['AMS Year']}'",
            )
            continue
        annual_fee = normalize_decimal(raw.get("ANNUAL FEE")) or Decimal("0")
        baseline_raw = raw.get("N_PROCESSES_BASELINE")
        baseline = int(baseline_raw) if isinstance(baseline_raw, int | float) else 0
        session.add(
            Ams1LCost(
                ams_year_id=ams_year.id, annual_fee_eur=annual_fee, n_processes_baseline=baseline
            )
        )
        count += 1
    session.flush()
    return count


def _load_ams_2l_costs(
    session: Session, batch_id: int, tickets: dict[str, Ticket], companies: dict[str, Company]
) -> int:
    count = 0
    for row in _valid_rows(session, StagingAms2L, batch_id):
        raw = row.raw_row
        ticket = tickets.get(str(raw["TICKET"]).strip())
        if ticket is None:
            _log_issue(
                session,
                batch_id,
                source_sheet=row.source_sheet,
                source_row_number=row.source_row_number,
                entity="ams_2l_cost",
                issue_type="unmatched_ticket",
                severity="error",
                message=f"AMS 2L row references unknown ticket '{raw['TICKET']}'",
            )
            continue
        company_id = None
        company_raw = raw.get("COMPANY")
        if not _is_blank(company_raw):
            company_result = normalize_company(str(company_raw))
            company = companies.get(company_result.normalized) if company_result else None
            company_id = company.id if company is not None else None
        session.add(
            Ams2LCost(
                ticket_id=ticket.id,
                company_id=company_id,
                closed_date=normalize_date_european(raw.get("CLOSED")),
                cost_per_ticket_eur=normalize_decimal(raw.get("COST_PER_TICKET")) or Decimal("0"),
            )
        )
        count += 1
    session.flush()
    return count


def _load_license_costs(
    session: Session, batch_id: int, virtual_machines: dict[str, VirtualMachine]
) -> int:
    count = 0
    for row in _valid_rows(session, StagingLicenses, batch_id):
        raw = row.raw_row
        vm_result = normalize_vm_id(str(raw["VM"]))
        vm = virtual_machines.get(vm_result.normalized)
        if vm is None:
            _log_issue(
                session,
                batch_id,
                source_sheet=row.source_sheet,
                source_row_number=row.source_row_number,
                entity="license_cost",
                issue_type="unmatched_virtual_machine",
                severity="error",
                message=f"LICENSES row references unknown VM '{raw['VM']}'",
            )
            continue
        year_raw = raw.get("Year")
        year = int(year_raw) if isinstance(year_raw, int | float) else None
        if year is None:
            _log_issue(
                session,
                batch_id,
                source_sheet=row.source_sheet,
                source_row_number=row.source_row_number,
                entity="license_cost",
                issue_type="invalid_year",
                severity="error",
                message=f"LICENSES row has a non-numeric Year '{year_raw}'",
            )
            continue
        session.add(
            LicenseCost(
                year=year,
                virtual_machine_id=vm.id,
                cost_year_eur=normalize_decimal(raw.get("COST_YEAR")) or Decimal("0"),
            )
        )
        count += 1
    session.flush()
    return count


def _load_vm_costs(session: Session) -> int:
    """General VM running cost has no source sheet yet -- mirror every
    (year, VM) pair already loaded into license_cost, at cost_eur=0, so the
    infra cost table stays populated until real opex figures exist."""
    count = 0
    pairs = session.execute(select(LicenseCost.year, LicenseCost.virtual_machine_id).distinct())
    for year, virtual_machine_id in pairs:
        session.add(VmCost(year=year, virtual_machine_id=virtual_machine_id, cost_eur=Decimal("0")))
        count += 1
    session.flush()
    return count


def _load_process_schedules(
    session: Session,
    batch_id: int,
    processes: dict[str, Process],
    virtual_machines: dict[str, VirtualMachine],
) -> int:
    count = 0
    for row in _valid_rows(session, StagingSchedules, batch_id):
        raw = row.raw_row
        process = processes.get(process_matching_key(str(raw["PID"])))
        if process is None:
            _log_issue(
                session,
                batch_id,
                source_sheet=row.source_sheet,
                source_row_number=row.source_row_number,
                entity="process_schedule",
                issue_type="unmatched_process",
                severity="error",
                message=f"SCHEDULES row references unknown process '{raw['PID']}'",
            )
            continue
        virtual_machine_id = None
        vm_raw = raw.get("VM")
        if not _is_blank(vm_raw):
            vm = virtual_machines.get(normalize_vm_id(str(vm_raw)).normalized)
            virtual_machine_id = vm.id if vm is not None else None
        session.add(
            ProcessSchedule(
                process_id=process.id,
                scheduled_description=str(raw.get("SCHEDULED")).strip()
                if not _is_blank(raw.get("SCHEDULED"))
                else None,
                frequency=str(raw.get("FREQUENCY")).strip()
                if not _is_blank(raw.get("FREQUENCY"))
                else None,
                run_time=str(raw.get("HH_MM")).strip() if not _is_blank(raw.get("HH_MM")) else None,
                avg_minutes=normalize_decimal(raw.get("AVG")),
                virtual_machine_id=virtual_machine_id,
                run_user=str(raw.get("USER")).strip() if not _is_blank(raw.get("USER")) else None,
                rpa_hours_month=normalize_decimal(raw.get("RPA_H_MONTH")),
            )
        )
        count += 1
    session.flush()
    return count

    return Decimal("0")
