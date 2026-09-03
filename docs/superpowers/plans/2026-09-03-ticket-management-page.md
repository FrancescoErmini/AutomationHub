# Ticket Management Page Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a dedicated **Tickets** page with row-level inline editing of every raw ticket field, a default view of recently-touched + still-open tickets, and server-side search.

**Architecture:** Three new FastAPI endpoints (`GET /api/v1/tickets`, `GET /api/v1/tickets/options`, `PATCH /api/v1/tickets/{ticket_pk}`) backed by a new `TicketService`, mirroring the existing Process Economics service/router pattern (full-replace `PATCH`, no auth gate for now). A new React page + row component using `@tanstack/react-query`, the shared `ui/` primitives, and the existing `getJson`/`apiFetch` client helpers. No database migration — the `core.ticket` table already has every column.

**Tech Stack:** Backend — Python 3.12, FastAPI 0.115, SQLAlchemy 2.0, Pydantic v2, ruff, mypy (strict). Frontend — React 18, react-router 7, @tanstack/react-query 5, Tailwind 3, Vite 6, TypeScript 5.7 (strict), eslint + prettier.

**Spec:** `docs/superpowers/specs/2026-09-03-ticket-management-page-design.md`

## Global Constraints

- **No test frameworks / no CI.** The repo removed its test suite by design (see `memory/no-automated-tests.md`). Do **not** add pytest, vitest, or any test dependency. Verification in every task is: lint + typecheck + a running-stack manual check.
- **Backend lint/type gates (run from repo root):** `make lint` (`ruff check backend` + `ruff format --check backend` + frontend eslint/prettier) and `make typecheck` (`mypy backend/app` strict + `tsc --noEmit`). Both must pass clean.
- **Frontend format:** run `npm --prefix frontend run format` before `npm --prefix frontend run lint` — lint runs `prettier --check .` with `eslint --max-warnings 0`.
- **ruff rule set:** `E, F, I, B, UP, SIM, RUF`, line length 100, `target-version py312`. `fastapi.Query` / `fastapi.Depends` are allowed as literal argument defaults.
- **Auth:** write endpoint has **no** role gate; add the exact TODO comment shown in Task 2, matching `backend/app/api/v1/process_economics.py`.
- **Editable ticket fields (the full set, everywhere):** `ticket_id, ticket_type, priority_id, process_id, requestor, start_date, end_date, root_cause_id, is_1l, support_level_id, company_id, ams_year_id, note`. `id` and `created_at` are read-only.
- **Default view window:** rolling **14 days** (`date.today() - timedelta(days=14)`).
- **Running the stack for manual checks:** `make up` (docker compose, builds & starts postgres + backend + frontend). Backend defaults to `http://localhost:8000`, frontend to the port in `.env` (`make logs` to see it). `make down` to stop.

---

## File Structure

**Backend (all under `backend/app/`):**

| File | Responsibility |
|---|---|
| `schemas/ticket.py` *(new)* | `TicketRead`, `TicketUpdate`, `TicketRefOption`, `TicketOptions` Pydantic models. |
| `services/tickets.py` *(new)* | `TicketService(session)` — `list_tickets`, `get_options`, `update`. All DB logic + serialization. |
| `api/v1/tickets.py` *(new)* | Router: the three endpoints, thin — delegates to the service. |
| `dependencies.py` *(modify)* | Add `get_ticket_service` + `TicketServiceDependency`. |
| `api/v1/router.py` *(modify)* | Register `tickets.router`. |

**Frontend (all under `frontend/src/`):**

| File | Responsibility |
|---|---|
| `api/tickets.ts` *(new)* | Types + `fetchTickets`, `fetchTicketOptions`, `updateTicket`. |
| `pages/TicketsPage.tsx` *(new)* | Page shell: header, search box, scope toggle, table, empty/loading states, shared `<datalist>`, edit coordination. |
| `components/tickets/TicketRow.tsx` *(new)* | One ticket row: display mode + expand-to-edit mode with the note textarea. |
| `App.tsx` *(modify)* | Add `<Route path="tickets" …>`. |
| `components/Layout.tsx` *(modify)* | Add the **Tickets** nav link. |

---

## Task 1: Backend schemas + service

**Files:**
- Create: `backend/app/schemas/ticket.py`
- Create: `backend/app/services/tickets.py`
- Test: none (manual — see steps)

**Interfaces:**
- Consumes: SQLAlchemy models `Ticket, Priority, Process, RootCause, SupportLevel, Company, AmsYear` from `app.models.core` (relationship attrs on `Ticket`: `.priority` → `.value`, `.process` → `.canonical_name`, `.root_cause` → `.name`, `.support_level` → `.code`, `.company` → `.name`, `.ams_year` → `.code`). Exceptions `DuplicateItemError`, `NotFoundError` from `app.core.exceptions`.
- Produces:
  - `app.schemas.ticket.TicketRead` — response model (fields listed in Step 1).
  - `app.schemas.ticket.TicketUpdate` — request body; `.model_dump()` keys map 1:1 to `Ticket` column attributes.
  - `app.schemas.ticket.TicketOptions`, `app.schemas.ticket.TicketRefOption`.
  - `app.services.tickets.TicketService(session: Session)` with:
    - `list_tickets(*, scope: str, q: str | None, limit: int) -> list[dict[str, Any]]`
    - `get_options() -> dict[str, Any]`
    - `update(ticket_pk: int, payload: TicketUpdate) -> dict[str, Any]`

- [ ] **Step 1: Write `backend/app/schemas/ticket.py`**

