"""Independent Excel oracle for reconciliation tests.

Reads the RPA workbook directly with openpyxl and recomputes, from scratch,
the figures listed under "At minimum reconcile" in the brief. Deliberately
imports nothing from ``app.*`` -- no ingestion module, no service, no
repository -- so a bug shared between the oracle and the production pipeline
cannot hide a reconciliation failure.

The one data-cleaning rule replicated here (not a business formula, just a
stated identity rule): a raw TICKETS row with a blank TICKET_ID is excluded,
and when a TICKET_ID repeats, the first occurrence by row order is kept.
This mirrors core.ticket's own documented dedup rule and is required to
define "distinct ticket count" the same way on both sides.
"""

import re
from dataclasses import dataclass
from datetime import date, datetime
from decimal import Decimal, InvalidOperation
from pathlib import Path
from typing import Any

import openpyxl

_WHITESPACE_RE = re.compile(r"\s+")


def normalize_key(value: object) -> str:
    return _WHITESPACE_RE.sub(" ", str(value)).strip().casefold()


def _is_blank(value: object) -> bool:
    return value is None or (isinstance(value, str) and not value.strip())


def read_sheet_rows(path: Path, sheet_name: str) -> list[dict[str, Any]]:
    workbook = openpyxl.load_workbook(path, read_only=True, data_only=True)
    try:
        worksheet = workbook[sheet_name]
        row_iterator = worksheet.iter_rows(values_only=True)
        header = next(row_iterator)
        columns = [
            (index, str(value).strip())
            for index, value in enumerate(header)
            if value is not None and str(value).strip()
        ]
        rows: list[dict[str, Any]] = []
        for values in row_iterator:
            row = {
                name: (values[index] if index < len(values) else None) for index, name in columns
            }
            if any(not _is_blank(value) for value in row.values()):
                rows.append(row)
        return rows
    finally:
        workbook.close()


def parse_decimal(value: object) -> Decimal | None:
    if value is None:
        return None
    if isinstance(value, Decimal):
        return value
    if isinstance(value, int | float):
        return Decimal(str(value))
    text = str(value).strip()
    if text in {"", "-"}:
        return None
    text = text.replace(",", "").replace("€", "").strip()
    try:
        return Decimal(text)
    except InvalidOperation:
        return None


# The source is predominantly "DD/MM/YYYY" but at least one row uses dashes
# ("20-05-2026"); both are accepted here for the same reason production does.
_DATE_FORMATS = ("%d/%m/%Y", "%d-%m-%Y")


def _parse_date(value: object) -> date | None:
    if isinstance(value, datetime):
        return value.date()
    if isinstance(value, date):
        return value
    if value is None:
        return None
    text = str(value).strip()
    if not text:
        return None
    for date_format in _DATE_FORMATS:
        try:
            return datetime.strptime(text, date_format).date()
        except ValueError:
            continue
    return None


@dataclass(frozen=True)
class TicketOracle:
    raw_row_count: int
    distinct_ticket_count: int
    open_count: int
    closed_count: int
    l1_count: int
    l2_count: int
    company_totals: dict[str, int]
    process_totals: dict[str, int]
    root_cause_totals: dict[str, int]


