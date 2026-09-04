import csv
import io
from collections import Counter
from datetime import date, datetime
from typing import Any

from sqlalchemy import select
from sqlalchemy.exc import SQLAlchemyError
from sqlalchemy.orm import Session

from app.core.exceptions import AppError, DataValidationError
from app.models.core import (
    AmsYear,
    Company,
    Priority,
    Process,
    RootCause,
    SupportLevel,
    Ticket,
)
from app.schemas.ticket_import import TicketImportReport, TicketImportRowReport

# Columns the importer reads; "ID" is deliberately ignored.
_REQUIRED_COLUMNS: frozenset[str] = frozenset(
    {
        "AMS_YEAR",
        "TICKET",
        "TICKET_TYPE",
        "PROCESS",
        "Processo",
        "REQUESTOR",
        "START DATE",
        "END DATE",
        "ROOT CAUSE",
        "IS 1L",
        "COMPANY",
        "NOTE",
    }
)

# Fields written to a ticket for a valid row (excludes created_at).
_TICKET_FIELDS: tuple[str, ...] = (
    "ticket_id",
    "ticket_type",
    "process_id",
    "requestor",
    "start_date",
    "end_date",
    "root_cause_id",
    "is_1l",
    "company_id",
    "ams_year_id",
    "note",
    "priority_id",
    "support_level_id",
    "ticket_color",
)


def _normalize_process(value: str) -> str:
    """Lower, trim, collapse inner whitespace, drop a trailing ' prd'."""
    key = " ".join(value.lower().split())
    if key.endswith(" prd"):
        key = key[:-4].rstrip()
    return key


def _parse_date(raw: str) -> tuple[date | None, bool]:
    """(value, ok). Blank -> (None, True). Unparseable -> (None, False)."""
    text = raw.strip()
    if not text:
        return None, True
    try:
        return datetime.strptime(text, "%d/%m/%Y").date(), True
    except ValueError:
        return None, False


