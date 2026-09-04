# Ticket CSV Import Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add an "Import CSV" button to the Tickets page that upserts `data/Tickets.csv` into `core.ticket`, previewing and reporting every row that cannot be imported instead of failing the batch.

**Architecture:** A new `POST /api/v1/tickets/import` multipart endpoint delegates to a stateless `TicketImportService` that parses the CSV, resolves foreign keys against reference tables, validates each row independently, and (when `commit=true`) upserts valid rows keyed on `ticket_id` — each row in its own savepoint. The frontend uploads the file once for a preview report, then again to apply, showing skipped rows in a modal with a downloadable CSV report.

**Tech Stack:** FastAPI + SQLAlchemy 2.0 (backend, Python 3.12), `python-multipart` (already installed), React 18 + TypeScript + `@tanstack/react-query` + Tailwind (frontend).

**Spec:** `docs/superpowers/specs/2026-09-04-ticket-csv-import-design.md`

## Global Constraints

- **No automated test framework.** The project removed its test suite (`memory/no-automated-tests.md`); do **not** add pytest, vitest, or CI. Verification in this plan is: `ruff` + `mypy` for backend, `npm run typecheck` + `npm run lint` for frontend, plus live checks against the running Docker stack (`localhost:8000` backend, `localhost:5173` frontend, `localhost:5432` Postgres) and the real `data/Tickets.csv`.
- **Backend line length: 100.** Ruff selects `E,F,I,B,UP,SIM,RUF`; mypy runs `strict`. Use `Annotated[...]` for FastAPI `File()`/`Form()` params (they are not in `extend-immutable-calls`, so a bare default trips `B008`).
- **Frontend lint is zero-warning:** `eslint . --max-warnings 0 && prettier --check .`. Run `npm run format` before committing frontend changes.
- **No model or migration changes.** `core.ticket` is used as-is.
- **No auth guard** on the new endpoint — match the existing TODO on `update_ticket` in `backend/app/api/v1/tickets.py`.
- **Reference data is fixed** in the DB: `priority` has one row (`value='3'`), `support_level` is `1L`/`2L`, `ams_year.code` is `1st`/`2nd`/`3rd`/…, `company.name` is `Menarini`/`Codifi`. The importer never creates reference rows.
- Docker runs the backend with `--reload` and a bind mount, so backend edits hot-reload; no rebuild needed.

---

## File Structure

**Backend (new):**
- `backend/app/schemas/ticket_import.py` — Pydantic response models (`TicketImportRowReport`, `TicketImportReport`).
- `backend/app/services/ticket_import.py` — `TicketImportService`: parse, validate, resolve FKs, upsert. All import logic lives here.

**Backend (modified):**
- `backend/app/api/v1/tickets.py` — add the `POST /import` route.
- `backend/app/dependencies.py` — add `TicketImportServiceDependency`.

**Frontend (new):**
- `frontend/src/components/ui/Modal.tsx` — minimal fixed-overlay dialog primitive.
- `frontend/src/components/tickets/ImportTicketsDialog.tsx` — the import flow (pick → preview → apply → report).

**Frontend (modified):**
- `frontend/src/components/ui/index.ts` — export `Modal`.
- `frontend/src/api/tickets.ts` — add `importTicketsCsv` + report types.
- `frontend/src/pages/TicketsPage.tsx` — add the "Import CSV" button + dialog toggle.

---

## Task 1: Backend import service + schemas

**Files:**
- Create: `backend/app/schemas/ticket_import.py`
- Create: `backend/app/services/ticket_import.py`

**Interfaces:**
- Consumes: `app.models.core` (`Ticket`, `Process`, `RootCause`, `Company`, `AmsYear`, `Priority`, `SupportLevel`), `app.core.exceptions.AppError` / `DataValidationError`.
- Produces:
  - `TicketImportRowReport(BaseModel)` — `line: int`, `ticket_id: str | None`, `action: str`, `errors: list[str]`
  - `TicketImportReport(BaseModel)` — `committed: bool`, `total_rows: int`, `inserted: int`, `updated: int`, `skipped: int`, `rows: list[TicketImportRowReport]`
  - `TicketImportService(session: Session)` with `run(self, *, content: bytes, commit: bool) -> TicketImportReport`

- [ ] **Step 1: Write `backend/app/schemas/ticket_import.py`**

```python
from pydantic import BaseModel


class TicketImportRowReport(BaseModel):
    line: int
    ticket_id: str | None
    action: str  # "inserted" | "updated" | "skipped"
    errors: list[str]


class TicketImportReport(BaseModel):
    committed: bool
    total_rows: int
    inserted: int
    updated: int
    skipped: int
    rows: list[TicketImportRowReport]  # only skipped rows are listed
```

