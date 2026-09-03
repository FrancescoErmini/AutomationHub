"""One-off importer: populate ``core.process.documentation_url`` from a CSV.

The CSV (``data/docs.csv``) has three columns: ``RPA ID (CMBD)`` (process
name), ``URL`` (link to the Google Drive folder holding the functional
documentation) and ``Description``.

Each CSV row is matched to exactly one ``core.process`` row, trying in order:

1. the process ``canonical_name`` equals the CSV name (normalised: lower-cased,
   whitespace-collapsed, trailing "." dropped);
2. failing that, the process ``description`` equals the CSV description, or one
   contains the other (normalised, with a length guard to avoid loose hits).

A row that matches zero processes, or more than one, is skipped and listed in
the final report. Rows with an empty URL are skipped too -- the process keeps a
NULL ``documentation_url``.

The script is idempotent: re-running it just re-applies the same links.

The source CSV lives at ``data/docs.csv`` in the repo root, which is not
mounted into the backend container, so copy it in first::

    docker cp data/docs.csv automation-hub-backend-1:/tmp/docs.csv
    docker exec automation-hub-backend-1 \\
        python -m scripts.import_documentation_urls /tmp/docs.csv

Or, with the local virtualenv, straight from the repo root::

    backend/.venv/bin/python -m scripts.import_documentation_urls --dry-run

``CSV_PATH`` positional arg defaults to ``data/docs.csv`` (cwd-relative).
Pass ``--dry-run`` to print the match report without writing.
"""

from __future__ import annotations

import argparse
import csv
import re
import sys
from pathlib import Path

from sqlalchemy import select

from app.db.session import SessionLocal
from app.models.core import Process

_DEFAULT_CSV = Path("data/docs.csv")
_MIN_DESC_MATCH_LEN = 40


def _norm(value: str | None) -> str:
    return re.sub(r"\s+", " ", (value or "").strip().lower()).rstrip(".")


def _desc_matches(csv_desc: str, db_desc: str) -> bool:
    a, b = _norm(csv_desc), _norm(db_desc)
    if not a or not b or min(len(a), len(b)) < _MIN_DESC_MATCH_LEN:
        return False
    return a == b or a in b or b in a


def _match(row_name: str, row_desc: str, processes: list[Process]) -> list[Process]:
    name_key = _norm(row_name)
    by_name = [p for p in processes if _norm(p.canonical_name) == name_key]
    if by_name:
        return by_name
    return [p for p in processes if p.description and _desc_matches(row_desc, p.description)]


def _read_rows(csv_path: Path) -> list[tuple[str, str, str]]:
    with csv_path.open(newline="", encoding="utf-8-sig") as handle:
        reader = csv.DictReader(handle)
        rows: list[tuple[str, str, str]] = []
        seen: set[tuple[str, str]] = set()
        for raw in reader:
            name = (raw.get("RPA ID (CMBD)") or "").strip()
            url = (raw.get("URL") or "").strip()
            desc = (raw.get("Description") or "").strip()
            if not name and not desc:
                continue
            key = (_norm(name), url)
            if key in seen:
                continue
            seen.add(key)
            rows.append((name, url, desc))
        return rows


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("csv_path", nargs="?", type=Path, default=_DEFAULT_CSV)
    parser.add_argument("--dry-run", action="store_true", help="report matches, write nothing")
    args = parser.parse_args()

    csv_path: Path = args.csv_path
    if not csv_path.is_file():
        print(f"error: CSV not found: {csv_path}", file=sys.stderr)
        return 1

    rows = _read_rows(csv_path)
    applied = 0
    no_url: list[str] = []
    unmatched: list[str] = []
    ambiguous: list[str] = []
    conflicts: list[str] = []

    with SessionLocal() as session:
        processes = list(session.scalars(select(Process)))
        assigned: dict[int, str] = {}

        for name, url, desc in rows:
            matches = _match(name, desc, processes)
            if len(matches) != 1:
                (unmatched if not matches else ambiguous).append(name)
                continue
            process = matches[0]
            if not url:
                no_url.append(name)
                continue
            if process.id in assigned and assigned[process.id] != url:
                conflicts.append(f"{process.canonical_name} <- {name}")
                continue
            assigned[process.id] = url
            if process.documentation_url != url:
                process.documentation_url = url
            applied += 1

        if args.dry_run:
            session.rollback()
        else:
            session.commit()

    print(f"CSV rows (deduped):   {len(rows)}")
    print(f"links {'to apply' if args.dry_run else 'applied'}:     {applied}")
    print(f"matched, empty URL:   {len(no_url)}")
    print(f"unmatched CSV rows:   {len(unmatched)}")
    print(f"ambiguous CSV rows:   {len(ambiguous)}")
    print(f"URL conflicts:        {len(conflicts)}")
    for label, items in (
        ("no URL", no_url),
        ("unmatched", unmatched),
        ("ambiguous", ambiguous),
        ("conflict", conflicts),
    ):
        for item in items:
            print(f"  [{label}] {item}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