class TicketImportService:
    def __init__(self, session: Session) -> None:
        self._session = session

    def run(self, *, content: bytes, commit: bool) -> TicketImportReport:
        rows = self._read_rows(content)
        refs = self._load_refs()

        skipped: list[TicketImportRowReport] = []
        valid: list[tuple[int, str, dict[str, Any]]] = []  # (line, ticket_id, fields)

        id_counts: Counter[str] = Counter(r["TICKET"].strip() for r in rows if r["TICKET"].strip())

        for offset, raw in enumerate(rows):
            line = offset + 2  # header is line 1
            errors, fields = self._process_row(raw, refs, id_counts)
            if errors:
                skipped.append(
                    TicketImportRowReport(
                        line=line,
                        ticket_id=raw["TICKET"].strip() or None,
                        action="skipped",
                        errors=errors,
                    )
                )
            else:
                valid.append((line, fields["ticket_id"], fields))

        if commit:
            inserted, updated, db_skips = self._apply(valid)
            skipped.extend(db_skips)
        else:
            inserted, updated = self._preview_counts(valid)

        skipped.sort(key=lambda r: r.line)
        return TicketImportReport(
            committed=commit,
            total_rows=len(rows),
            inserted=inserted,
            updated=updated,
            skipped=len(skipped),
            rows=skipped,
        )

    # -- parsing ---------------------------------------------------------------

    def _read_rows(self, content: bytes) -> list[dict[str, str]]:
        try:
            text = content.decode("utf-8-sig")
        except UnicodeDecodeError:
            raise DataValidationError("uploaded file is not valid UTF-8 text") from None

        reader = csv.DictReader(io.StringIO(text))
        if not reader.fieldnames:
            raise DataValidationError("uploaded file is empty or not a CSV")

        missing = _REQUIRED_COLUMNS - set(reader.fieldnames)
        if missing:
            raise DataValidationError(f"missing columns: {', '.join(sorted(missing))}")

        return [{k: (v or "") for k, v in row.items()} for row in reader]

    def _load_refs(self) -> dict[str, Any]:
        session = self._session
        processes: dict[str, int] = {
            _normalize_process(name): pid
            for pid, name in session.execute(select(Process.id, Process.canonical_name)).all()
        }
        root_causes = {
            name.strip().lower(): rid
            for rid, name in session.execute(select(RootCause.id, RootCause.name)).all()
        }
        companies = {
            name.strip().lower(): cid
            for cid, name in session.execute(select(Company.id, Company.name)).all()
        }
        ams_years = {
            code.strip().lower(): aid
            for aid, code in session.execute(select(AmsYear.id, AmsYear.code)).all()
        }
        support_levels = {
            code.strip().lower(): sid
            for sid, code in session.execute(select(SupportLevel.id, SupportLevel.code)).all()
        }
        priority_id = session.scalar(select(Priority.id).where(Priority.value == "3"))

        if priority_id is None:
            raise AppError("reference data missing: priority with value '3'")
        if "1l" not in support_levels or "2l" not in support_levels:
            raise AppError("reference data missing: support_level '1L' / '2L'")

        return {
            "processes": processes,
            "root_causes": root_causes,
            "companies": companies,
            "ams_years": ams_years,
            "support_levels": support_levels,
            "priority_id": priority_id,
        }

    # -- per-row validation --------------------------------------------------

    def _process_row(
        self,
        raw: dict[str, str],
        refs: dict[str, Any],
        id_counts: Counter[str],
    ) -> tuple[list[str], dict[str, Any]]:
        errors: list[str] = []

        ticket_id = raw["TICKET"].strip()
        if not ticket_id:
            errors.append("missing ticket id")
        elif id_counts[ticket_id] > 1:
            errors.append(f"duplicate ticket id in file ({id_counts[ticket_id]} occurrences)")

        ticket_type = raw["TICKET_TYPE"].strip()
        if not ticket_type:
            errors.append("missing ticket type")

        process_id: int | None = None
        p_raw, po_raw = raw["PROCESS"].strip(), raw["Processo"].strip()
        if not p_raw and not po_raw:
            errors.append("missing process")
        else:
            process_id = refs["processes"].get(_normalize_process(p_raw)) or refs["processes"].get(
                _normalize_process(po_raw)
            )
            if process_id is None:
                errors.append(f"unknown process: {(p_raw or po_raw)!r}")

        company_id: int | None = None
        c_raw = raw["COMPANY"].strip()
        if not c_raw:
            errors.append("missing company")
        else:
            company_id = refs["companies"].get(c_raw.lower())
            if company_id is None:
                errors.append(f"unknown company: {c_raw!r}")

        ams_year_id: int | None = None
        y_raw = raw["AMS_YEAR"].strip()
        if not y_raw:
            errors.append("missing AMS year")
        else:
            ams_year_id = refs["ams_years"].get(y_raw.lower())
            if ams_year_id is None:
                errors.append(f"unknown AMS year: {y_raw!r}")

        root_cause_id: int | None = None
        rc_raw = raw["ROOT CAUSE"].strip()
        if rc_raw:
            root_cause_id = refs["root_causes"].get(rc_raw.lower())
            if root_cause_id is None:
                errors.append(f"unknown root cause: {rc_raw!r}")

        is_1l: bool | None = None
        l_raw = raw["IS 1L"].strip()
        if l_raw.upper() == "TRUE":
            is_1l = True
        elif l_raw.upper() == "FALSE":
            is_1l = False
        else:
            errors.append(f"invalid IS 1L value: {l_raw!r}")

        start_date, start_ok = _parse_date(raw["START DATE"])
        if not start_ok:
            errors.append(f"invalid start date: {raw['START DATE'].strip()!r}")
        end_date, end_ok = _parse_date(raw["END DATE"])
        if not end_ok:
            errors.append(f"invalid end date: {raw['END DATE'].strip()!r}")

        if errors:
            return errors, {}

        assert is_1l is not None
        fields: dict[str, Any] = {
            "ticket_id": ticket_id,
            "ticket_type": ticket_type,
            "process_id": process_id,
            "requestor": raw["REQUESTOR"].strip() or None,
            "start_date": start_date,
            "end_date": end_date,
            "root_cause_id": root_cause_id,
            "is_1l": is_1l,
            "company_id": company_id,
            "ams_year_id": ams_year_id,
            "note": raw["NOTE"].strip() or None,
            "priority_id": refs["priority_id"],
            "support_level_id": refs["support_levels"]["1l" if is_1l else "2l"],
            "ticket_color": None,
        }
        return [], fields

    # -- apply / preview ---------------------------------------------------

    def _preview_counts(self, valid: list[tuple[int, str, dict[str, Any]]]) -> tuple[int, int]:
        if not valid:
            return 0, 0
        ids = [tid for _, tid, _ in valid]
        existing = set(
            self._session.scalars(select(Ticket.ticket_id).where(Ticket.ticket_id.in_(ids))).all()
        )
        updated = sum(1 for _, tid, _ in valid if tid in existing)
        return len(valid) - updated, updated

    def _apply(
        self, valid: list[tuple[int, str, dict[str, Any]]]
    ) -> tuple[int, int, list[TicketImportRowReport]]:
        inserted = updated = 0
        db_skips: list[TicketImportRowReport] = []

        for line, ticket_id, fields in valid:
            try:
                with self._session.begin_nested():
                    ticket = self._session.scalar(
                        select(Ticket).where(Ticket.ticket_id == ticket_id)
                    )
                    if ticket is None:
                        self._session.add(Ticket(**fields))
                        inserted += 1
                    else:
                        for name in _TICKET_FIELDS:
                            setattr(ticket, name, fields[name])
                        updated += 1
            except SQLAlchemyError as exc:
                db_skips.append(
                    TicketImportRowReport(
                        line=line,
                        ticket_id=ticket_id,
                        action="skipped",
                        errors=[f"db error: {type(exc).__name__}"],
                    )
                )

        self._session.commit()
        return inserted, updated, db_skips