- [ ] **Step 2: Write `backend/app/services/ticket_import.py`**

```python
import csv
import io
from collections import Counter
from datetime import date, datetime
from typing import Any

from sqlalchemy import select
from sqlalchemy.exc import SQLAlchemyError
from sqlalchemy.orm import Session

from app.core.exceptions import AppError, DataValidationError
from app.models.core import (
    AmsYear,
    Company,
    Priority,
    Process,
    RootCause,
    SupportLevel,
    Ticket,
)
from app.schemas.ticket_import import TicketImportReport, TicketImportRowReport

# Columns the importer reads; "ID" is deliberately ignored.
_REQUIRED_COLUMNS: frozenset[str] = frozenset(
    {
        "AMS_YEAR",
        "TICKET",
        "TICKET_TYPE",
        "PROCESS",
        "Processo",
        "REQUESTOR",
        "START DATE",
        "END DATE",
        "ROOT CAUSE",
        "IS 1L",
        "COMPANY",
        "NOTE",
    }
)

# Fields written to a ticket for a valid row (excludes created_at).
_TICKET_FIELDS: tuple[str, ...] = (
    "ticket_id",
    "ticket_type",
    "process_id",
    "requestor",
    "start_date",
    "end_date",
    "root_cause_id",
    "is_1l",
    "company_id",
    "ams_year_id",
    "note",
    "priority_id",
    "support_level_id",
    "ticket_color",
)


def _normalize_process(value: str) -> str:
    """Lower, trim, collapse inner whitespace, drop a trailing ' prd'."""
    key = " ".join(value.lower().split())
    if key.endswith(" prd"):
        key = key[:-4].rstrip()
    return key


def _parse_date(raw: str) -> tuple[date | None, bool]:
    """(value, ok). Blank -> (None, True). Unparseable -> (None, False)."""
    text = raw.strip()
    if not text:
        return None, True
    try:
        return datetime.strptime(text, "%d/%m/%Y").date(), True
    except ValueError:
        return None, False


class TicketImportService:
    def __init__(self, session: Session) -> None:
        self._session = session

    def run(self, *, content: bytes, commit: bool) -> TicketImportReport:
        rows = self._read_rows(content)
        refs = self._load_refs()

        skipped: list[TicketImportRowReport] = []
        valid: list[tuple[int, str, dict[str, Any]]] = []  # (line, ticket_id, fields)

        id_counts = Counter(r.get("TICKET", "").strip() for r in rows if r.get("TICKET", "").strip())

        for offset, raw in enumerate(rows):
            line = offset + 2  # header is line 1
            errors, fields = self._process_row(raw, refs, id_counts)
            if errors:
                skipped.append(
                    TicketImportRowReport(
                        line=line,
                        ticket_id=raw.get("TICKET", "").strip() or None,
                        action="skipped",
                        errors=errors,
                    )
                )
            else:
                valid.append((line, fields["ticket_id"], fields))

        if commit:
            inserted, updated, db_skips = self._apply(valid)
            skipped.extend(db_skips)
        else:
            inserted, updated = self._preview_counts(valid)

        skipped.sort(key=lambda r: r.line)
        return TicketImportReport(
            committed=commit,
            total_rows=len(rows),
            inserted=inserted,
            updated=updated,
            skipped=len(skipped),
            rows=skipped,
        )

    # -- parsing ------------------------------------------------------------

    def _read_rows(self, content: bytes) -> list[dict[str, str]]:
        try:
            text = content.decode("utf-8-sig")
        except UnicodeDecodeError:
            raise DataValidationError("uploaded file is not valid UTF-8 text") from None

        reader = csv.DictReader(io.StringIO(text))
        if not reader.fieldnames:
            raise DataValidationError("uploaded file is empty or not a CSV")

        missing = _REQUIRED_COLUMNS - set(reader.fieldnames)
        if missing:
            raise DataValidationError(f"missing columns: {', '.join(sorted(missing))}")

        return [{k: (v or "") for k, v in row.items()} for row in reader]

    def _load_refs(self) -> dict[str, Any]:
        session = self._session
        processes: dict[str, int] = {
            _normalize_process(name): pid
            for pid, name in session.execute(
                select(Process.id, Process.canonical_name)
            ).all()
        }
        root_causes = {
            name.strip().lower(): rid
            for rid, name in session.execute(select(RootCause.id, RootCause.name)).all()
        }
        companies = {
            name.strip().lower(): cid
            for cid, name in session.execute(select(Company.id, Company.name)).all()
        }
        ams_years = {
            code.strip().lower(): aid
            for aid, code in session.execute(select(AmsYear.id, AmsYear.code)).all()
        }
        support_levels = {
            code.strip().lower(): sid
            for sid, code in session.execute(
                select(SupportLevel.id, SupportLevel.code)
            ).all()
        }
        priority_id = session.scalar(select(Priority.id).where(Priority.value == "3"))

        if priority_id is None:
            raise AppError("reference data missing: priority with value '3'")
        if "1l" not in support_levels or "2l" not in support_levels:
            raise AppError("reference data missing: support_level '1L' / '2L'")

        return {
            "processes": processes,
            "root_causes": root_causes,
            "companies": companies,
            "ams_years": ams_years,
            "support_levels": support_levels,
            "priority_id": priority_id,
        }

    # -- per-row validation ------------------------------------------------

    def _process_row(
        self,
        raw: dict[str, str],
        refs: dict[str, Any],
        id_counts: Counter[str],
    ) -> tuple[list[str], dict[str, Any]]:
        errors: list[str] = []

        ticket_id = raw["TICKET"].strip()
        if not ticket_id:
            errors.append("missing ticket id")
        elif id_counts[ticket_id] > 1:
            errors.append(f"duplicate ticket id in file ({id_counts[ticket_id]} occurrences)")

        ticket_type = raw["TICKET_TYPE"].strip()
        if not ticket_type:
            errors.append("missing ticket type")

        process_id: int | None = None
        p_raw, po_raw = raw["PROCESS"].strip(), raw["Processo"].strip()
        if not p_raw and not po_raw:
            errors.append("missing process")
        else:
            process_id = refs["processes"].get(_normalize_process(p_raw)) or refs[
                "processes"
            ].get(_normalize_process(po_raw))
            if process_id is None:
                errors.append(f"unknown process: {(p_raw or po_raw)!r}")

        company_id: int | None = None
        c_raw = raw["COMPANY"].strip()
        if not c_raw:
            errors.append("missing company")
        else:
            company_id = refs["companies"].get(c_raw.lower())
            if company_id is None:
                errors.append(f"unknown company: {c_raw!r}")

        ams_year_id: int | None = None
        y_raw = raw["AMS_YEAR"].strip()
        if not y_raw:
            errors.append("missing AMS year")
        else:
            ams_year_id = refs["ams_years"].get(y_raw.lower())
            if ams_year_id is None:
                errors.append(f"unknown AMS year: {y_raw!r}")

        root_cause_id: int | None = None
        rc_raw = raw["ROOT CAUSE"].strip()
        if rc_raw:
            root_cause_id = refs["root_causes"].get(rc_raw.lower())
            if root_cause_id is None:
                errors.append(f"unknown root cause: {rc_raw!r}")

        is_1l: bool | None = None
        l_raw = raw["IS 1L"].strip()
        if l_raw.upper() == "TRUE":
            is_1l = True
        elif l_raw.upper() == "FALSE":
            is_1l = False
        else:
            errors.append(f"invalid IS 1L value: {l_raw!r}")

        start_date, start_ok = _parse_date(raw["START DATE"])
        if not start_ok:
            errors.append(f"invalid start date: {raw['START DATE'].strip()!r}")
        end_date, end_ok = _parse_date(raw["END DATE"])
        if not end_ok:
            errors.append(f"invalid end date: {raw['END DATE'].strip()!r}")

        if errors:
            return errors, {}

        assert is_1l is not None
        fields: dict[str, Any] = {
            "ticket_id": ticket_id,
            "ticket_type": ticket_type,
            "process_id": process_id,
            "requestor": raw["REQUESTOR"].strip() or None,
            "start_date": start_date,
            "end_date": end_date,
            "root_cause_id": root_cause_id,
            "is_1l": is_1l,
            "company_id": company_id,
            "ams_year_id": ams_year_id,
            "note": raw["NOTE"].strip() or None,
            "priority_id": refs["priority_id"],
            "support_level_id": refs["support_levels"]["1l" if is_1l else "2l"],
            "ticket_color": None,
        }
        return [], fields

    # -- apply / preview -------------------------------------------------

    def _preview_counts(self, valid: list[tuple[int, str, dict[str, Any]]]) -> tuple[int, int]:
        if not valid:
            return 0, 0
        ids = [tid for _, tid, _ in valid]
        existing = set(
            self._session.scalars(
                select(Ticket.ticket_id).where(Ticket.ticket_id.in_(ids))
            ).all()
        )
        updated = sum(1 for _, tid, _ in valid if tid in existing)
        return len(valid) - updated, updated

    def _apply(
        self, valid: list[tuple[int, str, dict[str, Any]]]
    ) -> tuple[int, int, list[TicketImportRowReport]]:
        inserted = updated = 0
        db_skips: list[TicketImportRowReport] = []

        for line, ticket_id, fields in valid:
            try:
                with self._session.begin_nested():
                    ticket = self._session.scalar(
                        select(Ticket).where(Ticket.ticket_id == ticket_id)
                    )
                    if ticket is None:
                        self._session.add(Ticket(**fields))
                        inserted += 1
                    else:
                        for name in _TICKET_FIELDS:
                            setattr(ticket, name, fields[name])
                        updated += 1
            except SQLAlchemyError as exc:
                db_skips.append(
                    TicketImportRowReport(
                        line=line,
                        ticket_id=ticket_id,
                        action="skipped",
                        errors=[f"db error: {type(exc).__name__}"],
                    )
                )

        self._session.commit()
        return inserted, updated, db_skips
```

