from pathlib import Path

import openpyxl
import pytest
from openpyxl.worksheet.worksheet import Worksheet

from app.ingestion.rpa_excel_reader import file_sha256, read_sheet, read_workbook

FIXTURE = Path(__file__).resolve().parents[3] / "data" / "fixtures" / "rpa_sample.xlsx"


def _sheet(rows: list[tuple[object, ...]]) -> Worksheet:
    workbook = openpyxl.Workbook()
    worksheet = workbook.active
    assert worksheet is not None
    for row in rows:
        worksheet.append(list(row))
    return worksheet


def test_read_sheet_drops_unlabeled_trailing_columns() -> None:
    worksheet = _sheet(
        [
            ("PID", "COST", None, None),
            ("RPA - Alpha", 100, "ignored", "also ignored"),
        ]
    )

    sheet = read_sheet(worksheet, "TCO")

    assert sheet.header == ["PID", "COST"]
    assert sheet.rows[0].values == {"PID": "RPA - Alpha", "COST": 100}


def test_read_sheet_excludes_fully_blank_rows() -> None:
    worksheet = _sheet(
        [
            ("PID",),
            ("RPA - Alpha",),
            (None,),
            ("",),
            ("RPA - Beta",),
        ]
    )

    sheet = read_sheet(worksheet, "PID")

    assert [row.values["PID"] for row in sheet.rows] == ["RPA - Alpha", "RPA - Beta"]


def test_read_sheet_preserves_source_row_numbers_across_blank_rows() -> None:
    worksheet = _sheet(
        [
            ("PID",),
            ("RPA - Alpha",),
            (None,),
            ("RPA - Beta",),
        ]
    )

    sheet = read_sheet(worksheet, "PID")

    assert [row.row_number for row in sheet.rows] == [2, 4]


def test_read_sheet_stops_scanning_after_a_long_trailing_blank_run() -> None:
    rows: list[tuple[object, ...]] = [("PID",), ("RPA - Alpha",)]
    rows.extend([(None,)] * 600)
    rows.append(("RPA - After The Excel Padding Tail",))
    worksheet = _sheet(rows)

    sheet = read_sheet(worksheet, "PID")

    assert [row.values["PID"] for row in sheet.rows] == ["RPA - Alpha"]


@pytest.mark.skipif(not FIXTURE.exists(), reason="fixture workbook not present")
def test_read_workbook_discovers_every_known_sheet() -> None:
    sheets = read_workbook(FIXTURE)

    assert [sheet.name for sheet in sheets] == [
        "PID",
        "PIPELINE",
        "TICKETS",
        "TICKETS_OUT",
        "SCHEDULES",
        "ECONOMICS",
        "TCO",
        "AMS 1L",
        "AMS 2L",
        "AMS RFC",
        "AMS SMS",
        "_VARIABLES",
        "AMS SLA",
        "LICENSES",
        "VMs",
    ]


def test_file_sha256_is_stable_for_the_same_bytes(tmp_path: Path) -> None:
    sample = tmp_path / "sample.bin"
    sample.write_bytes(b"same bytes")

    assert file_sha256(sample) == file_sha256(sample)
