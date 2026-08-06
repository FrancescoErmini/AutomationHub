import csv
from pathlib import Path


def read_csv(path: Path) -> tuple[list[str], list[dict[str, str | None]]]:
    with path.open(encoding="utf-8-sig", newline="") as source:
        reader = csv.DictReader(source)
        if reader.fieldnames is None:
            return [], []
        rows: list[dict[str, str | None]] = [dict(row) for row in reader]
        return list(reader.fieldnames), rows