- [ ] **Step 3: Lint and type-check**

Run from repo root:
```bash
.venv/bin/ruff check backend/app/services/ticket_import.py backend/app/schemas/ticket_import.py
.venv/bin/ruff format --check backend/app/services/ticket_import.py backend/app/schemas/ticket_import.py
.venv/bin/mypy backend/app/services/ticket_import.py backend/app/schemas/ticket_import.py
```
Expected: all clean. If `ruff format --check` reports a diff, run `.venv/bin/ruff format <files>` and re-check.

- [ ] **Step 4: Verify against the real CSV (preview, no writes)**

Run from repo root (connects to the Docker Postgres on `localhost:5432`):
```bash
.venv/bin/python - <<'EOF'
from sqlalchemy import create_engine
from sqlalchemy.orm import Session
from app.services.ticket_import import TicketImportService

engine = create_engine(
    "postgresql+psycopg://automation_hub:automation_hub_dev@localhost:5432/automation_hub"
)
with Session(engine) as s:
    report = TicketImportService(s).run(
        content=open("data/Tickets.csv", "rb").read(), commit=False
    )
print("total:", report.total_rows, "insert:", report.inserted,
      "update:", report.updated, "skip:", report.skipped, "committed:", report.committed)
from collections import Counter
reasons = Counter(e.split(":")[0] for r in report.rows for e in r.errors)
print("reason buckets:", dict(reasons))
for r in report.rows[:12]:
    print(r.line, r.ticket_id, r.errors)
EOF
```
Expected: `total: 770`, `committed: False`, `skip:` ~53, `insert + update` ≈ 717. `reason buckets` includes `unknown process` (~47), `missing ticket id` (7), `duplicate ticket id in file` (4), `invalid end date` (~4). Ticket table row count is unchanged (no commit).

