# Remove Excel/CSV Ingestion Subsystem

## Overview

Automation Hub started life as an Excel-ingestion tool: an Excel/CSV pipeline
loaded raw workbooks into `staging` tables, validated and reconciled them, then
wrote the results into `core` tables. That one-time bootstrap has already run —
production data now lives in `core`, data changes go through manual edits
(sqladmin) or the ideas flow, and nobody re-runs the pipeline. The ingestion
code, its staging/audit tables, its admin API, and its CLI are dead weight:
~20 files and 20 DB tables that exist only to explain how `core` got seeded,
not to serve any live feature.

This is a decommission: delete the ingestion subsystem, drop the tables it
owned, and replace the one place other tests still depend on it (fixture
seeding) with a static snapshot. `core` tables and every feature built on
top of them (executive, operations, roi, process_catalog, service_performance,
simple_ops, apqc, ideas) are untouched.

A separate, unrelated finding surfaced during investigation: a generic `Item`
entity (name/description CRUD, its own CSV importer, its own `/items` API)
is leftover starter-template scaffolding, not used by any real feature. It's
included in this cleanup at the user's direction.

## Decisions Made

- Ingestion pipeline: confirmed one-time bootstrap, no longer used. Safe to
  remove entirely (pipeline code, staging tables, audit tables).
- `Item` entity: confirmed leftover scaffolding, unrelated to the Excel/RPA
  domain. Removed entirely (model, API, service, repository, CLI seed/ingest
  commands, CSV fixture).
- Test fixture seeding: six-plus integration test suites don't test ingestion
  — they call `run_rpa_ingestion(...)` / `load_apqc_taxonomy_from_workbook(...)`
  purely to seed `core` tables for their own assertions. **Approach A** was
  chosen: run the pipeline one last time to produce a static fixture snapshot,
  then delete the pipeline. (Rejected: Approach B, hand-written ORM factories
  per test — cleaner long-term but real new work across 7 files, out of scope
  for a cleanup task. Approach C, keeping a minimal seeding script alive —
  rejected because it keeps the exact code this task exists to remove.)
- Raw source data (`data/raw/*.xlsx`, `.csv`, `.pbit`, the stray Excel lock
  file, and `data/fixtures/rpa_sample.xlsx`): confirmed for deletion — they
  are inputs to the deleted pipeline and nothing else reads them.

## Scope

### Delete entirely

**Ingestion package** — `backend/app/ingestion/` (all of it: `__init__.py`,
`ams_rfc_csv_loader.py`, `apqc_loader.py`, `items.py`, `normalization.py`,
`reporting.py`, `rpa_core_loader.py`, `rpa_excel_reader.py`, `rpa_pipeline.py`,
`rpa_relationship_validation.py`, `rpa_staging_loader.py`, and any shared
`csv_reader.py` / `validation.py` helpers once nothing else imports them).

**Admin ingestion-ops feature** — `backend/app/api/v1/admin.py`,
`backend/app/services/admin.py`, `backend/app/repositories/admin.py`,
`backend/app/schemas/admin.py`. Confirmed 100% ingestion/audit/reconciliation
— nothing else lives in this feature. Remove its router registration.

**`Item` entity** — `backend/app/models/item.py`, its routes in
`backend/app/api/v1/router.py` (`list_items`, `create_item`),
`backend/app/services/items.py`, `backend/app/repositories/items.py`,
`backend/app/schemas/item.py`, `data/fixtures/items.csv`.

**CLI** — `backend/app/cli.py` in full. Every subcommand (`seed`, `ingest`,
`ingest-rpa`, `ingest-apqc`) depends on ingestion or `Item`; once both are
gone the file has no remaining purpose. Remove its entry-point registration
in `pyproject.toml` if one exists.

**Tests** — `test_ams_rfc_csv_loader.py`, `test_apqc_ingestion.py`,
`test_excel_reconciliation.py`, `test_rpa_core_loader.py`,
`test_rpa_pipeline.py`, `test_rpa_relationship_validation.py`,
`test_rpa_staging_ingestion.py`, `test_rpa_excel_reader.py` (unit),
`test_normalization.py` (unit), `test_validation.py` (unit),
`tests/oracle/excel_oracle.py`, and any `Item`-specific test file(s).

**Dependencies** — `openpyxl` and `types-openpyxl` from `backend/pyproject.toml`
(nothing imports them once `app/ingestion/` is gone — verified no other
caller).

**Raw data** — `data/raw/RPA - o365.xlsx`, `data/raw/K07122_Life_Sciences_v722_vsLife_Sciences_v721_2025.xlsx`,
`data/raw/RPA Processes Docs Links.csv`, `data/raw/RPA_AMS_RFC_Amendment.csv`,
`data/raw/rpadashbord.pbit`, `data/raw/~$RPA - o365.xlsx` (stray Excel lock
file), `data/fixtures/rpa_sample.xlsx`, `scripts/build_rpa_fixture.py`.

### Update (not delete)

- `backend/app/models/__init__.py` — drop the `audit`, `staging`, and `Item`
  imports and their `__all__` entries; keep every `core` import unchanged.
- `backend/app/models/audit.py`, `backend/app/models/staging.py` — delete
  the files themselves once their imports are gone from `__init__.py`.
