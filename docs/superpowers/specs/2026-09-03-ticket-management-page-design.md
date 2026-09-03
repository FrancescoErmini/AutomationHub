# Ticket Management Page

## Overview

Ticket data entry today only happens through SQLAdmin, which is awkward for the
one workflow that matters: a manager sweeping the ticket backlog to enrich and
correct rows — set an end date, pick a root cause, fix the process, jot a short
note. SQLAdmin makes you open one record at a time on a separate form, with no
view of "what still needs attention".

This adds a dedicated **Tickets** page to the frontend with row-level inline
editing of every raw ticket field, plus a default view that surfaces exactly the
rows a manager cares about (touched in the last 14 days + everything still open)
and a search box for finding any other ticket by id, requestor, process, or note
text.

It mirrors the existing **Process Economics** page/API pattern (row edit →
inputs → Save/Cancel, React Query, FastAPI service with full-replace `PATCH`).

## Decisions Made

- **Editing only** — no create, no delete. Tickets already exist in the DB; this
  page enriches/corrects them. An "Add ticket" row is a cheap follow-up if
  needed later (same pattern), explicitly out of scope now.
- **All fields editable, including `ticket_id`** (the unique business key).
  `created_at` stays read-only.
- **Row edit + expand** UX (not cell-level autosave, not a batch grid). One row
  editable at a time; the editing row expands so the note gets a full-width
  textarea.
- **Server-side filtering.** The backend applies the date buckets and the search;
  the page never loads the whole table.
- **No auth gate** on the write endpoint — consistent with the current
  (temporary) state of the Process Economics write endpoints. Same TODO comment
  to restore a role gate later.
- **Full-replace `PATCH`** — the frontend always submits the whole editable field
  set, matching `ProcessEconomicsUpdate`.

## Data Model (existing, unchanged)

`core.ticket` (`backend/app/models/core.py:162`):

| column | type | nullable | editable | notes |
|---|---|---|---|---|
| `id` | int PK | no | no | internal id, used in the PATCH URL |
| `ticket_id` | str(60) | no | **yes** | unique business key → 409 on collision |
| `ticket_type` | str(60) | no | **yes** | free text; dropdown of distinct values |
| `priority_id` | FK priority | yes | **yes** | `priority.value` label |
| `process_id` | FK process | yes | **yes** | `process.canonical_name` label; large list |
| `requestor` | str(200) | yes | **yes** | |
| `start_date` | date | yes | **yes** | |
| `end_date` | date | yes | **yes** | presence = "closed" |
| `root_cause_id` | FK root_cause | yes | **yes** | `root_cause.name` label |
| `is_1l` | bool | no | **yes** | 1L / 2L select |
| `support_level_id` | FK support_level | yes | **yes** | `support_level.code` label |
| `company_id` | FK company | yes | **yes** | `company.name` label |
| `ams_year_id` | FK ams_year | yes | **yes** | `ams_year.code` label |
| `note` | text | yes | **yes** | full-width textarea in edit mode |
| `created_at` | datetime | no | no | display only |

No migration. No model change.

## Backend

New files under `backend/app/`:

- `schemas/ticket.py`
- `services/tickets.py`
- `api/v1/tickets.py`

Edits:

- `dependencies.py` — add `get_ticket_service` / `TicketServiceDependency`
  (takes `DbSession`, like `get_process_economics_service`).
- `api/v1/router.py` — `router.include_router(tickets.router)`.

### Schemas (`schemas/ticket.py`)