```python
from datetime import date, datetime

from pydantic import BaseModel, Field, field_validator


class TicketRead(BaseModel):
    id: int
    ticket_id: str
    ticket_type: str
    priority_id: int | None
    priority_value: str | None
    process_id: int | None
    process_name: str | None
    requestor: str | None
    start_date: date | None
    end_date: date | None
    root_cause_id: int | None
    root_cause_name: str | None
    is_1l: bool
    support_level_id: int | None
    support_level_code: str | None
    company_id: int | None
    company_name: str | None
    ams_year_id: int | None
    ams_year_code: str | None
    note: str | None
    created_at: datetime
    is_open: bool


class TicketUpdate(BaseModel):
    """Full replace of the editable fields — the frontend always submits the
    whole row when saving an edit (mirrors ProcessEconomicsUpdate)."""

    ticket_id: str = Field(min_length=1, max_length=60)
    ticket_type: str = Field(min_length=1, max_length=60)
    priority_id: int | None = None
    process_id: int | None = None
    requestor: str | None = Field(default=None, max_length=200)
    start_date: date | None = None
    end_date: date | None = None
    root_cause_id: int | None = None
    is_1l: bool
    support_level_id: int | None = None
    company_id: int | None = None
    ams_year_id: int | None = None
    note: str | None = None

    @field_validator("requestor", "note", mode="before")
    @classmethod
    def _blank_to_none(cls, value: object) -> object:
        if isinstance(value, str) and value.strip() == "":
            return None
        return value


class TicketRefOption(BaseModel):
    id: int
    label: str


class TicketOptions(BaseModel):
    priorities: list[TicketRefOption]
    processes: list[TicketRefOption]
    root_causes: list[TicketRefOption]
    support_levels: list[TicketRefOption]
    companies: list[TicketRefOption]
    ams_years: list[TicketRefOption]
    ticket_types: list[str]
```

- [ ] **Step 2: Write `backend/app/services/tickets.py`**

```python
from datetime import date, timedelta
from typing import Any

from sqlalchemy import distinct, or_, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import InstrumentedAttribute, Session, selectinload

from app.core.exceptions import DuplicateItemError, NotFoundError
from app.models.core import (
    AmsYear,
    Company,
    Priority,
    Process,
    RootCause,
    SupportLevel,
    Ticket,
)
from app.schemas.ticket import TicketUpdate

_DEFAULT_WINDOW_DAYS = 14
_MAX_LIMIT = 5000

# Editable FK fields -> the model each points at, for existence checks on update.
_FK_MODELS: dict[str, type[Any]] = {
    "priority_id": Priority,
    "process_id": Process,
    "root_cause_id": RootCause,
    "support_level_id": SupportLevel,
    "company_id": Company,
    "ams_year_id": AmsYear,
}


class TicketService:
    def __init__(self, session: Session) -> None:
        self._session = session

    def list_tickets(self, *, scope: str, q: str | None, limit: int) -> list[dict[str, Any]]:
        stmt = select(Ticket).options(
            selectinload(Ticket.priority),
            selectinload(Ticket.process),
            selectinload(Ticket.root_cause),
            selectinload(Ticket.support_level),
            selectinload(Ticket.company),
            selectinload(Ticket.ams_year),
        )

        term = (q or "").strip()
        if term:
            pattern = f"%{term}%"
            stmt = stmt.outerjoin(Ticket.process).where(
                or_(
                    Ticket.ticket_id.ilike(pattern),
                    Ticket.requestor.ilike(pattern),
                    Process.canonical_name.ilike(pattern),
                    Ticket.note.ilike(pattern),
                )
            )
        elif scope == "default":
            cutoff = date.today() - timedelta(days=_DEFAULT_WINDOW_DAYS)
            stmt = stmt.where(
                or_(
                    Ticket.end_date.is_(None),
                    Ticket.start_date >= cutoff,
                    Ticket.end_date >= cutoff,
                )
            )

        stmt = stmt.order_by(
            Ticket.end_date.is_not(None),
            Ticket.start_date.desc().nullslast(),
            Ticket.id.desc(),
        ).limit(max(1, min(limit, _MAX_LIMIT)))

        return [self._serialize(row) for row in self._session.scalars(stmt).unique().all()]

    def get_options(self) -> dict[str, Any]:
        return {
            "priorities": self._ref(Priority, Priority.value),
            "processes": self._ref(Process, Process.canonical_name),
            "root_causes": self._ref(RootCause, RootCause.name),
            "support_levels": self._ref(SupportLevel, SupportLevel.code),
            "companies": self._ref(Company, Company.name),
            "ams_years": self._ref(AmsYear, AmsYear.code),
            "ticket_types": list(
                self._session.scalars(
                    select(distinct(Ticket.ticket_type)).order_by(Ticket.ticket_type)
                ).all()
            ),
        }

    def update(self, ticket_pk: int, payload: TicketUpdate) -> dict[str, Any]:
        ticket = self._session.get(Ticket, ticket_pk)
        if ticket is None:
            raise NotFoundError(f"Ticket {ticket_pk} not found")

        data = payload.model_dump()
        for field, model in _FK_MODELS.items():
            fk = data[field]
            if fk is not None and self._session.get(model, fk) is None:
                raise NotFoundError(f"{model.__name__} {fk} not found")

        for field, value in data.items():
            setattr(ticket, field, value)

        try:
            self._session.commit()
        except IntegrityError:
            self._session.rollback()
            raise DuplicateItemError(
                f"Ticket id '{payload.ticket_id}' already exists"
            ) from None

        self._session.refresh(ticket)
        return self._serialize(ticket)

    def _ref(
        self, model: type[Any], label_col: InstrumentedAttribute[str]
    ) -> list[dict[str, Any]]:
        rows = self._session.execute(select(model.id, label_col).order_by(label_col)).all()
        return [{"id": row_id, "label": label} for row_id, label in rows]

    @staticmethod
    def _serialize(t: Ticket) -> dict[str, Any]:
        return {
            "id": t.id,
            "ticket_id": t.ticket_id,
            "ticket_type": t.ticket_type,
            "priority_id": t.priority_id,
            "priority_value": t.priority.value if t.priority else None,
            "process_id": t.process_id,
            "process_name": t.process.canonical_name if t.process else None,
            "requestor": t.requestor,
            "start_date": t.start_date,
            "end_date": t.end_date,
            "root_cause_id": t.root_cause_id,
            "root_cause_name": t.root_cause.name if t.root_cause else None,
            "is_1l": t.is_1l,
            "support_level_id": t.support_level_id,
            "support_level_code": t.support_level.code if t.support_level else None,
            "company_id": t.company_id,
            "company_name": t.company.name if t.company else None,
            "ams_year_id": t.ams_year_id,
            "ams_year_code": t.ams_year.code if t.ams_year else None,
            "note": t.note,
            "created_at": t.created_at,
            "is_open": t.end_date is None,
        }
```