- [ ] **Step 5: Verify a bad header is rejected**

```bash
.venv/bin/python - <<'EOF'
from sqlalchemy import create_engine
from sqlalchemy.orm import Session
from app.core.exceptions import DataValidationError
from app.services.ticket_import import TicketImportService

engine = create_engine(
    "postgresql+psycopg://automation_hub:automation_hub_dev@localhost:5432/automation_hub"
)
bad = b"ID,AMS_YEAR,TICKET_TYPE\n1,1st,Incident\n"
with Session(engine) as s:
    try:
        TicketImportService(s).run(content=bad, commit=False)
        print("FAIL: no error raised")
    except DataValidationError as exc:
        print("OK:", exc)
EOF
```
Expected: `OK: missing columns: COMPANY, IS 1L, NOTE, ...` (the full list, `TICKET_TYPE` not among them).

- [ ] **Step 6: Commit**

```bash
git add backend/app/services/ticket_import.py backend/app/schemas/ticket_import.py
git commit -m "feat(tickets): CSV import service — parse, validate, upsert"
```

---

## Task 2: Import endpoint + dependency wiring

**Files:**
- Modify: `backend/app/dependencies.py`
- Modify: `backend/app/api/v1/tickets.py`

**Interfaces:**
- Consumes: `TicketImportService.run` (Task 1), `TicketImportReport` (Task 1), `DbSession` (existing in `dependencies.py`).
- Produces: `POST /api/v1/tickets/import` — multipart form (`file`: the CSV, `commit`: bool, default `false`) → `TicketImportReport` JSON.

- [ ] **Step 1: Add the provider in `backend/app/dependencies.py`**

Add to the imports block (alphabetical, next to `from app.services.tickets import TicketService`):
```python
from app.services.ticket_import import TicketImportService
```

Add after the existing `get_ticket_service` / `TicketServiceDependency` lines:
```python
def get_ticket_import_service(session: DbSession) -> TicketImportService:
    return TicketImportService(session)


TicketImportServiceDependency = Annotated[
    TicketImportService, Depends(get_ticket_import_service)
]
```

