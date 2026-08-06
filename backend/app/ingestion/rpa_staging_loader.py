"""Load every row of the RPA workbook into source-shaped staging tables.

Every row ends up persisted with validation_status='valid' or 'rejected'
(with an auditable reason) -- never silently dropped. Normalization and
core-table loading happen in a later stage, from validated staging rows.
"""

import hashlib
import json
from dataclasses import dataclass
from datetime import UTC, date, datetime
from pathlib import Path
from typing import Any

from sqlalchemy.orm import Session

from app.db.base import Base
from app.ingestion.rpa_excel_reader import file_sha256, read_workbook
from app.models.audit import IngestionBatch
from app.models.staging import (
    StagingAms1L,
    StagingAms2L,
    StagingAmsRfc,
    StagingAmsSla,
    StagingAmsSms,
    StagingEconomics,
    StagingLicenses,
    StagingPid,
    StagingPipeline,
    StagingSchedules,
    StagingTco,
    StagingTickets,
    StagingTicketsOut,
    StagingVariables,
    StagingVms,
)

SHEET_MODELS: dict[str, type[Base]] = {
    "PID": StagingPid,
    "PIPELINE": StagingPipeline,
    "TICKETS": StagingTickets,
    "TICKETS_OUT": StagingTicketsOut,
    "SCHEDULES": StagingSchedules,
    "ECONOMICS": StagingEconomics,
    "TCO": StagingTco,
    "AMS 1L": StagingAms1L,
    "AMS 2L": StagingAms2L,
    "AMS RFC": StagingAmsRfc,
    "AMS SMS": StagingAmsSms,
    "AMS SLA": StagingAmsSla,
    "LICENSES": StagingLicenses,
    "VMs": StagingVms,
    "_VARIABLES": StagingVariables,
}

REQUIRED_COLUMNS: dict[str, frozenset[str]] = {
    "PID": frozenset({"PID"}),
    "PIPELINE": frozenset({"PID"}),
    "TICKETS": frozenset({"TICKET_ID", "PID"}),
    "TICKETS_OUT": frozenset({"Request Number"}),
    "SCHEDULES": frozenset({"PID"}),
    "ECONOMICS": frozenset({"PID"}),
    "TCO": frozenset({"COST"}),
    "AMS 1L": frozenset({"AMS Year"}),
    "AMS 2L": frozenset({"TICKET"}),
    "AMS RFC": frozenset(),
    "AMS SMS": frozenset({"TICKET"}),
    "AMS SLA": frozenset({"TICKET_TYPE"}),
    "LICENSES": frozenset({"Year", "VM"}),
    "VMs": frozenset({"VM"}),
    "_VARIABLES": frozenset({"NAME"}),
}


@dataclass(frozen=True)
class StagingLoadResult:
    batch_id: int
    total_rows: int
    valid_rows: int
    rejected_rows: int


def _is_blank(value: object) -> bool:
    return value is None or (isinstance(value, str) and not value.strip())


def _json_safe(values: dict[str, Any]) -> dict[str, Any]:
    return {
        key: value.isoformat() if isinstance(value, date | datetime) else value
        for key, value in values.items()
    }


def _row_hash(sheet_name: str, row_number: int, values: dict[str, Any]) -> str:
    payload = json.dumps(_json_safe(values), sort_keys=True, default=str)
    return hashlib.sha256(f"{sheet_name}:{row_number}:{payload}".encode()).hexdigest()


def _validate_row(sheet_name: str, values: dict[str, Any]) -> tuple[str, str | None]:
    missing = sorted(
        column
        for column in REQUIRED_COLUMNS.get(sheet_name, frozenset())
        if _is_blank(values.get(column))
    )
    if missing:
        return "rejected", f"missing_required_value:{','.join(missing)}"
    return "valid", None


def load_staging_from_workbook(session: Session, path: Path) -> StagingLoadResult:
    sheets = read_workbook(path)
    unknown_sheets = sorted({sheet.name for sheet in sheets} - set(SHEET_MODELS))
    if unknown_sheets:
        raise ValueError(f"No staging table mapped for workbook sheet(s): {unknown_sheets}")

    batch = IngestionBatch(source_file=str(path), source_hash=file_sha256(path), status="running")
    session.add(batch)
    session.flush()

    total = valid = rejected = 0
    for sheet in sheets:
        model_cls = SHEET_MODELS[sheet.name]
        for row in sheet.rows:
            status, reason = _validate_row(sheet.name, row.values)
            session.add(
                model_cls(
                    ingestion_batch_id=batch.id,
                    source_file=str(path),
                    source_sheet=sheet.name,
                    source_row_number=row.row_number,
                    source_hash=_row_hash(sheet.name, row.row_number, row.values),
                    validation_status=status,
                    rejection_reason=reason,
                    raw_row=_json_safe(row.values),
                )
            )
            total += 1
            if status == "valid":
                valid += 1
            else:
                rejected += 1

    batch.total_rows = total
    batch.valid_rows = valid
    batch.rejected_rows = rejected
    batch.status = "completed"
    batch.finished_at = datetime.now(UTC)
    session.commit()

    return StagingLoadResult(
        batch_id=batch.id, total_rows=total, valid_rows=valid, rejected_rows=rejected
    )
