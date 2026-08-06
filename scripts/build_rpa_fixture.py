"""Generate a small synthetic workbook mirroring data/raw/RPA - o365.xlsx shapes and
known data-quality quirks, for fast unit / data-quality tests. Does not contain any
real business data.
"""

import datetime
from pathlib import Path

import openpyxl

OUT = Path(__file__).parent.parent / "data" / "fixtures" / "rpa_sample.xlsx"

wb = openpyxl.Workbook()
wb.remove(wb.active)


def sheet(name: str, header: list[str], rows: list[list[object]]) -> None:
    ws = wb.create_sheet(name)
    ws.append(header)
    for row in rows:
        ws.append(row)


# PID: canonical master process list (includes a process only present here, and
# whitespace/case variants of names that also appear in PIPELINE/TICKETS).
sheet(
    "PID",
    ["PID"],
    [
        ["RPA - Test Alpha"],
        ["RPA - Test Beta"],
        ["RPA - Test Gamma"],
        ["RPA - Only In PID"],
        ["RPA - Test Delta"],
    ],
)

# PIPELINE: enrichment. "RPA - Test Beta " (trailing space) and " rpa - test gamma"
# (leading space + lowercase) exercise trim+casefold matching.
sheet(
    "PIPELINE",
    [
        "PID",
        "DESCRIPTION",
        "DEPARTEMENT",
        "STATUS",
        "Company",
        "Customer Company",
        "AMS Year",
        "Go-Live date",
    ],
    [
        ["RPA - Test Alpha", "Alpha description", "Finance", "In production", "Menarini", "Menarini", "1st", "1/6/2021"],
        ["RPA - Test Beta ", "Beta description", "Supply Chain", "In production", "Codifi", "Codifi", "1st", "3/9/2021"],
        [" rpa - test gamma", "Gamma description", "Finance", "In development", "Menarini", "Menarini", "2nd", "5/1/2022"],
        ["RPA - Test Delta", "Delta description", "Customer Service", "In production", "Codifi", "Codifi", "2nd", "9/3/2022"],
    ],
)

# TICKETS: includes a duplicate TICKET_ID, a blank ROOT_CAUSE, an open ticket
# (blank END_DATE), and a reference to the PID-only process.
sheet(
    "TICKETS",
    [
        "ID",
        "AMS_YEAR",
        "TICKET_ID",
        "TICKET_TYPE",
        "PRIORITY",
        "PID",
        "REQUESTOR",
        "START_DATE",
        "END_DATE",
        "ROOT_CAUSE",
        "IS_1L",
        "COMPANY",
        "NOTE",
    ],
    [
        [1, "I", "I240101_000001", "Incident", "3", "RPA - Test Alpha", "Doe, Jane", "01/01/2024", "02/01/2024", "Problema Funzionale RPA", "True", "Menarini", ""],
        [2, "I", "I240102_000002", "Service Request", "3", "RPA - Test Beta ", "Doe, Jane", "02/01/2024", "05/01/2024", "", "False", "Codifi", ""],
        [3, "II", "I240103_000003", "Incident", "3", " rpa - test gamma", "Doe, Jane", "03/01/2024", "", "", "True", "Menarini", "open ticket"],
        [4, "I", "I240104_000004", "Incident", "3", "RPA - Only In PID", "Doe, Jane", "04/01/2024", "04/01/2024", "Evasione SR", "True", "Codifi", ""],
        [5, "I", "I240105_000005", "Incident", "3", "RPA - Unknown Process", "Doe, Jane", "05/01/2024", "06/01/2024", "", "True", "Menarini", "unmatched process"],
        [6, "I", "I240106_000006", "Incident", "3", "RPA - Test Alpha", "Doe, Jane", "06/01/2024", "06/01/2024", "", "True", "Menarini", "duplicate id below"],
        [6, "I", "I240106_000006", "Incident", "3", "RPA - Test Alpha", "Doe, Jane", "06/01/2024", "07/01/2024", "", "True", "Menarini", "duplicate ticket id"],
        [7, "I", None, "Incident", "3", "RPA - Test Alpha", "Doe, Jane", "08/01/2024", "08/01/2024", "", "True", "Menarini", "missing ticket id - must be rejected"],
    ],
)

# TICKETS_OUT: unrelated helpdesk log, no PID/root cause link (staged/audited only).
sheet(
    "TICKETS_OUT",
    [
        "Request Number",
        "Creation Date",
        "Root Cause",
        "Category",
        "Service/Application",
        "COMMENT",
        "Priority",
        "Status",
        "Time Status",
        "End Date",
        "Time to Solve (mm)",
        "Solved by (Support Person)",
        "Company",
    ],
    [
        ["S240101_000001", "01/01/2024 10:00:00", None, "Datacenter & Systems Italian Sites", "Servers Management", "note", 3, "O-Closed", 0, "02/01/2024 10:00:00", 1440, "Vendor Support", "A. Menarini I.F.R. - Corporate"],
    ],
)