- [ ] **Step 2: Add the route in `backend/app/api/v1/tickets.py`**

Update the imports at the top:
```python
from typing import Annotated, Literal

from fastapi import APIRouter, File, Form, Query, UploadFile, status

from app.dependencies import TicketImportServiceDependency, TicketServiceDependency
from app.schemas.ticket import TicketCreate, TicketOptions, TicketRead, TicketUpdate
from app.schemas.ticket_import import TicketImportReport
```

Add this route immediately after `ticket_options` (so `/import` is registered before the `/{ticket_pk}` routes — FastAPI matches in definition order and `import` is a literal path, but keeping it above the path-param routes avoids any ambiguity):
```python
# TODO: temporary — restore a RequireEditor dependency on this write endpoint,
# consistent with update_ticket / create_ticket below.
@router.post("/import", response_model=TicketImportReport)
async def import_tickets(
    service: TicketImportServiceDependency,
    file: Annotated[UploadFile, File()],
    commit: Annotated[bool, Form()] = False,
) -> TicketImportReport:
    content = await file.read()
    return service.run(content=content, commit=commit)
```

- [ ] **Step 3: Lint and type-check**

```bash
.venv/bin/ruff check backend/app/api/v1/tickets.py backend/app/dependencies.py
.venv/bin/ruff format --check backend/app/api/v1/tickets.py backend/app/dependencies.py
.venv/bin/mypy backend/app/api/v1/tickets.py backend/app/dependencies.py
```
Expected: clean.

- [ ] **Step 4: Verify the endpoint (preview) against the running backend**

The Docker backend hot-reloads. Run from repo root:
```bash
curl -s -F 'file=@data/Tickets.csv' -F 'commit=false' \
  http://localhost:8000/api/v1/tickets/import \
  | python3 -c 'import json,sys; d=json.load(sys.stdin); print({k:d[k] for k in ("committed","total_rows","inserted","updated","skipped")}); print("first skips:", d["rows"][:3])'
```
Expected: `committed=False`, `total_rows=770`, `skipped` ≈ 53, `inserted+updated` ≈ 717.

- [ ] **Step 5: Verify commit + idempotency + DB effect**

Record the current count, apply, check it grew by `inserted`, then re-run and confirm `inserted=0`:
```bash
docker exec automation-hub-postgres-1 psql -U automation_hub -d automation_hub -tAc "select count(*) from core.ticket;"
curl -s -F 'file=@data/Tickets.csv' -F 'commit=true' http://localhost:8000/api/v1/tickets/import \
  | python3 -c 'import json,sys; d=json.load(sys.stdin); print({k:d[k] for k in ("committed","inserted","updated","skipped")})'
docker exec automation-hub-postgres-1 psql -U automation_hub -d automation_hub -tAc "select count(*) from core.ticket;"
# re-run: should now be all updates
curl -s -F 'file=@data/Tickets.csv' -F 'commit=true' http://localhost:8000/api/v1/tickets/import \
  | python3 -c 'import json,sys; d=json.load(sys.stdin); print("2nd run:", {k:d[k] for k in ("inserted","updated","skipped")})'
```
Expected: first run `committed=True`, `inserted` ≈ 8, `updated` ≈ 709; row count rises by `inserted`. Second run `inserted=0`, `updated` unchanged, same `skipped`.

- [ ] **Step 6: Verify "CSV wins" on a conflicting field**

```bash
docker exec automation-hub-postgres-1 psql -U automation_hub -d automation_hub -c \
  "update core.ticket set note='LOCAL EDIT', priority_id=null where ticket_id='I240402_000072';"
curl -s -F 'file=@data/Tickets.csv' -F 'commit=true' http://localhost:8000/api/v1/tickets/import > /dev/null
docker exec automation-hub-postgres-1 psql -U automation_hub -d automation_hub -c \
  "select note, priority_id from core.ticket where ticket_id='I240402_000072';"
```
Expected: `note` reverts to the CSV text (`User changed password without telling us`), `priority_id` is back to `3`.

- [ ] **Step 7: Verify bad header over HTTP**

```bash
printf 'ID,TICKET,TICKET_TYPE\n1,X,Incident\n' > /tmp/bad.csv
curl -s -o /dev/null -w '%{http_code}\n' -F 'file=@/tmp/bad.csv' -F 'commit=true' \
  http://localhost:8000/api/v1/tickets/import
curl -s -F 'file=@/tmp/bad.csv' -F 'commit=true' http://localhost:8000/api/v1/tickets/import
```
Expected: HTTP `422`, body `{"error":{"code":"data_validation_error","message":"missing columns: ..."}}`. Ticket count unchanged.

- [ ] **Step 8: Commit**

