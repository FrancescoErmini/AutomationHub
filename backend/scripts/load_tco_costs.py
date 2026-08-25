"""Load data/raw/TCO.csv (the portfolio CAPEX/OPEX cost ledger) into
core.tco_cost. Standalone: does not depend on app/ingestion/, which is
being decommissioned separately.

Idempotent: truncates core.tco_cost before loading, so it's safe to
re-run whenever TCO.csv changes.

Usage (from backend/, with the venv active):
    DATABASE_URL=... python -m scripts.load_tco_costs [path/to/TCO.csv]
"""

import csv
import sys
from datetime import date
from decimal import Decimal
from pathlib import Path

import sqlalchemy as sa

from app.db.session import SessionLocal
from app.models.core import TcoCost

DEFAULT_CSV_PATH = Path(__file__).resolve().parents[2] / "data" / "raw" / "TCO.csv"
_EXPECTED_FIELDS = 5  # DATE;COST;TYPE;SUBTYPE;DESC


def _parse_row(fields: list[str]) -> dict[str, object]:
    # A small number of source rows carry one extra `;`-delimited empty
    # field (e.g. `01/04/2025;;60000;OPEX;AMS;AMS 2025-2026`), shifting
    # COST/TYPE/SUBTYPE/DESC right by one. Drop the first empty field to
    # recover the intended 5-column shape.
    if len(fields) > _EXPECTED_FIELDS:
        fields = fields.copy()
        for i, value in enumerate(fields[1:], start=1):
            if value.strip() == "":
                del fields[i]
                break

    if len(fields) != _EXPECTED_FIELDS:
        raise ValueError(f"expected {_EXPECTED_FIELDS} fields, got {len(fields)}: {fields!r}")

    raw_date, raw_cost, cost_type, subtype, description = (f.strip() for f in fields)
    day, month, year = raw_date.split("/")
    return {
        "cost_date": date(int(year), int(month), int(day)),
        "cost_eur": Decimal(raw_cost),
        "cost_type": cost_type,
        "subtype": subtype or None,
        "description": description or None,
    }


def load(csv_path: Path) -> int:
    with csv_path.open(newline="", encoding="utf-8") as f:
        reader = csv.reader(f, delimiter=";")
        header = next(reader)
        assert header == ["DATE", "COST", "TYPE", "SUBTYPE", "DESC"], f"unexpected header: {header}"
        rows = [_parse_row(fields) for fields in reader if any(f.strip() for f in fields)]

    with SessionLocal() as session:
        session.execute(sa.delete(TcoCost))
        session.execute(sa.insert(TcoCost), rows)
        session.commit()

    return len(rows)


if __name__ == "__main__":
    path = Path(sys.argv[1]) if len(sys.argv) > 1 else DEFAULT_CSV_PATH
    count = load(path)
    print(f"Loaded {count} rows from {path} into core.tco_cost")
