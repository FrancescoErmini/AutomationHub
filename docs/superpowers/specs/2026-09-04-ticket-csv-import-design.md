# Ticket CSV Import

> **Status:** Design — not yet implemented.

## Overview

The `core.ticket` table is maintained by hand (SQLAdmin, and the new Tickets
page). The source of record outside the app is a spreadsheet exported as
`data/Tickets.csv` — 770 rows today, 709 of which already exist in `core.ticket`
from an earlier one-off load. There is no supported way to re-sync that file.

This adds an **Import CSV** button to the Tickets page. It uploads the export,
validates every row independently, shows a preview report (what will be inserted,
updated, skipped — and why), and on confirmation upserts the valid rows keyed on
`ticket_id`. Existing tickets are **overwritten** with the CSV values.

The importer never fails the whole batch on a bad row. The only whole-file error
is a wrong/altered column header. Every other problem is reported per row and the
remaining rows still import.

## Decisions Made

- **Location:** button on the frontend Tickets page (next to "+ New ticket"),
  backed by a new `POST /api/v1/tickets/import` endpoint. Not SQLAdmin.
- **Preview then confirm:** the frontend uploads the file once with `commit=false`
  to get a report, then again with `commit=true` to apply. No server-side
  staging — the file is small.
- **Upsert keyed on `ticket_id`.** Found → update every mapped field; not found →
  insert.
- **CSV wins on conflict.** An existing ticket's fields are replaced with the CSV
  row's values, including nulling `requestor` / `note` / `root_cause_id` when the
  CSV cell is blank.
- **Fixed defaults, re-applied on every update:**
  - `priority_id` → the `priority` row with `value = '3'`
  - `support_level_id` → derived from `IS 1L` (`TRUE` → `1L`, `FALSE` → `2L`)
  - `ticket_color` → `NULL` ("transparent" / normal background)

  These overwrite whatever an existing row had.
- **Linked value missing → skip the row and report it.** Applies to process,
  company, AMS year, and root cause (when non-blank). The importer never creates
  reference rows.
- **Unparseable date → skip the row and report it.** (`START DATE` / `END DATE`
  that is not `dd/mm/yyyy`, e.g. `REDIRECTED`, `REJECTED`, `20-05-2026`.)
- **Duplicate `ticket_id` within the file → skip every row carrying that id**,
  reported as an error. The file has two such ids today
  (`I250625_000213`, `S240513_000110`), each with genuinely different data per
  occurrence, so "last wins" would silently drop a real record.
- **No auth gate** on the import endpoint — consistent with the current
  (temporary) state of the other ticket write endpoints. Same TODO comment.
- **No new automated tests** — the project removed its test suite; verification is
  the manual plan below.

## CSV format

Header (exact, order-independent), from `data/Tickets.csv`:

```
ID, AMS_YEAR, TICKET, TICKET_TYPE, PROCESS, Processo, REQUESTOR,
START DATE, END DATE, ROOT CAUSE, IS 1L, COMPANY, NOTE
```

If the uploaded file's header is missing any of the columns the importer reads
(everything except `ID`), the endpoint returns `422` with the missing-column
list and writes nothing.

## Column → model mapping

`core.ticket` (`backend/app/models/core.py`), unchanged. No migration.

| CSV column | Ticket field | Resolution |
|---|---|---|
| `TICKET` | `ticket_id` | `.strip()`; the upsert key |
| `TICKET_TYPE` | `ticket_type` | `.strip()` |
| `PROCESS`, then `Processo` | `process_id` | normalized lookup (see below) |
| `REQUESTOR` | `requestor` | `.strip()` or `NULL` |
| `START DATE` | `start_date` | `datetime.strptime(v, "%d/%m/%Y").date()`; blank → `NULL` |
| `END DATE` | `end_date` | same |
| `ROOT CAUSE` | `root_cause_id` | exact (case-insensitive, trimmed) lookup on `root_cause.name`; blank → `NULL` |
| `IS 1L` | `is_1l` | `TRUE`/`FALSE` (case-insensitive) → bool |
| `COMPANY` | `company_id` | case-insensitive lookup on `company.name` |
| `AMS_YEAR` | `ams_year_id` | lookup on `ams_year.code` (`1st` / `2nd` / `3rd` …) |
| `NOTE` | `note` | `.strip()` or `NULL` |
| `ID` | — | ignored (spreadsheet row counter, not the ticket key) |
| — | `priority_id` | default: `priority.value == '3'` |
| — | `support_level_id` | derived from `is_1l` |
| — | `ticket_color` | `NULL` |
| — | `created_at` | DB default on insert; untouched on update |

### Process name resolution

Build a lookup from `process.canonical_name`, key = the name lowercased, trimmed,
inner whitespace collapsed to single spaces, and a trailing ` prd` removed.
For each row: normalize `PROCESS` and look it up; if that misses, normalize
`Processo` and look it up. First hit wins. No match, or both cells blank → skip.

Note `RPA - RABOT` (39 rows) resolves to nothing on purpose — the DB has four
distinct RABOT processes and no bare one; those rows are reported as
"unknown process".

## Per-row validation

A row is **skipped** (not written, listed in the report with a reason) on the
first hard error below. Order does not matter — collect all that apply.