```bash
git add backend/app/api/v1/tickets.py backend/app/dependencies.py
git commit -m "feat(tickets): POST /api/v1/tickets/import endpoint"
```

---

## Task 3: Frontend API client + Modal primitive

**Files:**
- Create: `frontend/src/components/ui/Modal.tsx`
- Modify: `frontend/src/components/ui/index.ts`
- Modify: `frontend/src/api/tickets.ts`

**Interfaces:**
- Consumes: `apiFetch`, `parseResponse` from `frontend/src/api/client.ts`.
- Produces:
  - `Modal({ onClose, labelledBy?, children })` — fixed overlay; `Esc` and backdrop click call `onClose`.
  - `TicketImportRowReport` — `{ line: number; ticket_id: string | null; action: 'inserted' | 'updated' | 'skipped'; errors: string[] }`
  - `TicketImportReport` — `{ committed: boolean; total_rows: number; inserted: number; updated: number; skipped: number; rows: TicketImportRowReport[] }`
  - `importTicketsCsv(file: File, commit: boolean): Promise<TicketImportReport>`

- [ ] **Step 1: Create `frontend/src/components/ui/Modal.tsx`**

```tsx
import { useEffect, type ReactNode } from 'react'

export function Modal({
  onClose,
  labelledBy,
  children,
}: {
  onClose: () => void
  labelledBy?: string
  children: ReactNode
}) {
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-slate-900/40 p-4 sm:p-8"
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={labelledBy}
        className="w-full max-w-3xl rounded-xl border border-slate-200 bg-white shadow-card"
        onClick={(event) => event.stopPropagation()}
      >
        {children}
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Export it from `frontend/src/components/ui/index.ts`**

Add a line matching the file's existing export style (check whether it uses `export * from` or `export { X } from` and follow it). For a `export { ... } from` file, add:
```ts
export { Modal } from './Modal'
```

- [ ] **Step 3: Add the client function + types to `frontend/src/api/tickets.ts`**

Append at the end of the file:
```ts
export interface TicketImportRowReport {
  line: number
  ticket_id: string | null
  action: 'inserted' | 'updated' | 'skipped'
  errors: string[]
}

export interface TicketImportReport {
  committed: boolean
  total_rows: number
  inserted: number
  updated: number
  skipped: number
  rows: TicketImportRowReport[]
}

