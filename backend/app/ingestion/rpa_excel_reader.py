"""Dynamic, source-shaped reader for the RPA analytics workbook.

Discovers every sheet and reads every populated row without assuming a fixed
column layout beyond the header row itself. The only thing treated as "not
data" is the trailing run of fully-empty rows that Excel pads a worksheet's
declared dimension with (openpyxl otherwise reports millions of blank rows
for some sheets) -- everything else, including isolated blank rows within the
real data region, is preserved as a row for staging/validation to decide on.
"""

import hashlib
from dataclasses import dataclass
from pathlib import Path
from typing import Any

import openpyxl
from openpyxl.worksheet.worksheet import Worksheet

TRAILING_EMPTY_ROW_STOP = 500


@dataclass(frozen=True)
class SheetRow:
    row_number: int
    values: dict[str, Any]


@dataclass(frozen=True)
class SheetData:
    name: str
    header: list[str]
    rows: list[SheetRow]


def file_sha256(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as source:
        for chunk in iter(lambda: source.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def _header_columns(header_row: tuple[object, ...]) -> list[tuple[int, str]]:
    columns: list[tuple[int, str]] = []
    for index, value in enumerate(header_row):
        if value is None:
            continue
        label = str(value).strip()
        if label:
            columns.append((index, label))
    return columns


def _is_blank(value: object) -> bool:
    return value is None or (isinstance(value, str) and not value.strip())


def read_sheet(worksheet: Worksheet, name: str) -> SheetData:
    row_iterator = worksheet.iter_rows(values_only=True)
    try:
        header_row = next(row_iterator)
    except StopIteration:
        return SheetData(name=name, header=[], rows=[])

    columns = _header_columns(header_row)
    header = [label for _, label in columns]

    rows: list[SheetRow] = []
    empty_run = 0
    row_number = 1
    for values in row_iterator:
        row_number += 1
        row_values = {
            label: (values[index] if index < len(values) else None) for index, label in columns
        }
        if all(_is_blank(value) for value in row_values.values()):
            # A row with no value in any header column is not source data --
            # it is Excel's over-allocated worksheet grid, not a business
            # row -- so it is excluded rather than staged as a fake reject.
            empty_run += 1
            if empty_run >= TRAILING_EMPTY_ROW_STOP:
                break
            continue
        empty_run = 0
        rows.append(SheetRow(row_number=row_number, values=row_values))

    return SheetData(name=name, header=header, rows=rows)


def read_workbook(path: Path) -> list[SheetData]:
    workbook = openpyxl.load_workbook(path, read_only=True, data_only=True)
    try:
        return [read_sheet(workbook[sheet_name], sheet_name) for sheet_name in workbook.sheetnames]
    finally:
        workbook.close()