# SCHEDULES: Windows-named VM referencing the canonical Linux VM id after normalization.
sheet(
    "SCHEDULES",
    ["PID", "SCHEDULED", "FREQUENCY", "HH_MM", "AVG", "VM", "USER", "RPA_H_MONTH"],
    [
        ["RPA - Test Alpha", "Monday - Friday", "", "2:00", "60", "MCDWINRPAP21", "DWUSER", "20"],
        ["RPA - Test Beta ", "Daily", "", "1:00", "30", "MCDWINRPAP22", "DWUSER", "10"],
    ],
)

# ECONOMICS: string CAPEX with thousands comma + trailing space; "-" as a null NOTE.
sheet(
    "ECONOMICS",
    ["PID", "CAPEX", "ROI_EXPECTED_YR", "FTE_H_MONTH", "EXTRA_ANNUAL_SAVING_EUR", "NOTE"],
    [
        ["RPA - Test Alpha", "12,500.00 ", 5, 40, 0, "-"],
        ["RPA - Test Beta ", "8,200.50 ", 5, 15.5, 100, "note"],
    ],
)

# TCO: columns A:G authoritative; mirrored columns H+ are a known source artifact;
# one row has the real company/desc shape, one has the pre-2024 column-shift defect,
# and one row has a clearly invalid year (typo) that must be flagged, not silently used.
sheet(
    "TCO",
    ["ORDER ID", "DATE", "COST", "TYPE", "SUBTYPE", "DESC", "COMPANY", None, None, None, None],
    [
        [None, 2021, 15000, "CAPEX", "DEVELOPMENT", None, "RPA: Test Alpha", None, None, 2021, 15000],
        [5600000001, datetime.datetime(2024, 3, 1), 4200, "OPEX", "AMS", "RPA: Test Beta", "CODIFI S.r.l. - Consorzio Stabile per la Distribuzione", None, None, datetime.datetime(2024, 3, 1), 4200],
        [5600000002, datetime.datetime(2924, 3, 2), 900, "OPEX", "CR", "RPA: Test Alpha", "A. Menarini Industrie Farmaceutiche Riunite S.r.l.", None, None, datetime.datetime(2924, 3, 2), 900],
    ],
)

sheet(
    "AMS 1L",
    ["AMS Year", "ANNUAL FEE", "N_PROCESSES_BASELINE"],
    [["1st", 45000, 4], ["2nd", 60000, 5]],
)

sheet(
    "AMS 2L",
    ["TICKET", "COMPANY", "CLOSED", "COST_PER_TICKET"],
    [
        ["I240101_000001", "Menarini", datetime.datetime(2024, 1, 2), 500],
        ["I240104_000004", "Codifi", datetime.datetime(2024, 1, 4), 500],
    ],
)

sheet(
    "AMS RFC",
    ["PID", "Processo - da cancellare", "DESC", "DATE", "Status", "MD", "ROOT CAUSE", "NOTE", "COST", "TICKET REF"],
    [[None, "Test Alpha", "sample change", 44927, "Rilasciata", 1, "note field misaligned", "note", 0, "I240101_000001"]],
)

sheet(
    "AMS SMS",
    ["TICKET", "DATE", "TYPE", "NOTE"],
    [["I240101_000001", datetime.datetime(2024, 1, 5), "patching", None]],
)

sheet(
    "_VARIABLES",
    ["NAME", "VALUE", "NOTE"],
    [["cost_per_hour_FTE", "26.60", "Fully loaded FTE hourly cost"]],
)

sheet(
    "AMS SLA",
    ["TICKET_TYPE", "PRIORITY", "Provider priority", "Reaction time", "Repair time", "SLA_DAYS"],
    [
        ["Incident", 3, "medium", "2 h", "8 h", 2],
        ["Service Request", 3, "medium", "16 h", "16 h", 3],
    ],
)

sheet(
    "LICENSES",
    ["Year", "VM", "COST_YEAR"],
    [
        [2024, "MCDLNXRPAP21", 6500],
        [2024, "MCDLNXRPAP22", 6500],
    ],
)

sheet("VMs", ["VM"], [["MCDLNXRPAP21"], ["MCDLNXRPAP22"]])

OUT.parent.mkdir(parents=True, exist_ok=True)
wb.save(OUT)
print("wrote", OUT, OUT.stat().st_size, "bytes")