```python
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
    is_open: bool          # end_date is None — convenience for the badge

class TicketUpdate(BaseModel):
    """Full replace of the editable fields."""
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

Empty strings from the client are normalised to `None` for nullable text
(`requestor`, `note`) in a validator, matching the Process Economics page's
`form.note.trim() === '' ? null` behaviour but enforced server-side too.

### Service (`services/tickets.py`)

`TicketService(session)`:

- `list_tickets(*, scope: str, q: str | None, limit: int) -> list[dict]`
  - Base query: `select(Ticket)` with `joinedload` / explicit joins to the six
    reference tables for labels (left joins — FKs are nullable).
  - `q` (non-empty): `WHERE ticket_id ILIKE :p OR requestor ILIKE :p OR
    process.canonical_name ILIKE :p OR note ILIKE :p` with `:p = f"%{q}%"`.
    When `q` is present the date filter is **not** applied (search spans the
    whole table); `scope` is ignored.
  - `q` empty + `scope="default"`: `WHERE end_date IS NULL OR start_date >=
    :cutoff OR end_date >= :cutoff`, `cutoff = date.today() - timedelta(days=14)`.
  - `q` empty + `scope="all"`: no filter.
  - Order: `ORDER BY (end_date IS NOT NULL), start_date DESC NULLS LAST, id DESC`
    — open tickets first, newest first within each group.
  - `LIMIT :limit`.
  - `_serialize(ticket)` flattens to the `TicketRead` shape.
- `get_options() -> dict` — one query per reference table ordered by label,
  plus `select(distinct(Ticket.ticket_type)).order_by(...)` for `ticket_types`.
- `update(ticket_id: int, payload: TicketUpdate) -> dict`
  - `ticket = session.get(Ticket, ticket_id)`; `None` → `NotFoundError`.
  - For each non-null FK id in the payload, verify the referenced row exists
    (`session.get(Priority, ...)` etc.); missing → `NotFoundError`
    (`"Priority 999 not found"`).
  - Assign all editable fields, `session.commit()`.
  - On `IntegrityError` (duplicate `ticket_id`): `session.rollback()` then
    `raise DuplicateItemError(f"Ticket id '{payload.ticket_id}' already exists")`.
  - `session.refresh(ticket)`, return `_serialize(ticket)`.

### Router (`api/v1/tickets.py`)

```python
router = APIRouter(prefix="/tickets", tags=["tickets"])

@router.get("", response_model=list[TicketRead])
def list_tickets(
    service: TicketServiceDependency,
    scope: Literal["default", "all"] = "default",
    q: str | None = None,
    limit: int = Query(default=500, ge=1, le=5000),
): ...

@router.get("/options", response_model=TicketOptions)
def ticket_options(service: TicketServiceDependency): ...

# TODO: temporary — restore a role gate (add `_user: RequireEditor`) once the
# auth model is finalised, matching process_economics.
@router.patch("/{ticket_id}", response_model=TicketRead)
def update_ticket(
    ticket_id: int, payload: TicketUpdate, service: TicketServiceDependency,
): ...
```

Error shapes already handled globally by `handle_app_error` in `main.py`
(`{"error": {"code", "message"}}`), which `parseResponse` on the frontend
already understands.

## Frontend

Stack in place: React 18, react-router 7, `@tanstack/react-query`, Tailwind,
`ui/` primitives, `AsyncSection`, `getJson`/`apiFetch`/`parseResponse`.

### New files

- `src/api/tickets.ts`
- `src/pages/TicketsPage.tsx`
- `src/components/tickets/TicketRow.tsx`

### Edits

- `src/App.tsx` — `<Route path="tickets" element={<TicketsPage />} />` inside the
  `<Layout />` group (no `RequireAuth`, matching `process-economics`).
- `src/components/Layout.tsx` — `<NavLink to="/tickets">Tickets</NavLink>` in the
  main nav (placed after "Operations").

### `src/api/tickets.ts`

```ts
export interface TicketRow { /* mirrors TicketRead */ }
export interface TicketRefOption { id: number; label: string }
export interface TicketOptions {
  priorities: TicketRefOption[]; processes: TicketRefOption[]
  root_causes: TicketRefOption[]; support_levels: TicketRefOption[]
  companies: TicketRefOption[]; ams_years: TicketRefOption[]
  ticket_types: string[]
}
export interface TicketUpdate { /* mirrors TicketUpdate; dates as 'YYYY-MM-DD' | null */ }

export function fetchTickets(p: { scope: 'default' | 'all'; q: string }): Promise<TicketRow[]>
  // getJson('/api/v1/tickets', { scope, q: q || undefined })
export function fetchTicketOptions(): Promise<TicketOptions>
  // getJson('/api/v1/tickets/options')
export function updateTicket(id: number, payload: TicketUpdate): Promise<TicketRow>
  // apiFetch PATCH + parseResponse, same shape as updateProcessEconomics
