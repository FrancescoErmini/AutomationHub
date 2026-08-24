"""Loads the APQC PCF Life Sciences taxonomy (Category -> Process Group ->
Process, levels 1-3 only) from the official workbook's "Combined" sheet into
core.apqc_category / core.apqc_process_group / core.apqc_process.

Idempotent by natural key (PCF ID, globally unique in the source workbook):
existing rows are updated in place, new rows are inserted -- safe to rerun
whenever the workbook is refreshed. Levels 4 (Activity) and 5 (Task) are
present in the source but out of scope for the wizard's L1->L2->L3 mapping,
so they are counted and skipped, not ingested.
"""

from dataclasses import dataclass
from pathlib import Path

import openpyxl
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models.core import ApqcCategory, ApqcProcess, ApqcProcessGroup

_SHEET = "Combined"

_TaxonomyRow = tuple[int, str, str, str | None]


@dataclass(frozen=True)
class ApqcIngestionSummary:
    categories: int
    process_groups: int
    processes: int
    skipped: int


def _level(hierarchy_id: str) -> int:
    """1 for 'X.0' (Category), 2 for 'X.Y' (Process Group), 3 for 'X.Y.Z'
    (Process), 4/5 for Activity/Task -- deeper levels than the wizard needs."""
    parts = hierarchy_id.split(".")
    if len(parts) == 2 and parts[1] == "0":
        return 1
    return len(parts)


def _parent_hierarchy_id(hierarchy_id: str, level: int) -> str:
    parts = hierarchy_id.split(".")
    if level == 2:
        return f"{parts[0]}.0"
    return ".".join(parts[:-1])


def load_apqc_taxonomy_from_workbook(session: Session, path: Path) -> ApqcIngestionSummary:
    workbook = openpyxl.load_workbook(path, read_only=True, data_only=True)
    try:
        sheet = workbook[_SHEET]
        rows_by_level: dict[int, list[_TaxonomyRow]] = {1: [], 2: [], 3: []}
        skipped = 0
        for row in sheet.iter_rows(min_row=2, values_only=True):
            pcf_id, hierarchy_id, name = row[0], row[1], row[2]
            raw_description = row[6] if len(row) > 6 else None
            if pcf_id is None or hierarchy_id is None or name is None:
                continue
            level = _level(str(hierarchy_id))
            if level not in rows_by_level:
                skipped += 1
                continue
            description = str(raw_description) if raw_description is not None else None
            rows_by_level[level].append(
                (int(str(pcf_id)), str(hierarchy_id), str(name).strip(), description)
            )
    finally:
        workbook.close()

    category_ids = _upsert_categories(session, rows_by_level[1])
    process_group_ids = _upsert_process_groups(session, rows_by_level[2], category_ids)
    _upsert_processes(session, rows_by_level[3], process_group_ids)
    session.commit()

    return ApqcIngestionSummary(
        categories=len(rows_by_level[1]),
        process_groups=len(rows_by_level[2]),
        processes=len(rows_by_level[3]),
        skipped=skipped,
    )


def _upsert_categories(session: Session, rows: list[_TaxonomyRow]) -> dict[str, int]:
    existing = {category.pcf_id: category for category in session.scalars(select(ApqcCategory))}
    ids_by_hierarchy: dict[str, int] = {}
    for pcf_id, hierarchy_id, name, description in rows:
        category = existing.get(pcf_id)
        if category is None:
            category = ApqcCategory(
                pcf_id=pcf_id, hierarchy_id=hierarchy_id, name=name, description=description
            )
            session.add(category)
        else:
            category.hierarchy_id = hierarchy_id
            category.name = name
            category.description = description
        session.flush()
        ids_by_hierarchy[hierarchy_id] = category.id
    return ids_by_hierarchy


def _upsert_process_groups(
    session: Session, rows: list[_TaxonomyRow], category_ids: dict[str, int]
) -> dict[str, int]:
    existing = {group.pcf_id: group for group in session.scalars(select(ApqcProcessGroup))}
    ids_by_hierarchy: dict[str, int] = {}
    for pcf_id, hierarchy_id, name, description in rows:
        category_id = category_ids[_parent_hierarchy_id(hierarchy_id, level=2)]
        group = existing.get(pcf_id)
        if group is None:
            group = ApqcProcessGroup(
                pcf_id=pcf_id,
                hierarchy_id=hierarchy_id,
                name=name,
                description=description,
                category_id=category_id,
            )
            session.add(group)
        else:
            group.hierarchy_id = hierarchy_id
            group.name = name
            group.description = description
            group.category_id = category_id
        session.flush()
        ids_by_hierarchy[hierarchy_id] = group.id
    return ids_by_hierarchy


def _upsert_processes(
    session: Session, rows: list[_TaxonomyRow], process_group_ids: dict[str, int]
) -> None:
    existing = {process.pcf_id: process for process in session.scalars(select(ApqcProcess))}
    for pcf_id, hierarchy_id, name, description in rows:
        process_group_id = process_group_ids[_parent_hierarchy_id(hierarchy_id, level=3)]
        process = existing.get(pcf_id)
        if process is None:
            process = ApqcProcess(
                pcf_id=pcf_id,
                hierarchy_id=hierarchy_id,
                name=name,
                description=description,
                process_group_id=process_group_id,
            )
            session.add(process)
        else:
            process.hierarchy_id = hierarchy_id
            process.name = name
            process.description = description
            process.process_group_id = process_group_id
        session.flush()