def compute_ticket_oracle(path: Path) -> TicketOracle:
    rows = read_sheet_rows(path, "TICKETS")
    raw_row_count = len(rows)

    distinct: dict[str, dict[str, Any]] = {}
    for row in rows:
        ticket_id = row.get("TICKET_ID")
        if _is_blank(ticket_id):
            continue
        key = str(ticket_id).strip()
        if key not in distinct:
            distinct[key] = row

    distinct_rows = list(distinct.values())
    open_count = sum(1 for row in distinct_rows if _is_blank(row.get("END_DATE")))
    closed_count = len(distinct_rows) - open_count
    l1_count = sum(1 for row in distinct_rows if str(row.get("IS_1L")).strip().casefold() == "true")
    l2_count = sum(
        1 for row in distinct_rows if str(row.get("IS_1L")).strip().casefold() == "false"
    )

    company_totals: dict[str, int] = {}
    process_totals: dict[str, int] = {}
    root_cause_totals: dict[str, int] = {}
    for row in distinct_rows:
        company = row.get("COMPANY")
        if not _is_blank(company):
            key = normalize_key(company)
            company_totals[key] = company_totals.get(key, 0) + 1
        process = row.get("PID")
        if not _is_blank(process):
            key = normalize_key(process)
            process_totals[key] = process_totals.get(key, 0) + 1
        root_cause = row.get("ROOT_CAUSE")
        if not _is_blank(root_cause):
            key = normalize_key(root_cause)
            root_cause_totals[key] = root_cause_totals.get(key, 0) + 1

    return TicketOracle(
        raw_row_count=raw_row_count,
        distinct_ticket_count=len(distinct_rows),
        open_count=open_count,
        closed_count=closed_count,
        l1_count=l1_count,
        l2_count=l2_count,
        company_totals=company_totals,
        process_totals=process_totals,
        root_cause_totals=root_cause_totals,
    )


def compute_resolution_days(path: Path) -> list[int]:
    """Resolution days for the same distinct, closed-with-valid-dates ticket set."""
    rows = read_sheet_rows(path, "TICKETS")
    distinct: dict[str, dict[str, Any]] = {}
    for row in rows:
        ticket_id = row.get("TICKET_ID")
        if _is_blank(ticket_id):
            continue
        key = str(ticket_id).strip()
        if key not in distinct:
            distinct[key] = row

    days: list[int] = []
    for row in distinct.values():
        start = _parse_date(row.get("START_DATE"))
        end = _parse_date(row.get("END_DATE"))
        if start is not None and end is not None:
            days.append((end - start).days)
    return days


def compute_annual_saving_eur(path: Path) -> Decimal:
    bc_saving: Decimal | None = None
    for row in read_sheet_rows(path, "_VARIABLES"):
        if row.get("NAME") == "cost_per_hour_FTE":
            bc_saving = parse_decimal(row.get("VALUE"))
    if bc_saving is None:
        return Decimal("0")

    total = Decimal("0")
    for row in read_sheet_rows(path, "ECONOMICS"):
        fte_hours = parse_decimal(row.get("FTE_H_MONTH"))
        if fte_hours is not None:
            total += bc_saving * fte_hours * 12
    return total


def compute_ams_1l_cost_total(path: Path) -> Decimal:
    total = Decimal("0")
    for row in read_sheet_rows(path, "AMS 1L"):
        fee = parse_decimal(row.get("ANNUAL FEE"))
        if fee is not None:
            total += fee
    return total


def compute_ams_2l_cost_total(path: Path, *, valid_ticket_ids: set[str] | None = None) -> Decimal:
    """Sum COST_PER_TICKET. If ``valid_ticket_ids`` is given, rows whose
    TICKET does not resolve to a known ticket are excluded -- this mirrors
    core's own referential-integrity rule (an AMS 2L cost row for a ticket
    that does not exist is a genuine data-quality gap, not a business
    formula), not something the oracle invents independently."""
    total = Decimal("0")
    for row in read_sheet_rows(path, "AMS 2L"):
        if valid_ticket_ids is not None:
            ticket_id = row.get("TICKET")
            if _is_blank(ticket_id) or str(ticket_id).strip() not in valid_ticket_ids:
                continue
        cost = parse_decimal(row.get("COST_PER_TICKET"))
        if cost is not None:
            total += cost
    return total


def compute_license_cost_by_year(path: Path) -> dict[int, Decimal]:
    totals: dict[int, Decimal] = {}
    for row in read_sheet_rows(path, "LICENSES"):
        year_raw = row.get("Year")
        cost = parse_decimal(row.get("COST_YEAR"))
        if isinstance(year_raw, int | float) and cost is not None:
            year = int(year_raw)
            totals[year] = totals.get(year, Decimal("0")) + cost
    return totals
