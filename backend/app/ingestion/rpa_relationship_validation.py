"""Validate the 8 documented source relationships after a core load.

For each relationship: total rows, matched rows, unmatched rows, duplicate
candidates, match percentage, and a sample of unmatched raw values are
computed and persisted to ``audit.relationship_reconciliation``.

The default critical threshold is 95%. ``ticket_to_root_cause`` uses a lower,
documented threshold: roughly two thirds of tickets in the source AMS process
genuinely have no root cause recorded (see ``dq_root_cause_not_classified_pct``),
so a low match rate there is an expected data-quality characteristic of the
source system, not an ingestion-matching defect.
"""

from dataclasses import dataclass
from decimal import ROUND_HALF_UP, Decimal
from typing import TypeVar

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.ingestion.normalization import (
    normalize_ams_year,
    normalize_company,
    normalize_text_key,
    normalize_vm_id,
    process_matching_key,
)
from app.models.audit import RelationshipReconciliation
from app.models.core import AmsYear, Company, Process, RootCause, Ticket, VirtualMachine
from app.models.staging import (
    StagingAms1L,
    StagingAms2L,
    StagingEconomics,
    StagingLicenses,
    StagingRowMixin,
    StagingSchedules,
    StagingTickets,
)

_T = TypeVar("_T", bound=StagingRowMixin)

DEFAULT_THRESHOLD_PCT = Decimal("95.0")
ROOT_CAUSE_THRESHOLD_PCT = Decimal("20.0")
_SAMPLE_LIMIT = 5


@dataclass(frozen=True)
class RelationshipCheck:
    relationship_name: str
    total_rows: int
    matched_rows: int
    unmatched_rows: int
    duplicate_candidates: int
    match_pct: Decimal
    threshold_pct: Decimal
    sample_unmatched: list[str]

    @property
    def below_threshold(self) -> bool:
        return self.match_pct < self.threshold_pct


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


def _pct(matched: int, eligible: int) -> Decimal:
    if eligible == 0:
        return Decimal("0.000")
    return (Decimal(matched) / Decimal(eligible) * 100).quantize(
        Decimal("0.001"), rounding=ROUND_HALF_UP
    )


def _check_ticket_relationships(session: Session, batch_id: int) -> list[RelationshipCheck]:
    rows = _valid_rows(session, StagingTickets, batch_id)
    process_keys = set(session.scalars(select(Process.normalized_key)))
    company_names = set(session.scalars(select(Company.name)))
    root_cause_names = set(session.scalars(select(RootCause.name)))

    seen_ticket_ids: set[str] = set()
    duplicates = 0
    process_matched = process_unmatched = 0
    company_matched = company_unmatched = 0
    root_cause_matched = root_cause_unmatched = 0
    process_samples: list[str] = []
    company_samples: list[str] = []
    root_cause_samples: list[str] = []

    for row in rows:
        raw = row.raw_row
        ticket_id = str(raw.get("TICKET_ID") or "").strip()
        if ticket_id in seen_ticket_ids:
            duplicates += 1
            continue
        seen_ticket_ids.add(ticket_id)

        pid_raw = raw.get("PID")
        if not _is_blank(pid_raw) and process_matching_key(str(pid_raw)) in process_keys:
            process_matched += 1
        else:
            process_unmatched += 1
            if not _is_blank(pid_raw) and len(process_samples) < _SAMPLE_LIMIT:
                process_samples.append(str(pid_raw))

        company_raw = raw.get("COMPANY")
        normalized_company = (
            normalize_company(str(company_raw)) if not _is_blank(company_raw) else None
        )
        if normalized_company is not None and normalized_company.normalized in company_names:
            company_matched += 1
        else:
            company_unmatched += 1
            if not _is_blank(company_raw) and len(company_samples) < _SAMPLE_LIMIT:
                company_samples.append(str(company_raw))

        root_cause_raw = raw.get("ROOT_CAUSE")
        if (
            not _is_blank(root_cause_raw)
            and normalize_text_key(str(root_cause_raw)).normalized in root_cause_names
        ):
            root_cause_matched += 1
        else:
            root_cause_unmatched += 1
            if not _is_blank(root_cause_raw) and len(root_cause_samples) < _SAMPLE_LIMIT:
                root_cause_samples.append(str(root_cause_raw))

    eligible = len(rows) - duplicates
    return [
        RelationshipCheck(
            "ticket_to_process",
            len(rows),
            process_matched,
            process_unmatched,
            duplicates,
            _pct(process_matched, eligible),
            DEFAULT_THRESHOLD_PCT,
            process_samples,
        ),
        RelationshipCheck(
            "ticket_to_company",
            len(rows),
            company_matched,
            company_unmatched,
            duplicates,
            _pct(company_matched, eligible),
            DEFAULT_THRESHOLD_PCT,
            company_samples,
        ),
        RelationshipCheck(
            "ticket_to_root_cause",
            len(rows),
            root_cause_matched,
            root_cause_unmatched,
            duplicates,
            _pct(root_cause_matched, eligible),
            ROOT_CAUSE_THRESHOLD_PCT,
            root_cause_samples,
        ),
    ]