export async function importTicketsCsv(
  file: File,
  commit: boolean,
): Promise<TicketImportReport> {
  const body = new FormData()
  body.append('file', file)
  body.append('commit', String(commit))
  // No explicit Content-Type: the browser sets the multipart boundary.
  return parseResponse<TicketImportReport>(
    await apiFetch('/api/v1/tickets/import', { method: 'POST', body }),
  )
}
```
`apiFetch` and `parseResponse` are already imported at the top of this file.

- [ ] **Step 4: Type-check and lint**

```bash
cd frontend && npm run format && npm run typecheck && npm run lint
```
Expected: all pass, zero warnings.

- [ ] **Step 5: Commit**

```bash
git add frontend/src/components/ui/Modal.tsx frontend/src/components/ui/index.ts frontend/src/api/tickets.ts
git commit -m "feat(tickets): import API client + Modal primitive"
```

---

## Task 4: Import dialog + Tickets page button

**Files:**
- Create: `frontend/src/components/tickets/ImportTicketsDialog.tsx`
- Modify: `frontend/src/pages/TicketsPage.tsx`

**Interfaces:**
- Consumes: `importTicketsCsv`, `TicketImportReport`, `TicketImportRowReport` (Task 3); `Modal` (Task 3); `useMutation`, `useQueryClient` from `@tanstack/react-query`.
- Produces: `ImportTicketsDialog({ onClose }: { onClose: () => void })`.

- [ ] **Step 1: Create `frontend/src/components/tickets/ImportTicketsDialog.tsx`**

```tsx
import { useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'

import {
  importTicketsCsv,
  type TicketImportReport,
  type TicketImportRowReport,
} from '../../api/tickets'
import { Modal } from '../ui'

const primaryButton =
  'rounded-lg bg-brand px-3 py-1.5 text-sm font-semibold text-white transition hover:bg-brandHover disabled:cursor-not-allowed disabled:opacity-50'
const ghostButton =
  'rounded-lg border border-slate-300 px-3 py-1.5 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50'

function downloadReport(rows: TicketImportRowReport[]) {
  const escape = (value: string) => `"${value.replace(/"/g, '""')}"`
  const lines = [
    'line,ticket_id,action,errors',
    ...rows.map((row) =>
      [
        row.line,
        escape(row.ticket_id ?? ''),
        row.action,
        escape(row.errors.join('; ')),
      ].join(','),
    ),
  ]
  const blob = new Blob([lines.join('\n')], { type: 'text/csv' })
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = 'ticket-import-report.csv'
  anchor.click()
  URL.revokeObjectURL(url)
}

function Summary({ report }: { report: TicketImportReport }) {
  const verb = report.committed ? ['inserted', 'updated'] : ['to insert', 'to update']
  return (
    <p className="text-sm text-slate-700">
      <strong>{report.total_rows}</strong> rows ·{' '}
      <strong>{report.inserted}</strong> {verb[0]} ·{' '}
      <strong>{report.updated}</strong> {verb[1]} ·{' '}
      <strong>{report.skipped}</strong> skipped
    </p>
  )
}

export function ImportTicketsDialog({ onClose }: { onClose: () => void }) {
  const queryClient = useQueryClient()
  const [file, setFile] = useState<File | null>(null)

  const preview = useMutation({ mutationFn: (f: File) => importTicketsCsv(f, false) })
  const apply = useMutation({
    mutationFn: (f: File) => importTicketsCsv(f, true),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['tickets'] }),
  })

  const report = apply.data ?? preview.data
  const error = apply.error ?? preview.error
  const busy = preview.isPending || apply.isPending

  const onPick = (next: File | null) => {
    setFile(next)
    preview.reset()
    apply.reset()
    if (next) preview.mutate(next)
  }

  return (
    <Modal onClose={onClose} labelledBy="import-tickets-title">
      <div className="space-y-4 p-5">
        <h2 id="import-tickets-title" className="text-lg font-semibold text-slate-900">
          Import tickets from CSV
        </h2>

        <input
          type="file"
          accept=".csv,text/csv"
          onChange={(event) => onPick(event.target.files?.[0] ?? null)}
          className="block text-sm"
        />

        {busy && <p className="text-sm text-slate-500">Working…</p>}

        {error && (
          <p className="text-sm text-negative" role="alert">
            {error.message}
          </p>
        )}

        {report && (
          <div className="space-y-3">
            <Summary report={report} />
            {report.rows.length > 0 && (
              <div className="max-h-72 overflow-y-auto rounded-lg border border-slate-200">
                <table className="w-full text-left text-xs">
                  <thead className="sticky top-0 bg-slate-50 text-slate-500">
                    <tr>
                      <th className="px-2 py-1.5 font-semibold">Line</th>
                      <th className="px-2 py-1.5 font-semibold">Ticket ID</th>
                      <th className="px-2 py-1.5 font-semibold">Reason</th>
                    </tr>
                  </thead>
                  <tbody>
                    {report.rows.map((row) => (
                      <tr key={row.line} className="border-t border-slate-100">
                        <td className="px-2 py-1.5 tabular-nums">{row.line}</td>
                        <td className="px-2 py-1.5">{row.ticket_id ?? '—'}</td>
                        <td className="px-2 py-1.5 text-slate-700">
                          {row.errors.join('; ')}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        <div className="flex justify-end gap-2">
          {report && report.rows.length > 0 && (
            <button
              type="button"
              className={ghostButton}
              onClick={() => downloadReport(report.rows)}
            >
              Download report
            </button>
          )}
          <button type="button" className={ghostButton} onClick={onClose}>
            {apply.data ? 'Close' : 'Cancel'}
          </button>
          {file && preview.data && !apply.data && (
            <button
              type="button"
              className={primaryButton}
              disabled={busy || preview.data.inserted + preview.data.updated === 0}
              onClick={() => apply.mutate(file)}
            >
              Apply import
            </button>
          )}
        </div>
      </div>
    </Modal>
  )
}
```

- [ ] **Step 2: Wire into `frontend/src/pages/TicketsPage.tsx`**

Add the import near the other component imports:
```tsx
import { ImportTicketsDialog } from '../components/tickets/ImportTicketsDialog'
```

Add state next to the existing `creating` state:
```tsx
const [importing, setImporting] = useState(false)
```

Replace the `PageHeader`'s `action={...}` prop (currently a single `<button>`) with two buttons wrapped in a flex container:
```tsx
action={
  <div className="flex gap-2">
    <button
      type="button"
      onClick={() => setImporting(true)}
      className="rounded-lg border border-slate-300 px-3 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
    >
      Import CSV
    </button>
    <button
      type="button"
      onClick={() => setCreating((open) => !open)}
      className="rounded-lg bg-brand px-3 py-2 text-sm font-semibold text-white transition hover:bg-brandHover"
    >
      {creating ? 'Close' : '+ New ticket'}
    </button>
  </div>
}
```

Render the dialog right after the opening `<div className="space-y-6">` (or anywhere in the returned tree, sibling to the `PageHeader`):
```tsx
{importing && <ImportTicketsDialog onClose={() => setImporting(false)} />}
```

- [ ] **Step 3: Type-check and lint**

```bash
cd frontend && npm run format && npm run typecheck && npm run lint
```
Expected: all pass.

- [ ] **Step 4: Manual browser verification**

Open `http://localhost:5173`, go to **Tickets**. Then:
1. Click **Import CSV** → modal opens.
2. Choose `data/Tickets.csv` → after a moment a summary appears (`770 rows · N to insert · M to update · ~53 skipped`) with a scrollable table of skipped rows (look for `unknown process: 'RPA - RABOT'`).
3. Click **Download report** → `ticket-import-report.csv` downloads with one row per skipped line.
4. Click **Apply import** → summary switches to past tense (`inserted / updated`), the button row now shows only **Close**.
5. Click **Close** → the ticket list has refreshed (React Query invalidation); counts in the KPI row reflect the imported data.
6. Reopen, pick a file with a renamed header column → red `role="alert"` message with the missing-column list; no **Apply** button.

- [ ] **Step 5: Commit**

```bash
git add frontend/src/components/tickets/ImportTicketsDialog.tsx frontend/src/pages/TicketsPage.tsx
git commit -m "feat(tickets): Import CSV dialog on the Tickets page"
```

---

## Self-Review

**Spec coverage:**
- Location = Tickets page button + `POST /api/v1/tickets/import` → Tasks 2, 4. ✓
- Preview then confirm (file uploaded twice) → Task 3 client, Task 4 dialog (`preview` then `apply` mutation). ✓
- Upsert keyed on `ticket_id`; CSV wins incl. nulling blanks → Task 1 `_apply` sets every `_TICKET_FIELDS` entry from `fields`, which uses `... or None` for blank cells. ✓ (verified in Task 2 Step 6)
- Fixed defaults re-applied on update (`priority_id`=3, `support_level` from `is_1l`, `ticket_color`=None) → Task 1 `fields` dict + `_apply` update loop. ✓
- Linked value missing → skip + report (process, company, AMS year, root cause) → Task 1 `_process_row`. ✓
- Unparseable date → skip + report → Task 1 `_parse_date` + `start_ok`/`end_ok`. ✓
- Duplicate `ticket_id` in file → every copy skipped → Task 1 `id_counts` / `id_counts[ticket_id] > 1`. ✓
- Only whole-file failure = bad header → Task 1 `_read_rows` raises `DataValidationError`; everything else per-row. ✓
- Per-row savepoint so one DB error doesn't abort the batch → Task 1 `_apply` `begin_nested()` + `SQLAlchemyError` catch. ✓
- Report JSON shape (`committed`, `total_rows`, `inserted`, `updated`, `skipped`, `rows[]` with `line` 1-based) → Task 1 schemas + `run`. ✓
- No auth gate, matching TODO → Task 2 Step 2 comment. ✓
- Frontend: modal, summary, skipped-rows table, downloadable CSV report, inline error, "Import CSV" button → Task 4. ✓
- No model/migration change → confirmed; no Alembic step in any task. ✓

**Placeholder scan:** No TBD / "handle errors" / "similar to" / prose-only code steps. All code blocks are complete.

**Type consistency:**
- `TicketImportService.run(*, content: bytes, commit: bool) -> TicketImportReport` — same signature in Task 1 definition, Task 1 verification scripts, Task 2 `get_ticket_import_service` usage. ✓
- `TicketImportReport` fields (`committed, total_rows, inserted, updated, skipped, rows`) — identical in Task 1 (Pydantic) and Task 3 (TS interface). ✓
- `TicketImportRowReport` fields (`line, ticket_id, action, errors`) — identical Task 1 / Task 3; `action` values `"inserted" | "updated" | "skipped"` match (report rows only ever use `"skipped"`). ✓
- `importTicketsCsv(file: File, commit: boolean)` — defined Task 3, called Task 4 (`importTicketsCsv(f, false)` / `(f, true)`). ✓
- `Modal({ onClose, labelledBy?, children })` — defined Task 3, used Task 4 with exactly those props. ✓
- `_TICKET_FIELDS` entries are all keys present in the `fields` dict built by `_process_row`. ✓

## Execution Handoff

**Plan complete and saved to `docs/superpowers/plans/2026-09-04-ticket-csv-import.md`. Two execution options:**

**1. Subagent-Driven (recommended)** — I dispatch a fresh subagent per task, review between tasks, fast iteration.

**2. Inline Execution** — Execute tasks in this session using executing-plans, batch execution with checkpoints.

**Which approach?**