- [ ] **Step 3: Lint + typecheck**

Run: `make lint && make typecheck`
Expected: PASS clean. If mypy flags `select(model.id, label_col)` typing, keep the `InstrumentedAttribute[str]` annotation as written — `model.id` on `type[Any]` resolves to `Any` and is fine.

- [ ] **Step 4: Smoke-test the service against the dev DB**

Start postgres only: `make db-up`. Then from repo root run:

```bash
cd backend && DATABASE_URL="postgresql+psycopg://automation_hub:automation_hub_dev@localhost:${POSTGRES_PORT:-5432}/automation_hub" \
  .venv/bin/python -c "
from app.db.session import SessionLocal
from app.services.tickets import TicketService
s = SessionLocal()
svc = TicketService(s)
default = svc.list_tickets(scope='default', q=None, limit=500)
allrows = svc.list_tickets(scope='all', q=None, limit=500)
opts = svc.get_options()
print('default rows:', len(default), '| all rows:', len(allrows))
print('option counts:', {k: len(v) for k, v in opts.items()})
print('sample row keys:', sorted(default[0].keys()) if default else 'no rows')
"
```

Expected: runs without error; `default rows` ≤ `all rows`; every option list non-empty (assuming reference data is seeded); `sample row keys` matches the `TicketRead` field names. If `SessionLocal` is not the export name, check `backend/app/db/session.py` for the actual session factory and adjust.

- [ ] **Step 5: Commit**

```bash
git add backend/app/schemas/ticket.py backend/app/services/tickets.py
git commit -m "feat(backend): ticket read/update/options service and schemas"
```

---

## Task 2: Backend router + wiring

**Files:**
- Create: `backend/app/api/v1/tickets.py`
- Modify: `backend/app/dependencies.py`
- Modify: `backend/app/api/v1/router.py`
- Test: none (manual — curl)

**Interfaces:**
- Consumes: `TicketService` from Task 1; `DbSession` and the `Annotated[..., Depends(...)]` pattern from `app.dependencies` (see `get_process_economics_service` for the exact shape).
- Produces:
  - `app.dependencies.TicketServiceDependency` — `Annotated[TicketService, Depends(get_ticket_service)]`.
  - Routes: `GET /api/v1/tickets`, `GET /api/v1/tickets/options`, `PATCH /api/v1/tickets/{ticket_pk}`.

- [ ] **Step 1: Add the dependency in `backend/app/dependencies.py`**

Add the import next to the other service imports (keep alphabetical within the block):

```python
from app.services.tickets import TicketService
```

Add this after the `ProcessEconomicsServiceDependency` block:

```python
def get_ticket_service(session: DbSession) -> TicketService:
    return TicketService(session)


TicketServiceDependency = Annotated[TicketService, Depends(get_ticket_service)]
```

- [ ] **Step 2: Write `backend/app/api/v1/tickets.py`**

```python
from typing import Literal

from fastapi import APIRouter, Query

from app.dependencies import TicketServiceDependency
from app.schemas.ticket import TicketOptions, TicketRead, TicketUpdate

router = APIRouter(prefix="/tickets", tags=["tickets"])


@router.get("", response_model=list[TicketRead])
def list_tickets(
    service: TicketServiceDependency,
    scope: Literal["default", "all"] = "default",
    q: str | None = None,
    limit: int = Query(default=500, ge=1, le=5000),
) -> list[TicketRead]:
    return [
        TicketRead(**row) for row in service.list_tickets(scope=scope, q=q, limit=limit)
    ]


@router.get("/options", response_model=TicketOptions)
def ticket_options(service: TicketServiceDependency) -> TicketOptions:
    return TicketOptions(**service.get_options())


# TODO: temporary — restore the RequireEditor dependency on this write endpoint
# (add `_user: RequireEditor` and re-import it from app.dependencies).
@router.patch("/{ticket_pk}", response_model=TicketRead)
def update_ticket(
    ticket_pk: int,
    payload: TicketUpdate,
    service: TicketServiceDependency,
) -> TicketRead:
    return TicketRead(**service.update(ticket_pk, payload))
```

- [ ] **Step 3: Register the router in `backend/app/api/v1/router.py`**

Add `tickets` to the `from app.api.v1 import (...)` tuple (alphabetical — after `simple_ops`), and add this line after `router.include_router(me.router)`:

```python
router.include_router(tickets.router)
```

- [ ] **Step 4: Lint + typecheck**

Run: `make lint && make typecheck`
Expected: PASS clean.

- [ ] **Step 5: Curl the three endpoints**

Start the stack: `make up`. Wait for `curl -sf localhost:8000/health` to return `{"status":"ok"}`. Then:

```bash
# list — default window
curl -s 'http://localhost:8000/api/v1/tickets' | head -c 400; echo
# list — all
curl -s 'http://localhost:8000/api/v1/tickets?scope=all&limit=5' | python -m json.tool | head -40
# search (pick a substring you know exists in a ticket_id / requestor / note)
curl -s 'http://localhost:8000/api/v1/tickets?q=AMS' | python -m json.tool | head -40
# options
curl -s 'http://localhost:8000/api/v1/tickets/options' | python -m json.tool
# update — replace <PK> with a real id from the list; round-trips the same values
curl -s -X PATCH "http://localhost:8000/api/v1/tickets/<PK>" \
  -H 'Content-Type: application/json' \
  -d '{"ticket_id":"<same ticket_id>","ticket_type":"<same type>","is_1l":true,"note":"plan smoke test"}' \
  | python -m json.tool
# duplicate ticket_id -> 409
curl -s -o /dev/null -w '%{http_code}\n' -X PATCH "http://localhost:8000/api/v1/tickets/<PK>" \
  -H 'Content-Type: application/json' \
  -d '{"ticket_id":"<some OTHER existing ticket_id>","ticket_type":"x","is_1l":true}'
```

Expected: list returns JSON array; `scope=all` returns ≥ as many rows; `q=` filters; `/options` has every list populated; the PATCH returns the updated row with `is_open` reflecting `end_date`; the duplicate PATCH prints `409`. Undo the `note` test edit via another PATCH if you like. `make down` when done.

