"""One-off importer: populate ``core.person`` / ``core.process_stakeholder``
from the RPA pipeline sheet's referent columns.

The CSV (``data/rpa-pipeline-stakeholders.csv``) has one row
per process, with a fixed set of referent columns mapping to the constrained
``STAKEHOLDER_ROLES`` (see ``app.schemas.process_stakeholder``). The
"Process Framework" column (process type) is not touched here.

Each CSV row is matched to exactly one ``core.process`` row by
``canonical_name`` (normalised: lower-cased, whitespace-collapsed, trailing
"." dropped) -- same join key and normalisation as
``scripts/import_documentation_urls.py``, since both scripts key off the same
"RPA ID (CMBD)" column. A row with a blank name, or a name matching zero or
more than one process, is skipped and listed in the final report.

A referent cell can hold more than one email (the sheet sometimes puts two on
separate lines within the same cell, e.g. "Overcoming supply value"'s
Business Process Owner) -- every email in a cell is imported. Duplicate CSV
rows for the same process (several RPA ids share identical referents, e.g.
"RPA - RABOT" appears four times) simply try to add the same links again;
already-linked (process, role, person) triples are skipped, not treated as
conflicts, since the model explicitly allows more than one person per role.

The script is idempotent: re-running it just skips links that already exist.

The source CSV lives at the repo root under ``data/``, which is not mounted
into the backend container, so copy it in first::

    docker cp "data/rpa-pipeline-stakeholders.csv" \\
        automation-hub-backend-1:/tmp/pipeline.csv
    docker exec automation-hub-backend-1 \\
        python -m scripts.import_stakeholders /tmp/pipeline.csv

Or, with the local virtualenv, straight from the repo root::

    backend/.venv/bin/python -m scripts.import_stakeholders --dry-run

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
from app.models.core import Person, Process, ProcessStakeholder
from app.schemas.process_stakeholder import STAKEHOLDER_ROLES

_DEFAULT_CSV = Path("data/rpa-pipeline-stakeholders.csv")

# CSV column header -> constrained role value.
_ROLE_COLUMNS: dict[str, str] = {
    "ICT referent": "ICT Referent",
    "Project referent": "Project Referent",
    "Business Process Owner": "Business Process Owner",
    "Project Business Referent": "Project Business Referent",
    "GAP Referent": "GAP Referent",
    "Supplier Project Manager": "Supplier Project Manager",
    "Supplier Developer(s)": "Supplier Developer",
}
assert set(_ROLE_COLUMNS.values()) == set(STAKEHOLDER_ROLES)


def _norm(value: str | None) -> str:
    return re.sub(r"\s+", " ", (value or "").strip().lower()).rstrip(".")


def _norm_loose(value: str | None) -> str:
    """Like ``_norm``, but also drops a trailing ' prd' -- some CSV rows
    carry a ' PRD' suffix that the matching process's canonical_name never
    had (mirrors ticket_import._normalize_process). Used only as a fallback
    when an exact match fails, since a handful of processes keep 'PRD'
    literally in their name (e.g. two near-duplicate rows, one with and one
    without the suffix) and an exact match must win over this fuzzy one."""
    key = _norm(value)
    if key.endswith(" prd"):
        key = key[:-4].rstrip()
    return key


def _find_process(raw_name: str, by_exact: dict[str, list[Process]], by_loose: dict[str, list[Process]]) -> list[Process]:
    exact = by_exact.get(_norm(raw_name), [])
    if exact:
        return exact
    return by_loose.get(_norm_loose(raw_name), [])


def _split_emails(cell: str) -> list[str]:
    """A cell can hold more than one email, one per line."""
    return [line.strip().lower() for line in cell.splitlines() if line.strip()]


def _read_rows(csv_path: Path) -> list[dict[str, str]]:
    with csv_path.open(newline="", encoding="utf-8-sig") as handle:
        reader = csv.DictReader(handle)
        missing = set(_ROLE_COLUMNS) - set(reader.fieldnames or [])
        if missing:
            raise SystemExit(f"error: missing columns in CSV: {', '.join(sorted(missing))}")
        return list(reader)


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

    unmatched: list[str] = []
    ambiguous: list[str] = []
    invalid_emails: list[str] = []
    people_created = 0
    links_added = 0
    links_existing = 0

    with SessionLocal() as session:
        processes = list(session.scalars(select(Process)))
        by_name_exact: dict[str, list[Process]] = {}
        by_name_loose: dict[str, list[Process]] = {}
        for p in processes:
            by_name_exact.setdefault(_norm(p.canonical_name), []).append(p)
            by_name_loose.setdefault(_norm_loose(p.canonical_name), []).append(p)

        people_by_email: dict[str, Person] = {
            p.email: p for p in session.scalars(select(Person))
        }
        existing_links: set[tuple[int, str, int]] = {
            (s.process_id, s.role, s.person_id)
            for s in session.scalars(select(ProcessStakeholder))
        }

        for row in rows:
            raw_name = (row.get("RPA ID (CMBD)") or "").strip()
            if not raw_name:
                continue

            matches = _find_process(raw_name, by_name_exact, by_name_loose)
            if len(matches) != 1:
                (unmatched if not matches else ambiguous).append(raw_name)
                continue
            process = matches[0]

            for column, role in _ROLE_COLUMNS.items():
                cell = row.get(column) or ""
                for email in _split_emails(cell):
                    if "@" not in email:
                        invalid_emails.append(f"{raw_name} / {role}: {email!r}")
                        continue

                    person = people_by_email.get(email)
                    if person is None:
                        person = Person(email=email)
                        session.add(person)
                        session.flush()  # assign person.id for the link below
                        people_by_email[email] = person
                        people_created += 1

                    key = (process.id, role, person.id)
                    if key in existing_links:
                        links_existing += 1
                        continue
                    session.add(ProcessStakeholder(process_id=process.id, role=role, person_id=person.id))
                    existing_links.add(key)
                    links_added += 1

        if args.dry_run:
            session.rollback()
        else:
            session.commit()

    print(f"CSV rows:             {len(rows)}")
    print(f"people created:       {people_created}")
    print(f"links {'to add' if args.dry_run else 'added'}:         {links_added}")
    print(f"links already there:  {links_existing}")
    print(f"unmatched CSV rows:   {len(unmatched)}")
    print(f"ambiguous CSV rows:   {len(ambiguous)}")
    print(f"invalid emails:       {len(invalid_emails)}")
    for label, items in (
        ("unmatched", unmatched),
        ("ambiguous", ambiguous),
        ("invalid email", invalid_emails),
    ):
        for item in items:
            print(f"  [{label}] {item}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
