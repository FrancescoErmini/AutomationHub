import csv
import io
from datetime import date, datetime
from decimal import Decimal, InvalidOperation
from typing import Any

from sqlalchemy.orm import Session

from app.core.exceptions import DataValidationError
from app.models.core import TcoCost
from app.schemas.tco_cost import COST_TYPES
from app.schemas.tco_cost_import import TcoCostImportReport, TcoCostImportRowReport

_REQUIRED_COLUMNS: frozenset[str] = frozenset(
    {"DATE", "TYPE", "SUBTYPE", "AMOUNT_EUR", "DESCRIPTION"}
)


def _parse_date(raw: str) -> tuple[date | None, bool]:
    text = raw.strip()
    if not text:
        return None, False
    try:
        return datetime.strptime(text, "%d/%m/%Y").date(), True
    except ValueError:
        return None, False


class TcoCostImportService:
    """Insert-only: unlike tickets, the cost ledger has no natural business
    key to match an existing row against, so every valid row becomes a new
    line item -- there is no update path."""

    def __init__(self, session: Session) -> None:
        self._session = session

    def run(self, *, content: bytes, commit: bool) -> TcoCostImportReport:
        rows = self._read_rows(content)

        skipped: list[TcoCostImportRowReport] = []
        valid: list[dict[str, Any]] = []

        for offset, raw in enumerate(rows):
            line = offset + 2  # header is line 1
            errors, fields = self._process_row(raw)
            if errors:
                skipped.append(
                    TcoCostImportRowReport(
                        line=line,
                        description=raw["DESCRIPTION"].strip() or None,
                        action="skipped",
                        errors=errors,
                    )
                )
            else:
                valid.append(fields)

        if commit:
            for fields in valid:
                self._session.add(TcoCost(**fields))
            self._session.commit()

        return TcoCostImportReport(
            committed=commit,
            total_rows=len(rows),
            inserted=len(valid),
            updated=0,
            skipped=len(skipped),
            rows=skipped,
        )

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

    def _process_row(self, raw: dict[str, str]) -> tuple[list[str], dict[str, Any]]:
        errors: list[str] = []

        cost_date, date_ok = _parse_date(raw["DATE"])
        if not date_ok:
            errors.append(f"invalid date: {raw['DATE'].strip()!r}")

        cost_type = raw["TYPE"].strip().upper()
        if cost_type not in COST_TYPES:
            errors.append(f"invalid type: {raw['TYPE'].strip()!r} (expected CAPEX or OPEX)")

        amount_raw = raw["AMOUNT_EUR"].strip().replace(",", ".")
        amount: Decimal | None = None
        if not amount_raw:
            errors.append("missing amount")
        else:
            try:
                amount = Decimal(amount_raw)
            except InvalidOperation:
                errors.append(f"invalid amount: {raw['AMOUNT_EUR'].strip()!r}")
            else:
                if amount < 0:
                    errors.append("amount must be >= 0")

        if errors:
            return errors, {}

        assert cost_date is not None and amount is not None
        return [], {
            "cost_date": cost_date,
            "cost_eur": amount,
            "cost_type": cost_type,
            "subtype": raw["SUBTYPE"].strip() or None,
            "description": raw["DESCRIPTION"].strip() or None,
        }