- [ ] **Step 6: Commit**

```bash
git add backend/app/api/v1/tickets.py backend/app/dependencies.py backend/app/api/v1/router.py
git commit -m "feat(backend): expose /api/v1/tickets list, options, and update endpoints"
```

---

## Task 3: Frontend API client

**Files:**
- Create: `frontend/src/api/tickets.ts`
- Test: none (types compile = the check)

**Interfaces:**
- Consumes: `apiFetch`, `getJson`, `parseResponse` from `frontend/src/api/client.ts` (see `frontend/src/api/processEconomics.ts` for the exact call shapes).
- Produces:
  - Types `TicketRow`, `TicketRefOption`, `TicketOptions`, `TicketUpdate`.
  - `fetchTickets(params: { scope: 'default' | 'all'; q: string }): Promise<TicketRow[]>`
  - `fetchTicketOptions(): Promise<TicketOptions>`
  - `updateTicket(id: number, payload: TicketUpdate): Promise<TicketRow>`

- [ ] **Step 1: Write `frontend/src/api/tickets.ts`**

```ts
import { apiFetch, getJson, parseResponse } from './client'

export interface TicketRow {
  id: number
  ticket_id: string
  ticket_type: string
  priority_id: number | null
  priority_value: string | null
  process_id: number | null
  process_name: string | null
  requestor: string | null
  start_date: string | null
  end_date: string | null
  root_cause_id: number | null
  root_cause_name: string | null
  is_1l: boolean
  support_level_id: number | null
  support_level_code: string | null
  company_id: number | null
  company_name: string | null
  ams_year_id: number | null
  ams_year_code: string | null
  note: string | null
  created_at: string
  is_open: boolean
}

export interface TicketRefOption {
  id: number
  label: string
}

export interface TicketOptions {
  priorities: TicketRefOption[]
  processes: TicketRefOption[]
  root_causes: TicketRefOption[]
  support_levels: TicketRefOption[]
  companies: TicketRefOption[]
  ams_years: TicketRefOption[]
  ticket_types: string[]
}

export interface TicketUpdate {
  ticket_id: string
  ticket_type: string
  priority_id: number | null
  process_id: number | null
  requestor: string | null
  start_date: string | null
  end_date: string | null
  root_cause_id: number | null
  is_1l: boolean
  support_level_id: number | null
  company_id: number | null
  ams_year_id: number | null
  note: string | null
}

export async function fetchTickets(params: {
  scope: 'default' | 'all'
  q: string
}): Promise<TicketRow[]> {
  return getJson<TicketRow[]>('/api/v1/tickets', {
    scope: params.scope,
    q: params.q || undefined,
  })
}

export async function fetchTicketOptions(): Promise<TicketOptions> {
  return getJson<TicketOptions>('/api/v1/tickets/options')
}

export async function updateTicket(
  id: number,
  payload: TicketUpdate,
): Promise<TicketRow> {
  return parseResponse<TicketRow>(
    await apiFetch(`/api/v1/tickets/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    }),
  )
}
```

- [ ] **Step 2: Format + lint + typecheck**

Run: `npm --prefix frontend run format && npm --prefix frontend run lint && npm --prefix frontend run typecheck`
Expected: PASS clean.

- [ ] **Step 3: Commit**

```bash
git add frontend/src/api/tickets.ts
git commit -m "feat(frontend): ticket API client"
```

---

## Task 4: Tickets page shell (list, search, scope toggle) — display only

**Files:**
- Create: `frontend/src/pages/TicketsPage.tsx`
- Modify: `frontend/src/App.tsx`
- Modify: `frontend/src/components/Layout.tsx`
- Test: none (manual click-through)

**Interfaces:**
- Consumes: `fetchTickets`, `fetchTicketOptions`, `TicketRow`, `TicketOptions` from Task 3; `PageHeader` from `frontend/src/components/ui`; `AsyncSection` from `frontend/src/components/AsyncSection`; `StatusBadge` from `frontend/src/components/ui`.
- Produces:
  - `TicketsPage` React component (default page export style: `export function TicketsPage()`).
  - The route `/tickets` and the nav link.
  - Query keys: `['tickets', 'options']` and `['tickets', scope, debouncedSearch]` — Task 5's mutation invalidates `['tickets']`.
  - A shared `<datalist id="ticket-process-options">` rendered once on the page.
  - The column order (used by Task 5's edit row): **Ticket ID · Type · Priority · Process · Requestor · Start · End · Status · Root cause · Level · Support · Company · AMS yr · Note · (actions)** — 15 columns.

- [ ] **Step 1: Write `frontend/src/pages/TicketsPage.tsx`** (display-only; Task 5 adds the edit row)

```tsx
import { useEffect, useMemo, useRef, useState } from 'react'
import { useQuery } from '@tanstack/react-query'

import { fetchTicketOptions, fetchTickets, type TicketRow } from '../api/tickets'
import { AsyncSection } from '../components/AsyncSection'
import { PageHeader, StatusBadge } from '../components/ui'

const PROCESS_DATALIST_ID = 'ticket-process-options'
const headCell =
  'whitespace-nowrap px-3 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500'
const bodyCell = 'whitespace-nowrap px-3 py-2 align-top text-slate-700'

function useDebounced<T>(value: T, ms: number): T {
  const [debounced, setDebounced] = useState(value)
  useEffect(() => {
    const id = window.setTimeout(() => setDebounced(value), ms)
    return () => window.clearTimeout(id)
  }, [value, ms])
  return debounced
}

