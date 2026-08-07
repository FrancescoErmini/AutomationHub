"""Loads the curated AMS RFC/amendment CSV into core.ams_rfc_cost.

Distinct from the workbook-driven staging/core pipeline: this CSV
(data/raw/RPA_AMS_RFC_Amendment.csv) is a manually cleaned promotion of the
raw, unvalidated "AMS RFC" sheet, with real PID/year/cost columns. It is not
part of the Excel re-ingestion cycle, so it is loaded and full-replaced
independently -- safe to rerun if the source CSV is edited.
"""

import csv
from decimal import Decimal
from pathlib import Path

from sqlalchemy import delete, select
from sqlalchemy.orm import Session

from app.ingestion.normalization import normalize_decimal
from app.models.core import AmsRfcCost, Process


def _is_blank(value: str | None) -> bool:
    return value is None or not value.strip()


def load_ams_rfc_costs_from_csv(session: Session, path: Path) -> int:
    process_ids_by_name = {
        name.casefold(): process_id
        for name, process_id in session.execute(select(Process.canonical_name, Process.id))
    }

    with path.open(encoding="utf-8-sig", newline="") as source:
        reader = csv.DictReader(source, delimiter=";")
        rows = [row for row in reader if not _is_blank(row.get("PID"))]

    session.execute(delete(AmsRfcCost))

    count = 0
    for row in rows:
        year_raw = row.get("Year")
        if _is_blank(year_raw):
            continue
        pid = str(row["PID"]).strip()
        session.add(
            AmsRfcCost(
                process_id=process_ids_by_name.get(pid.casefold()),
                rfc_ref=str(row["Ticket_Ref"]).strip()
                if not _is_blank(row.get("Ticket_Ref"))
                else None,
                year=int(str(year_raw).strip()),
                description=str(row["DESC"]).strip() if not _is_blank(row.get("DESC")) else None,
                man_days=normalize_decimal(row.get("Man_Day")),
                root_cause_raw=str(row["ROOT CAUSE"]).strip()
                if not _is_blank(row.get("ROOT CAUSE"))
                else None,
                note=str(row["NOTE"]).strip() if not _is_blank(row.get("NOTE")) else None,
                cost_eur=normalize_decimal(row.get("COST")) or Decimal("0"),
            )
        )
        count += 1
    session.flush()
    return count