```

### `src/pages/TicketsPage.tsx`

- `PageHeader` — title "Tickets", subtitle explaining the default view.
- Controls row:
  - `<input type="search">` bound to `search` state, **debounced ~300ms** into
    `debouncedSearch`.
  - Scope toggle: two buttons **"Recent & open"** / **"All tickets"** →
    `scope` state. Disabled/ignored visual hint while a search term is active
    (search always spans all).
- `useQuery({ queryKey: ['tickets', scope, debouncedSearch], queryFn: () =>
  fetchTickets({ scope, q: debouncedSearch }) })`.
- `useQuery({ queryKey: ['tickets', 'options'], queryFn: fetchTicketOptions,
  staleTime: 5 * 60_000 })`.
- `AsyncSection` wraps the table. Table columns: Ticket ID · Type · Priority ·
  Process · Requestor · Start · End · Status · Root cause · L1/L2 · Support ·
  Company · AMS yr · Note · (actions). Horizontal scroll container
  (`overflow-x-auto`, `min-w-[...]`) like Process Economics.
- Empty states: no rows + no search → "No recent or open tickets."; no rows +
  search → "No ticket matches your search."
- A single shared `<datalist id="ticket-processes">` rendered once from
  `options.processes`, referenced by every row's process input.
- Row count hint under the controls: "Showing N tickets (server-limited to 500)".

### `src/components/tickets/TicketRow.tsx`

- Props: `row: TicketRow`, `options: TicketOptions`.
- Display mode: one `<tr>`; `is_open` → `StatusBadge` "Open" / else "Closed";
  FK columns show the `*_name` / `*_value` label or `—`; `Edit` button.
- Edit mode: the row becomes **two `<tr>`s**:
  1. Every scalar/select input in its column cell:
     - `ticket_id`, `requestor` → `<input type="text">`
     - `ticket_type` → `<select>` from `options.ticket_types` (plus current value
       if not in list)
     - `priority_id`, `root_cause_id`, `support_level_id`, `company_id`,
       `ams_year_id` → `<select>` with a leading `"—"` (null) option
     - `process_id` → `<input list="ticket-processes">`; on change, resolve the
       typed label back to an id from `options.processes` (unmatched → keep
       previous id, show a subtle "no match" hint; empty → null)
     - `start_date`, `end_date` → `<input type="date">`
     - `is_1l` → `<select>` 1L / 2L
  2. A full-width cell (`colSpan`) containing a labelled `<textarea>` for `note`
     (~4 rows, `resize-y`) and right-aligned **Cancel** / **Save** buttons.
- Local `form` state initialised from the row; `Esc` → cancel, `Enter` on any
  non-textarea input → save.
- `useMutation({ mutationFn: (p) => updateTicket(row.id, p), onSuccess: () => {
  queryClient.invalidateQueries({ queryKey: ['tickets'] }); setEditing(false) }})`.
- Save button disabled unless `ticket_id` and `ticket_type` are non-empty, or
  while pending. On error, an inline error `<tr>` below (reuse the Process
  Economics markup: `colSpan`, `role="alert"`, `text-negative`).
- **Dirty guard:** editing is coordinated by the parent — `TicketsPage` holds
  `editingId`. Clicking `Edit` on another row while the current one has unsaved
  changes triggers `window.confirm("Discard unsaved changes to this ticket?")`.

## Out of Scope

- Creating and deleting tickets.
- Bulk edit / multi-row selection.
- Pagination UI (server `limit` guard only; revisit if the default view ever
  exceeds it).
- Optimistic updates / conflict detection (matches Process Economics — last
  write wins).
- Auth/role gating (deferred with the rest of the codebase).
- Any change to the reference tables or to how tickets are ingested.

## Testing

Manual — the repo has no test frameworks or CI by design (see `memory`).
Checklist for implementation completion:

- `cd backend && ruff check . && ruff format --check .` clean; app imports / boots.
- `cd frontend && npm run build && npm run lint` clean.
- `GET /api/v1/tickets` — default scope returns open + last-14-day rows only;
  `?scope=all` returns more; `?q=<substring>` matches across id/requestor/
  process/note and ignores the date filter.
- `GET /api/v1/tickets/options` — every list populated, `ticket_types` distinct.
- `PATCH /api/v1/tickets/{id}` — edit each field type and confirm persistence;
  set/clear an `end_date` and see the row move between Open/Closed;
  changing `ticket_id` to an existing one returns 409 with a readable message;
  a bad FK id returns 404.
- Page click-through: default view, toggle to All, search, edit a row (note
  textarea usable, other rows stay put), Save, Cancel, `Esc`, `Enter`-to-save,
  dirty-guard confirm when switching rows, error row on a duplicate id.
- Nav link appears and routes correctly.