function DisplayRow({ row }: { row: TicketRow }) {
  return (
    <tr className="border-b border-slate-100 last:border-0">
      <td className={`${bodyCell} font-medium text-ink`}>{row.ticket_id}</td>
      <td className={bodyCell}>{row.ticket_type}</td>
      <td className={bodyCell}>{row.priority_value ?? '—'}</td>
      <td className={`${bodyCell} max-w-[220px] truncate`} title={row.process_name ?? ''}>
        {row.process_name ?? '—'}
      </td>
      <td className={bodyCell}>{row.requestor ?? '—'}</td>
      <td className={bodyCell}>{row.start_date ?? '—'}</td>
      <td className={bodyCell}>{row.end_date ?? '—'}</td>
      <td className={bodyCell}>
        <StatusBadge tone={row.is_open ? 'warning' : 'positive'}>
          {row.is_open ? 'Open' : 'Closed'}
        </StatusBadge>
      </td>
      <td className={bodyCell}>{row.root_cause_name ?? '—'}</td>
      <td className={bodyCell}>{row.is_1l ? '1L' : '2L'}</td>
      <td className={bodyCell}>{row.support_level_code ?? '—'}</td>
      <td className={bodyCell}>{row.company_name ?? '—'}</td>
      <td className={bodyCell}>{row.ams_year_code ?? '—'}</td>
      <td className={`${bodyCell} max-w-[260px] truncate`} title={row.note ?? ''}>
        {row.note ?? '—'}
      </td>
      <td className={bodyCell} />
    </tr>
  )
}

export function TicketsPage() {
  const [scope, setScope] = useState<'default' | 'all'>('default')
  const [search, setSearch] = useState('')
  const debouncedSearch = useDebounced(search.trim(), 300)
  const searching = debouncedSearch !== ''

  const options = useQuery({
    queryKey: ['tickets', 'options'],
    queryFn: fetchTicketOptions,
    staleTime: 5 * 60_000,
  })

  const tickets = useQuery({
    queryKey: ['tickets', scope, debouncedSearch],
    queryFn: () => fetchTickets({ scope, q: debouncedSearch }),
  })

  const processOptions = options.data?.processes ?? []
  const rows = useMemo(() => tickets.data ?? [], [tickets.data])

  const toggleBtn = (value: 'default' | 'all', label: string) => (
    <button
      type="button"
      onClick={() => setScope(value)}
      disabled={searching}
      className={`rounded-lg px-3 py-2 text-sm font-semibold transition disabled:cursor-not-allowed disabled:opacity-50 ${
        scope === value
          ? 'bg-brand text-white'
          : 'border border-slate-300 text-slate-700 hover:bg-slate-50'
      }`}
    >
      {label}
    </button>
  )

  return (
    <div className="space-y-6">
      <PageHeader
        title="Tickets"
        subtitle="Review and edit raw ticket records inline. The default view shows every ticket still open plus anything opened or closed in the last 14 days; search spans all tickets."
      />

      <div className="flex flex-wrap items-center gap-3">
        <input
          type="search"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder="Search id, requestor, process, or note…"
          className="w-full max-w-sm rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/30"
        />
        <div className="flex gap-2">
          {toggleBtn('default', 'Recent & open')}
          {toggleBtn('all', 'All tickets')}
        </div>
        {searching && (
          <span className="text-xs text-slate-500">
            Showing search results across all tickets
          </span>
        )}
      </div>

      <datalist id={PROCESS_DATALIST_ID}>
        {processOptions.map((option) => (
          <option key={option.id} value={option.label} />
        ))}
      </datalist>

      <AsyncSection
        isPending={tickets.isPending || options.isPending}
        isError={tickets.isError || options.isError}
        error={tickets.error ?? options.error}
        loadingLabel="Loading tickets…"
      >
        <p className="text-xs text-slate-500">
          {rows.length} ticket{rows.length === 1 ? '' : 's'}
          {rows.length >= 500 ? ' (server-limited — narrow with search)' : ''}
        </p>
        <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white shadow-card">
          <table className="w-full min-w-[1400px] text-sm">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50">
                <th className={headCell}>Ticket ID</th>
                <th className={headCell}>Type</th>
                <th className={headCell}>Priority</th>
                <th className={headCell}>Process</th>
                <th className={headCell}>Requestor</th>
                <th className={headCell}>Start</th>
                <th className={headCell}>End</th>
                <th className={headCell}>Status</th>
                <th className={headCell}>Root cause</th>
                <th className={headCell}>Level</th>
                <th className={headCell}>Support</th>
                <th className={headCell}>Company</th>
                <th className={headCell}>AMS yr</th>
                <th className={headCell}>Note</th>
                <th className={headCell} />
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <DisplayRow key={row.id} row={row} />
              ))}
              {rows.length === 0 && (
                <tr>
                  <td colSpan={15} className="px-3 py-6 text-center text-slate-500">
                    {searching
                      ? 'No ticket matches your search.'
                      : 'No open or recently-touched tickets.'}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </AsyncSection>
    </div>
  )
}
```

Note: the `useRef` import is unused right now — remove it from the import line for this task; Task 5 re-adds it. (Keep lint clean: `import { useEffect, useMemo, useState } from 'react'`.)

- [ ] **Step 2: Add the route in `frontend/src/App.tsx`**

Add the import (alphabetical, after `SlaKpiPage` / with the other page imports):

```tsx
import { TicketsPage } from './pages/TicketsPage'
```

Add the route inside the `<Route element={<Layout />}>` group, after the `simple-ops` route:

```tsx
<Route path="tickets" element={<TicketsPage />} />
```

- [ ] **Step 3: Add the nav link in `frontend/src/components/Layout.tsx`**

After the `Operations` `NavLink` and before `SLA / KPI`:

```tsx
<NavLink to="/tickets" className={navClass}>
  Tickets