def _check_economics_to_process(session: Session, batch_id: int) -> RelationshipCheck:
    rows = _valid_rows(session, StagingEconomics, batch_id)
    process_keys = set(session.scalars(select(Process.normalized_key)))

    matched = unmatched = 0
    samples: list[str] = []
    for row in rows:
        pid_raw = row.raw_row.get("PID")
        if not _is_blank(pid_raw) and process_matching_key(str(pid_raw)) in process_keys:
            matched += 1
        else:
            unmatched += 1
            if not _is_blank(pid_raw) and len(samples) < _SAMPLE_LIMIT:
                samples.append(str(pid_raw))

    return RelationshipCheck(
        "economics_to_process",
        len(rows),
        matched,
        unmatched,
        0,
        _pct(matched, len(rows)),
        DEFAULT_THRESHOLD_PCT,
        samples,
    )


def _check_ams_2l_cost_to_ticket(session: Session, batch_id: int) -> RelationshipCheck:
    rows = _valid_rows(session, StagingAms2L, batch_id)
    ticket_ids = set(session.scalars(select(Ticket.ticket_id)))

    matched = unmatched = 0
    samples: list[str] = []
    for row in rows:
        ticket_raw = row.raw_row.get("TICKET")
        if not _is_blank(ticket_raw) and str(ticket_raw).strip() in ticket_ids:
            matched += 1
        else:
            unmatched += 1
            if not _is_blank(ticket_raw) and len(samples) < _SAMPLE_LIMIT:
                samples.append(str(ticket_raw))

    return RelationshipCheck(
        "ams_2l_cost_to_ticket",
        len(rows),
        matched,
        unmatched,
        0,
        _pct(matched, len(rows)),
        DEFAULT_THRESHOLD_PCT,
        samples,
    )


def _check_ams_1l_cost_to_year(session: Session, batch_id: int) -> RelationshipCheck:
    rows = _valid_rows(session, StagingAms1L, batch_id)
    ams_year_codes = set(session.scalars(select(AmsYear.code)))

    matched = unmatched = 0
    samples: list[str] = []
    for row in rows:
        year_raw = row.raw_row.get("AMS Year")
        result = normalize_ams_year(str(year_raw)) if not _is_blank(year_raw) else None
        if result is not None and result.normalized in ams_year_codes:
            matched += 1
        else:
            unmatched += 1
            if not _is_blank(year_raw) and len(samples) < _SAMPLE_LIMIT:
                samples.append(str(year_raw))

    return RelationshipCheck(
        "ams_1l_cost_to_year",
        len(rows),
        matched,
        unmatched,
        0,
        _pct(matched, len(rows)),
        DEFAULT_THRESHOLD_PCT,
        samples,
    )


def _check_license_cost_to_year(session: Session, batch_id: int) -> RelationshipCheck:
    rows = _valid_rows(session, StagingLicenses, batch_id)

    matched = unmatched = 0
    samples: list[str] = []
    for row in rows:
        year_raw = row.raw_row.get("Year")
        if isinstance(year_raw, int | float):
            matched += 1
        else:
            unmatched += 1
            if not _is_blank(year_raw) and len(samples) < _SAMPLE_LIMIT:
                samples.append(str(year_raw))

    return RelationshipCheck(
        "license_cost_to_year",
        len(rows),
        matched,
        unmatched,
        0,
        _pct(matched, len(rows)),
        DEFAULT_THRESHOLD_PCT,
        samples,
    )


def _check_schedule_to_vm(session: Session, batch_id: int) -> RelationshipCheck:
    rows = _valid_rows(session, StagingSchedules, batch_id)
    vm_ids = set(session.scalars(select(VirtualMachine.normalized_id)))

    matched = unmatched = 0
    samples: list[str] = []
    for row in rows:
        vm_raw = row.raw_row.get("VM")
        if not _is_blank(vm_raw) and normalize_vm_id(str(vm_raw)).normalized in vm_ids:
            matched += 1
        else:
            unmatched += 1
            if not _is_blank(vm_raw) and len(samples) < _SAMPLE_LIMIT:
                samples.append(str(vm_raw))

    return RelationshipCheck(
        "schedule_to_vm",
        len(rows),
        matched,
        unmatched,
        0,
        _pct(matched, len(rows)),
        DEFAULT_THRESHOLD_PCT,
        samples,
    )


def validate_relationships(session: Session, batch_id: int) -> list[RelationshipCheck]:
    checks: list[RelationshipCheck] = [
        *_check_ticket_relationships(session, batch_id),
        _check_economics_to_process(session, batch_id),
        _check_ams_2l_cost_to_ticket(session, batch_id),
        _check_ams_1l_cost_to_year(session, batch_id),
        _check_license_cost_to_year(session, batch_id),
        _check_schedule_to_vm(session, batch_id),
    ]

    for check in checks:
        session.add(
            RelationshipReconciliation(
                ingestion_batch_id=batch_id,
                relationship_name=check.relationship_name,
                total_rows=check.total_rows,
                matched_rows=check.matched_rows,
                unmatched_rows=check.unmatched_rows,
                duplicate_candidates=check.duplicate_candidates,
                match_pct=check.match_pct,
                threshold_pct=check.threshold_pct,
                sample_unmatched=check.sample_unmatched,
            )
        )
    session.commit()

    return checks