- `backend/app/dependencies.py` — remove `AdminRepository`/`AdminService`/
  `ItemRepository`/`ItemService` wiring (`get_admin_repository`,
  `get_admin_service`, `AdminServiceDependency`, `get_item_service`,
  `ItemServiceDependency`, `get_rpa_workbook_path`, `RpaWorkbookPathDependency`).
- `backend/tests/integration/conftest.py` — remove the `clean_items` fixture
  (Item is gone); narrow `RPA_SCHEMAS = ("staging", "core", "audit")` to just
  `("core",)`, and keep truncating `core` between tests for isolation, now
  reseeded from the static fixture instead of re-running ingestion.
- `docs/architecture.md` — check for and remove any description of the
  ingestion pipeline as part of the live request path.

### Explicitly out of scope (stays as-is)

- Every `core` table and model (`Process`, `Ticket`, `Application`, `Company`,
  `ProcessEconomics`, `Ams1LCost`, `Ams2LCost`, `LicenseCost`, `VmCost`,
  `AmsRfcCost`, `ProcessSchedule`, `ApqcCategory`, `ApqcProcessGroup`,
  `ApqcProcess`, `Idea`, `ValueNormalization`, `ReferenceVariable`, etc.) and
  every API/service built on them (`executive`, `operations`, `roi`,
  `process_catalog`, `service_performance`, `simple_ops`, `apqc`, `ideas`,
  `metadata`).
- `docs/rpa_final_validation_report.md` and
  `docs/dashboard_costi_running_rpa_data_assessment.md` — historical
  markdown reports, not code. Left in place as a record of the original
  validation; not worth the churn of rewriting or relocating for this
  cleanup.
- All pre-existing Alembic migration files (`20260804_0002` through
  `20260824_0015`) — never edit or rewrite migration history. The removal
  is expressed as one new migration on top (see below).

## Database Changes

One new Alembic migration:

1. Drop every table in the `staging` schema (14 `Staging*` tables) and the
   `audit` schema (`ingestion_batch`, `data_quality_issue`,
   `relationship_reconciliation`), then drop the now-empty `staging` and
   `audit` schemas themselves.
2. Drop the `items` table (created by `core` migration `20241229_0001`).
3. `core` schema and every table in it are untouched — the migration's
   `DROP` statements are scoped explicitly to `staging.*`, `audit.*`, and
   `public.items` (or wherever `items` lives), never to `core.*`.

Per `AGENTS.md`: run via `make migration NAME="..."`, inspect the generated
file before applying, then `make migrate`. Because `DROP TABLE` is
destructive and irreversible without a backup, take a DB snapshot/backup
before running this migration against any environment holding real data
(the local dev Postgres already has real ingested data per prior session
work) — this is a manual step for whoever runs it, not something the
migration itself can undo.

## Test Fixture Replacement (Approach A)

Order matters here because the source data for the snapshot is itself being
deleted:

1. **Before** deleting anything: run the current ingestion pipeline one more
   time against `data/fixtures/rpa_sample.xlsx` (via `run_rpa_ingestion`) and
   `load_apqc_taxonomy_from_workbook` against the APQC source workbook, in a
   throwaway script or REPL session against the test DB.
2. Dump the resulting `core` rows relevant to those tests (the tables
   `test_executive_service`, `test_operations_service`,
   `test_process_catalog_api`, `test_roi_service`,
   `test_service_performance_service`, `test_simple_ops_service`, and
   `test_ideas_api` actually assert against) to a static fixture — plain
   Python data structures or a JSON file checked into
   `backend/tests/fixtures/`.
3. Write a small loader helper (e.g. `backend/tests/fixtures/core_fixture.py`
   with a `load_core_fixture(session)` / `load_apqc_fixture(session)`
   function) that does plain SQLAlchemy inserts from that static data — no
   parsing, no validation, no `openpyxl`.
4. In each of the 7 affected test files, replace the
   `run_rpa_ingestion(db_session, FIXTURE)` / `load_apqc_taxonomy_from_workbook(...)`
   call with the new loader call. Assertions in those tests do not change —
   they're checking the same data, just seeded differently.
5. Only after the snapshot is captured and the 7 tests pass against it do
   the deletions in "Scope" above happen (ingestion package, raw data files,
   `rpa_sample.xlsx`, `build_rpa_fixture.py`).

## Verification

- `make migrate` applies cleanly against a copy of the dev DB; `\dt staging.*`
  and `\dt audit.*` return no rows afterward; `core.*` tables and row counts
  are unchanged.
- Full backend test suite (`pytest`) passes, including the 7 rewired tests,
  with no references to `app.ingestion`, `app.models.staging`,
  `app.models.audit`, `app.models.item`, or `app.cli` remaining.
- `grep -rli "ingest" backend/app` (excluding the word appearing in unrelated
  business text, e.g. `schemas/idea.py`'s `primary_input_format` enum value
  `"Structured Digital (Excel/DB/API)"`, which is domain vocabulary for the
  ideas wizard, not the ingestion subsystem, and stays) returns nothing.
- `ruff`/`mypy` pass with `openpyxl` removed from dependencies.
- Frontend and existing dashboards (Simple Ops, executive, etc.) still load
  real data in the browser — confirms `core` tables were untouched.