</NavLink>
```

- [ ] **Step 4: Format + lint + typecheck + build**

Run: `npm --prefix frontend run format && npm --prefix frontend run lint && npm --prefix frontend run build`
Expected: all PASS clean.

- [ ] **Step 5: Manual click-through**

With `make up` running, open the frontend, click **Tickets** in the nav:
- Table loads with the default (recent & open) rows; status badges show Open/Closed.
- Toggle **All tickets** → more rows appear. Toggle back.
- Type a known substring in search → results narrow, the scope toggle greys out, the "search results across all tickets" hint shows.
- Clear search → default view returns.
- Table scrolls horizontally; page body does not.

- [ ] **Step 6: Commit**

```bash
git add frontend/src/pages/TicketsPage.tsx frontend/src/App.tsx frontend/src/components/Layout.tsx
git commit -m "feat(frontend): tickets page with list, search, and scope toggle"
```

---

## Task 5: Inline row editing (expand-to-edit + note textarea)

**Files:**
- Create: `frontend/src/components/tickets/TicketRow.tsx`
- Modify: `frontend/src/pages/TicketsPage.tsx`
- Test: none (manual click-through)

**Interfaces:**
- Consumes: `TicketRow` (type), `TicketOptions`, `TicketUpdate`, `updateTicket` from `../api/tickets`; `StatusBadge` from `../components/ui`; `useMutation`, `useQueryClient` from `@tanstack/react-query`.
- Produces: `TicketEditableRow` component —
  `{ row: TicketRow; options: TicketOptions; isEditing: boolean; onRequestEdit: () => void; onDone: () => void; onDirtyChange: (dirty: boolean) => void }`.
  Replaces `DisplayRow` usage in `TicketsPage`.

- [ ] **Step 1: Write `frontend/src/components/tickets/TicketRow.tsx`**

```tsx
import { useEffect, useMemo, useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'

import {
  updateTicket,
  type TicketOptions,
  type TicketRow,
  type TicketUpdate,
} from '../../api/tickets'
import { StatusBadge } from '../ui'

const PROCESS_DATALIST_ID = 'ticket-process-options'
const bodyCell = 'whitespace-nowrap px-3 py-2 align-top text-slate-700'
const inputClass =
  'w-full min-w-[7rem] rounded-lg border border-slate-300 px-2 py-1 text-sm focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/30'
const ghostButton =
  'rounded-lg border border-slate-300 px-3 py-1 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50'
const primaryButton =
  'rounded-lg bg-brand px-3 py-1 text-sm font-semibold text-white transition hover:bg-brandHover disabled:cursor-not-allowed disabled:opacity-50'

interface RowForm {
  ticket_id: string
  ticket_type: string
  priority_id: string
  process_label: string
  requestor: string
  start_date: string
  end_date: string
  root_cause_id: string
  is_1l: 'true' | 'false'
  support_level_id: string
  company_id: string
  ams_year_id: string
  note: string
}

function rowToForm(row: TicketRow): RowForm {
  return {
    ticket_id: row.ticket_id,
    ticket_type: row.ticket_type,
    priority_id: row.priority_id === null ? '' : String(row.priority_id),
    process_label: row.process_name ?? '',
    requestor: row.requestor ?? '',
    start_date: row.start_date ?? '',
    end_date: row.end_date ?? '',
    root_cause_id: row.root_cause_id === null ? '' : String(row.root_cause_id),
    is_1l: row.is_1l ? 'true' : 'false',
    support_level_id:
      row.support_level_id === null ? '' : String(row.support_level_id),
    company_id: row.company_id === null ? '' : String(row.company_id),
    ams_year_id: row.ams_year_id === null ? '' : String(row.ams_year_id),
    note: row.note ?? '',
  }
}

const numOrNull = (value: string): number | null =>
  value === '' ? null : Number(value)

function formToPayload(form: RowForm, processId: number | null): TicketUpdate {
  return {
    ticket_id: form.ticket_id.trim(),
    ticket_type: form.ticket_type.trim(),
    priority_id: numOrNull(form.priority_id),
    process_id: processId,
    requestor: form.requestor.trim() || null,
    start_date: form.start_date || null,
    end_date: form.end_date || null,
    root_cause_id: numOrNull(form.root_cause_id),
    is_1l: form.is_1l === 'true',
    support_level_id: numOrNull(form.support_level_id),
    company_id: numOrNull(form.company_id),
    ams_year_id: numOrNull(form.ams_year_id),
    note: form.note.trim() || null,
  }
}

function RefSelect({
  value,
  onChange,
  options,
  label,
}: {
  value: string
  onChange: (next: string) => void
  options: { id: number; label: string }[]
  label: string
}) {
  return (
    <select
      className={inputClass}
      value={value}
      onChange={(event) => onChange(event.target.value)}
      aria-label={label}
    >
      <option value="">—</option>
      {options.map((option) => (
        <option key={option.id} value={String(option.id)}>
          {option.label}
        </option>
      ))}
    </select>
  )
}

export function TicketEditableRow({
  row,
  options,
  isEditing,
  onRequestEdit,
  onDone,
  onDirtyChange,
}: {
  row: TicketRow
  options: TicketOptions
  isEditing: boolean
  onRequestEdit: () => void
  onDone: () => void
  onDirtyChange: (dirty: boolean) => void
}) {
  const queryClient = useQueryClient()
  const [form, setForm] = useState<RowForm>(() => rowToForm(row))

  useEffect(() => {
    if (isEditing) setForm(rowToForm(row))
  }, [isEditing, row])

  const pristine = useMemo(() => JSON.stringify(rowToForm(row)), [row])
  const dirty = JSON.stringify(form) !== pristine

  useEffect(() => {
    if (isEditing) onDirtyChange(dirty)
  }, [isEditing, dirty, onDirtyChange])

  const typedProcess = form.process_label.trim()
  const resolvedProcessId =
    typedProcess === ''
      ? null
      : (options.processes.find((option) => option.label === typedProcess)?.id ??
        undefined)
  const processUnmatched = typedProcess !== '' && resolvedProcessId === undefined

  const save = useMutation({
    mutationFn: (payload: TicketUpdate) => updateTicket(row.id, payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tickets'] })
      onDirtyChange(false)
      onDone()
    },
  })

  const patch = (part: Partial<RowForm>) =>
    setForm((current) => ({ ...current, ...part }))

  const canSave =
    form.ticket_id.trim() !== '' &&
    form.ticket_type.trim() !== '' &&
    !processUnmatched &&
    !save.isPending

  const submit = () => {
    if (!canSave) return
    save.mutate(formToPayload(form, resolvedProcessId ?? null))
  }

  const cancel = () => {
    save.reset()
    onDirtyChange(false)
    onDone()
  }

  const onKeyDown = (event: React.KeyboardEvent) => {
    if (event.key === 'Escape') cancel()
    if (event.key === 'Enter' && event.target instanceof HTMLInputElement) submit()
  }

  if (!isEditing) {
    return (
      <tr className="border-b border-slate-100 last:border-0">
        <td className={`${bodyCell} font-medium text-ink`}>{row.ticket_id}</td>
        <td className={bodyCell}>{row.ticket_type}</td>
        <td className={bodyCell}>{row.priority_value ?? '—'}</td>
        <td
          className={`${bodyCell} max-w-[220px] truncate`}
          title={row.process_name ?? ''}
        >
          {row.process_name ?? '—'}
        </td>
        <td className={bodyCell}>{row.requestor ?? '—'}</td>
        <td className={bodyCell}>{row.start_date ?? '—'}</td>
        <td className={bodyCell}>{row.end_date ?? '—'}</td>
        <td className={bodyCell}>
          <StatusBadge tone={row.is_open ? 'warning' : 'positive'}>
            {row.is_open ? 'Open' : 'Closed'}
          </StatusBadge>
        </td>
        <td className={bodyCell}>{row.root_cause_name ?? '—'}</td>
        <td className={bodyCell}>{row.is_1l ? '1L' : '2L'}</td>
        <td className={bodyCell}>{row.support_level_code ?? '—'}</td>
        <td className={bodyCell}>{row.company_name ?? '—'}</td>
        <td className={bodyCell}>{row.ams_year_code ?? '—'}</td>
        <td className={`${bodyCell} max-w-[260px] truncate`} title={row.note ?? ''}>
          {row.note ?? '—'}
        </td>
        <td className={bodyCell}>
          <button type="button" className={ghostButton} onClick={onRequestEdit}>
            Edit
          </button>
        </td>
      </tr>
    )
  }

  return (
    <>
      <tr className="border-b border-slate-100 bg-slate-50/60" onKeyDown={onKeyDown}>
        <td className={bodyCell}>
          <input
            className={inputClass}
            value={form.ticket_id}
            onChange={(event) => patch({ ticket_id: event.target.value })}
            aria-label="Ticket ID"
          />
        </td>
        <td className={bodyCell}>
          <input
            className={inputClass}
            list="ticket-type-options"
            value={form.ticket_type}
            onChange={(event) => patch({ ticket_type: event.target.value })}
            aria-label="Ticket type"
          />
          <datalist id="ticket-type-options">
            {options.ticket_types.map((type) => (
              <option key={type} value={type} />
            ))}
          </datalist>
        </td>
        <td className={bodyCell}>
          <RefSelect
            label="Priority"
            value={form.priority_id}
            onChange={(next) => patch({ priority_id: next })}
            options={options.priorities}
          />
        </td>
        <td className={bodyCell}>
          <input
            className={inputClass}
            list={PROCESS_DATALIST_ID}
            value={form.process_label}
            onChange={(event) => patch({ process_label: event.target.value })}
            aria-label="Process"
          />
          {processUnmatched && (
            <span className="mt-1 block text-xs text-negative">
              Pick a process from the list
            </span>
          )}
        </td>
        <td className={bodyCell}>
          <input
            className={inputClass}
            value={form.requestor}
            onChange={(event) => patch({ requestor: event.target.value })}
            aria-label="Requestor"
          />
        </td>
        <td className={bodyCell}>
          <input
            type="date"
            className={inputClass}
            value={form.start_date}
            onChange={(event) => patch({ start_date: event.target.value })}
            aria-label="Start date"
          />
        </td>
        <td className={bodyCell}>
          <input
            type="date"
            className={inputClass}
            value={form.end_date}
            onChange={(event) => patch({ end_date: event.target.value })}
            aria-label="End date"
          />
        </td>
        <td className={bodyCell}>
          <StatusBadge tone={form.end_date === '' ? 'warning' : 'positive'}>
            {form.end_date === '' ? 'Open' : 'Closed'}
          </StatusBadge>
        </td>
        <td className={bodyCell}>
          <RefSelect
            label="Root cause"
            value={form.root_cause_id}
            onChange={(next) => patch({ root_cause_id: next })}
            options={options.root_causes}
          />
        </td>
        <td className={bodyCell}>
          <select
            className={inputClass}
            value={form.is_1l}
            onChange={(event) =>
              patch({ is_1l: event.target.value as 'true' | 'false' })
            }
            aria-label="Support tier"
          >
            <option value="true">1L</option>
            <option value="false">2L</option>
          </select>
        </td>
        <td className={bodyCell}>
          <RefSelect
            label="Support level"
            value={form.support_level_id}
            onChange={(next) => patch({ support_level_id: next })}
            options={options.support_levels}
          />
        </td>
        <td className={bodyCell}>
          <RefSelect
            label="Company"
            value={form.company_id}
            onChange={(next) => patch({ company_id: next })}
            options={options.companies}
          />
        </td>
        <td className={bodyCell}>
          <RefSelect
            label="AMS year"
            value={form.ams_year_id}
            onChange={(next) => patch({ ams_year_id: next })}
            options={options.ams_years}
          />
        </td>
        <td className={bodyCell} colSpan={2}>
          <span className="text-xs text-slate-500">Note edited below ↓</span>
        </td>
      </tr>
      <tr className="border-b border-slate-100 bg-slate-50/60" onKeyDown={onKeyDown}>
        <td className={bodyCell} colSpan={15}>
          <div className="flex flex-col gap-2">
            <label className="text-xs font-semibold uppercase tracking-wide text-slate-500">
              Note
              <textarea
                className={`${inputClass} mt-1 resize-y font-normal normal-case`}
                rows={4}
                value={form.note}
                onChange={(event) => patch({ note: event.target.value })}
              />
            </label>
            {save.error && (
              <p className="text-sm text-negative" role="alert">
                {save.error.message}
              </p>
            )}
            <div className="flex justify-end gap-2">
              <button
                type="button"
                className={ghostButton}
                onClick={cancel}
                disabled={save.isPending}
              >
                Cancel
              </button>
              <button
                type="button"
                className={primaryButton}
                onClick={submit}
                disabled={!canSave}
              >
                {save.isPending ? 'Saving…' : 'Save'}
              </button>
            </div>
          </div>
        </td>
      </tr>
    </>
  )
}
```

- [ ] **Step 2: Wire it into `frontend/src/pages/TicketsPage.tsx`**

Replace the `DisplayRow` component and its usage:

1. Delete the local `DisplayRow` function.
2. Update imports: add `useRef` back to the react import; add
   `import { TicketEditableRow } from '../components/tickets/TicketRow'`.
3. Inside `TicketsPage`, add edit-coordination state after the `search` state:

```tsx
const [editingId, setEditingId] = useState<number | null>(null)
const dirtyRef = useRef(false)

const requestEdit = (id: number) => {
  if (
    editingId !== null &&
    editingId !== id &&
    dirtyRef.current &&
    !window.confirm('Discard unsaved changes to the ticket you are editing?')
  ) {
    return
  }
  dirtyRef.current = false
  setEditingId(id)
}
```

4. Render rows with the new component. Bind `options.data` to a local const first so TypeScript keeps the narrowing inside the `.map` callback (`AsyncSection` already blocks render until `options` resolves):

```tsx
{(() => {
  const opts = options.data
  if (!opts) return null
  return rows.map((row) => (
    <TicketEditableRow
      key={row.id}
      row={row}
      options={opts}
      isEditing={editingId === row.id}
      onRequestEdit={() => requestEdit(row.id)}
      onDone={() => {
        dirtyRef.current = false
        setEditingId(null)
      }}
      onDirtyChange={(value) => {
        dirtyRef.current = value
      }}
    />
  ))
})()}
```

5. The `<datalist id="ticket-process-options">` block stays as-is (Task 4 added it; `TicketRow` references the same id).

- [ ] **Step 3: Format + lint + typecheck + build**

Run: `npm --prefix frontend run format && npm --prefix frontend run lint && npm --prefix frontend run build`
Expected: all PASS clean. Common catches: unused `useMemo`/`useRef` imports, `options.data` possibly-undefined (the `options.data &&` guard handles it), `onDirtyChange` in a `useEffect` dep list (it is stable enough here since the parent passes an inline setter writing a ref — if eslint's `react-hooks/exhaustive-deps` complains, wrap the parent's `onDirtyChange` in `useCallback`).

- [ ] **Step 4: Manual click-through** (with `make up` running)

- Click **Edit** on a row → it expands: every cell becomes an input/select, a full-width Note textarea appears below with Cancel / Save.
- Other rows stay in display mode and do not shift vertically beyond the expanded row.
- Edit the note (multi-line), change `end_date` → the inline Status badge flips Open/Closed live.
- **Save** → row collapses, table refetches, the change persists (reload the page to confirm).
- Edit another row, change something, then click **Edit** on a third row → confirm dialog appears; Cancel keeps you on the current edit, OK moves.
- In an editing row press **Esc** → collapses without saving. Press **Enter** in a text input → saves.
- Type a bogus process name → "Pick a process from the list" hint shows and Save is disabled. Pick a real one from the dropdown → hint clears.
- Change `ticket_id` to one that already exists → Save → inline red error with the 409 message; row stays open.

- [ ] **Step 5: Commit**

```bash
git add frontend/src/components/tickets/TicketRow.tsx frontend/src/pages/TicketsPage.tsx
git commit -m "feat(frontend): inline row editing for tickets with note textarea"
```

---

## Task 6: Final pass — full checklist + docs note

**Files:**
- Modify: `docs/superpowers/specs/2026-09-03-ticket-management-page-design.md` (mark implemented)
- Test: full manual checklist from the spec

**Interfaces:** none.

- [ ] **Step 1: Run the full spec testing checklist**

From `docs/superpowers/specs/2026-09-03-ticket-management-page-design.md` §Testing, top to bottom:
- `make lint` clean.
- `make typecheck` clean.
- `npm --prefix frontend run build` clean.
- The `GET /api/v1/tickets` scope + `q` behaviours (Task 2 curl block).
- `GET /api/v1/tickets/options` populated.
- `PATCH` each field type persists; `end_date` set/clear moves the row Open↔Closed; duplicate `ticket_id` → 409; bad FK id → 404 (`curl -X PATCH .../<PK> -d '{"ticket_id":"x","ticket_type":"y","is_1l":true,"priority_id":999999}'`).
- Page click-through: default view, All toggle, search, edit+save, Cancel, Esc, Enter-to-save, dirty-guard confirm, duplicate-id error row.
- Nav link routes correctly.

Fix anything that fails before proceeding.

- [ ] **Step 2: Mark the spec implemented**

Add to the top of the spec file, right after the `# Ticket Management Page` heading:

```markdown
> **Status:** Implemented 2026-09-03 — plan `docs/superpowers/plans/2026-09-03-ticket-management-page.md`.
```

- [ ] **Step 3: Commit**

```bash
git add docs/superpowers/specs/2026-09-03-ticket-management-page-design.md
git commit -m "docs: mark ticket management page spec implemented"
```

---

## Self-Review Notes

**Spec coverage:**
- Editing-only, all fields incl. `ticket_id` → Task 1 (`TicketUpdate`), Task 5 (form).
- `GET /tickets` scope + search semantics (14-day window, search spans all, ordering) → Task 1 `list_tickets`.
- `GET /tickets/options` incl. distinct `ticket_types` → Task 1 `get_options`.
- `PATCH` full-replace, 409 on dup, 404 on bad FK → Task 1 `update` + Task 2 curl checks.
- No auth gate + TODO comment → Task 2 Step 2.
- Row edit + expand, note textarea, one row at a time, dirty guard, Esc/Enter, process typeahead, 1L/2L select, date inputs → Task 5.
- Route + nav → Task 4.
- Manual-only testing → every task's verification steps; no test deps added.

**Deviations from the spec (flag to the user):**
- Spec §TicketRow says an unmatched typed process "keeps the previous id" with a subtle hint (non-blocking). This plan instead **disables Save** with a visible hint until the process resolves to a real option — it avoids silently saving something other than what the field shows. Same net data safety, clearer UX. Revert to non-blocking if preferred.

**Placeholder scan:** none — every code step is complete file content or a precise diff.

**Type consistency:** `TicketUpdate` fields (Task 3 TS / Task 1 Py) match; `_serialize` dict keys match `TicketRead` fields; `TicketEditableRow` prop names match the Task 4 call site; query keys `['tickets', ...]` consistent between page queries and the mutation invalidation.