| Condition | Reported error |
|---|---|
| `TICKET` blank | `missing ticket id` |
| `ticket_id` occurs more than once in the file | `duplicate ticket id in file (N occurrences)` |
| `TICKET_TYPE` blank | `missing ticket type` |
| process cells blank | `missing process` |
| process given but unresolved | `unknown process: '<raw PROCESS or Processo>'` |
| `COMPANY` blank or unresolved | `unknown company: '<raw>'` / `missing company` |
| `AMS_YEAR` unresolved | `unknown AMS year: '<raw>'` |
| `ROOT CAUSE` non-blank and unresolved | `unknown root cause: '<raw>'` |
| `IS 1L` not `TRUE`/`FALSE` | `invalid IS 1L value: '<raw>'` |
| `START DATE` / `END DATE` non-blank and not `dd/mm/yyyy` | `invalid start date: '<raw>'` / `invalid end date: '<raw>'` |

Everything else imports.

## Upsert (commit=true)

1. Parse + validate the whole file (identical to preview).
2. For each **valid** row, inside its own `session.begin_nested()` savepoint:
   - `SELECT ticket WHERE ticket_id = :id`
   - found → assign every mapped field + the three defaults; `action = "updated"`
   - not found → construct `Ticket(...)`; `action = "inserted"`
   - any `SQLAlchemyError` → roll back that savepoint, mark the row
     `action = "skipped"` with `db error: <str>`, continue
3. One `session.commit()` at the end.

`Ams2LCost` rows referencing an updated ticket are unaffected (no delete, PK
stable).

## API

`POST /api/v1/tickets/import` — `multipart/form-data`

| part | type | |
|---|---|---|
| `file` | file | the CSV (`UploadFile`) |
| `commit` | bool form field | default `false` |

Response `200` — `TicketImportReport`:

```jsonc
{
  "committed": false,
  "total_rows": 770,
  "inserted": 0,      // count with action "inserted" (preview: what would insert)
  "updated": 0,       // "                 " "updated"
  "skipped": 53,
  "rows": [
    { "line": 421, "ticket_id": "I250625_000213", "action": "skipped",
      "errors": ["duplicate ticket id in file (2 occurrences)"] },
    { "line": 604, "ticket_id": "I260401_000110", "action": "skipped",
      "errors": ["unknown process: 'RPA - RABOT'", "invalid end date: 'REDIRECTED'"] }
    // ... only rows with action "skipped" are included; clean rows are counted, not listed
  ]
}
```

`line` is the 1-based file line (header = 1, first data row = 2).

Error responses use the existing `AppError` handler:
- `422` `data_validation_error` — header mismatch (body lists missing columns).
- `422` — not a readable CSV / empty file.

New files: `app/services/ticket_import.py`, `app/schemas/ticket_import.py`.
Edited: `app/api/v1/tickets.py` (route), `app/dependencies.py` (provider).

## Frontend

- **`api/tickets.ts`** — `importTicketsCsv(file: File, commit: boolean): Promise<TicketImportReport>`
  using `FormData` through `apiFetch` (no explicit `Content-Type`). Plus
  `TicketImportReport` / `TicketImportRowReport` types.
- **`components/ui/Modal.tsx`** (new — none exists) — minimal fixed-overlay
  dialog: backdrop, centered panel, `Esc` / backdrop-click to close, `role="dialog"`.
- **`components/tickets/ImportTicketsDialog.tsx`** (new):
  1. `.csv` file input.
  2. On pick → call `importTicketsCsv(file, false)`. Pending spinner.
  3. Preview view: summary line
     (`717 rows ready — 8 new, 709 updates · 53 skipped`) + a scrollable table
     of the skipped rows (`line`, `ticket_id`, joined `errors`).
  4. Actions: **Download report** (CSV built client-side from `rows`),
     **Cancel**, **Apply import** (disabled when `inserted + updated === 0`).
  5. On Apply → `importTicketsCsv(file, true)` → replace body with the final
     report (`709 updated, 8 inserted, 53 skipped`) and a **Close** button;
     `queryClient.invalidateQueries({ queryKey: ['tickets'] })`.
  6. A `422`/network error renders inline as `role="alert"` (same pattern as
     `NewTicketForm`); the dialog stays open.
- **`pages/TicketsPage.tsx`** — "Import CSV" button beside "+ New ticket";
  local `importing` boolean toggles the dialog.

## Manual test plan

1. **Preview** `data/Tickets.csv`: report shows ~717 ready (~8 insert, ~709
   update), ~53 skipped. Spot-check reasons: 39 × `unknown process: 'RPA - RABOT'`,
   2 × `unknown process: 'RPA - Editing Codes - Mazinga'`, ~6 blank/typo process,
   7 × `missing ticket id`, 4 rows across the 2 duplicated ids, ~5 invalid dates.
2. **Apply**: Tickets page refreshes; open a previously-missing ticket and a
   previously-existing one and confirm values match the CSV.
3. **Idempotent re-run**: preview again → 0 insert, ~709 update, same skips.
4. **CSV wins**: edit one ticket's `note` and `priority` in SQLAdmin, re-import,
   confirm the note reverts to the CSV text and priority is back to `3`.
5. **Bad header**: upload a CSV with `TICKET` renamed → dialog shows the
   missing-column error, DB unchanged.
6. **Download report**: CSV opens with one line per skipped row.

## Out of scope

- Configurable column mapping (this is for this specific export shape).
- Creating `process` / `company` / `root_cause` / `ams_year` reference rows.
- Deleting tickets absent from the CSV (import is upsert-only).
- Auth/RBAC on the endpoint (tracked by the shared TODO on ticket writes).
- Importing `priority`, `support_level`, or `ticket_color` from the file.
