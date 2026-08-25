# Executive Process ROI Table Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace `RoiPage`'s three overlapping tables (quick wins, process ROI summary, company ROI summary) with a single per-process ROI table embedded in the merged Executive page, using each process's own `roi_expected_yr` instead of fixed 1.5x/3x/5x multipliers, adding go-live date and cumulative-saving-since-go-live, coloring ROI red/green, and deleting `RoiPage`/`roi.py` entirely.

**Architecture:** A new `ExecutiveService.process_roi_table()` method (built on an extended `AnalyticsRepository.process_economics_rows()` that now also returns `go_live_date` and `roi_expected_yr`) replaces `RoiService.process_summary()`/`quick_wins()`/`company_summary()`. "Expected ROI" reuses the existing `_roi_pct(annual_saving, multiplier, investment)` shape from `roi.py`, but with `roi_expected_yr` as the multiplier instead of a hardcoded 1.5/3/5. "Actual ROI" applies the same formula with `cumulative_saving_since_go_live_eur` (annual saving prorated by whole months elapsed since go-live, as of a testable `as_of` date) as the numerator base and a multiplier of `1`. A single `ProcessRoiTable` React component (sortable, filterable, no per-year columns — see design note below) replaces `RoiPage`'s three `DataTable`s.

**Tech Stack:** Same as the companion plan — FastAPI/SQLAlchemy backend, React/TanStack Query/Recharts-free (plain HTML table) frontend, pytest integration tests, Vitest/RTL frontend tests.

**Spec:** `.claude/specs/feature-02-executive-page-refactoring.md` (per-process table section — lines 18-38)

**Depends on:** `docs/superpowers/plans/2026-08-25-executive-header-trends.md` must be complete and merged first — this plan's Task 5 assumes the merged `ExecutivePage.tsx` from that plan already exists (it inserts the table into that page rather than creating a new one).

## Global Constraints

- **ORM/DB only** — same as the companion plan; no runtime reads from `app.ingestion`/Excel. Test fixtures may still use `run_rpa_ingestion` to seed the scratch test DB.
- **No fixed ROI multiplier.** "Expected ROI" must read `ProcessEconomics.roi_expected_yr` per row — never hardcode 1.5/3/5. A process with `roi_expected_yr IS NULL` reports Expected ROI as unavailable (not a fabricated default horizon).
- **Time-dependent calculations must be testable.** Any calculation using "today" (cumulative saving since go-live, actual ROI) takes an `as_of: date | None = None` parameter defaulting to `date.today()`, mirroring the existing `SimpleOpsService.sla_kpis(year, *, as_of=None)` convention — never call `date.today()` directly inside a formula that a test needs to pin.
- **Status color is never the only signal.** Per the dataviz skill's accessibility rule, the red/green ROI coloring must pair color with a text/icon cue (▲/▼ or a word), never rely on hue alone. Use the dataviz skill's fixed status hexes — good `#0ca30c`, critical `#d03b3b` — not the categorical palette (categorical colors are reserved for chart series identity, not status).
- **One table only.** No separate "quick wins" or "company summary" table ships alongside this one. Sorting the single table by Actual ROI descending (the default) already surfaces the best performers first, which is what "quick wins" was for.

## Design Decision: no per-year ROI columns in the table

The spec explicitly asks: *"I have no idea how to present a ROI table for RPA Processes ... tell me best option ... does it make sense to have years 2025, 2026 with partial negative or positive ROI."*

Decision: **no.** A column-per-year layout (Process | 2024 ROI | 2025 ROI | 2026 ROI | 2027 ROI | ...) grows one column per year forever and stops being CIO-scannable within 2-3 years; it also duplicates data the portfolio-level payback chart (companion plan, Task 4/7) already shows at the right altitude — that chart is *for* "how did this evolve over time," this table is *for* "where does each process stand today." The table instead carries exactly two ROI figures per process, both "as of now": **Expected ROI** (the committed business-case return at the process's own `roi_expected_yr` horizon) and **Actual ROI** (the realized return so far, from real elapsed months since go-live). Comparing the two tells the CIO whether a process is ahead of, on, or behind its committed case — the per-year trajectory question is answered by the portfolio chart, not by 15 extra table columns. State this reasoning to the user in the PR/summary, not just in this file.

---

### Task 1: Extend `process_economics_rows()` with go-live date and expected ROI horizon

**Files:**
- Modify: `backend/app/repositories/analytics.py`
- Modify: `backend/tests/integration/test_analytics_repository.py` (created by the companion plan's Task 1 — add to it)

**Interfaces:**
- Produces: `AnalyticsRepository.process_roi_rows() -> list[tuple[str, str | None, Decimal, Decimal, date | None, int | None]]` — `(process_name, company_name, capex_eur, fte_hours_month_actual, go_live_date, roi_expected_yr)`. This **replaces** `process_economics_rows()` (Step 3 removes the old method and updates its one caller).

- [ ] **Step 1: Write the failing test**

```python
def test_process_roi_rows_includes_go_live_date_and_roi_expected_yr(
    repo: AnalyticsRepository,
) -> None:
    rows = {row[0]: row for row in repo.process_roi_rows()}

    alpha = rows["RPA - Test Alpha"]
    assert alpha[1] == "Menarini"  # company_name
    assert alpha[2] == pytest.approx(Decimal("12500.00"))  # capex_eur
    assert alpha[4] == date(2021, 6, 1)  # go_live_date
    assert alpha[5] == 5  # roi_expected_yr

    beta = rows["RPA - Test Beta"]
    assert beta[4] == date(2021, 9, 3)
    assert beta[5] == 5
```

Add `from datetime import date` to the test file's imports if not already present.

- [ ] **Step 2: Run test to verify it fails**

Run: `cd backend && pytest tests/integration/test_analytics_repository.py -v -k process_roi_rows`
Expected: FAIL — `AttributeError: 'AnalyticsRepository' object has no attribute 'process_roi_rows'`

- [ ] **Step 3: Rename/extend the method**

Replace `process_economics_rows` in `backend/app/repositories/analytics.py` (lines 317-330):

```python
    def process_roi_rows(
        self,
    ) -> list[tuple[str, str | None, Decimal, Decimal, date | None, int | None]]:
        """(process_name, company_name, capex_eur, fte_hours_month_actual,
        go_live_date, roi_expected_yr) per process with an ECONOMICS row."""
        stmt = (
            select(
                Process.canonical_name,
                Company.name,
                ProcessEconomics.capex_eur,
                ProcessEconomics.fte_hours_month_actual,
                Process.go_live_date,
                ProcessEconomics.roi_expected_yr,
            )
            .join(Process, Process.id == ProcessEconomics.process_id)
            .outerjoin(Company, Company.id == Process.company_id)
            .order_by(Process.canonical_name)
        )
        return list(self._session.execute(stmt).tuples().all())
```

- [ ] **Step 4: Update the one existing caller**

`backend/app/services/roi.py`'s `process_summary()` (line 122) calls `self._repo.process_economics_rows()`. Since `RoiService` is deleted in Task 4 of this plan, leave `roi.py` calling the old method name for now and instead **keep both names working for this task**: add `process_roi_rows` as shown above without deleting `process_economics_rows` yet. Task 4 deletes `roi.py` (and with it, the last caller of `process_economics_rows`) — delete `process_economics_rows` in that same task, not here, so this task's diff doesn't break the not-yet-removed `RoiService`.

- [ ] **Step 5: Run tests to verify they pass**

Run: `cd backend && pytest tests/integration/test_analytics_repository.py -v -m integration`
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add backend/app/repositories/analytics.py backend/tests/integration/test_analytics_repository.py
git commit -m "feat: add process_roi_rows repository method with go-live date and roi_expected_yr"
```

---

### Task 2: `ExecutiveService.process_roi_table()`

**Files:**
- Modify: `backend/app/services/executive.py`
- Modify: `backend/tests/integration/test_executive_service.py`

**Interfaces:**
- Produces: `ExecutiveService.process_roi_table(*, company: str | None = None, as_of: date | None = None) -> list[dict]`, each row:
```python
{
    "process": str,
    "company": str | None,
    "go_live_date": date | None,
    "capex_eur": float,
    "annual_saving_eur": float,
    "payback_months": float | None,
    "cumulative_saving_since_go_live_eur": float,
    "expected_roi_pct": float | None,
    "actual_roi_pct": float | None,
}
```
  Sorted by `actual_roi_pct` descending, with `None` values (not yet live) sorted last.

- [ ] **Step 1: Write the failing test**

```python
from datetime import date


def test_process_roi_table_computes_expected_and_actual_roi(service: ExecutiveService) -> None:
    rows = {row["process"]: row for row in service.process_roi_table(as_of=date(2026, 6, 1))}

    alpha = rows["RPA - Test Alpha"]
    # go-live 2021-06-01 -> as_of 2026-06-01 is exactly 60 whole months.
    assert alpha["go_live_date"] == date(2021, 6, 1)
    assert alpha["capex_eur"] == pytest.approx(12500.00)
    assert alpha["annual_saving_eur"] == pytest.approx(12768.00)
    expected_cumulative = 12768.00 / 12 * 60
    assert alpha["cumulative_saving_since_go_live_eur"] == pytest.approx(expected_cumulative, rel=1e-3)
    expected_actual_roi = (expected_cumulative - 12500.00) / 12500.00 * 100
    assert alpha["actual_roi_pct"] == pytest.approx(expected_actual_roi, rel=1e-3)
    expected_roi = (12768.00 * 5 - 12500.00) / 12500.00 * 100  # roi_expected_yr = 5
    assert alpha["expected_roi_pct"] == pytest.approx(expected_roi, rel=1e-3)
    assert alpha["payback_months"] == pytest.approx(12500.00 / (12768.00 / 12), rel=1e-3)


def test_process_roi_table_orders_best_actual_roi_first(service: ExecutiveService) -> None:
    rows = service.process_roi_table(as_of=date(2026, 6, 1))
    scored = [row["actual_roi_pct"] for row in rows if row["actual_roi_pct"] is not None]

    assert scored == sorted(scored, reverse=True)


def test_process_roi_table_reports_a_process_not_yet_live(service: ExecutiveService) -> None:
    # Gamma is "In development" in the fixture: an ECONOMICS row would be
    # required for it to appear at all -- it has none, so it's correctly
    # absent. This test instead verifies the *shape* holds for a process with
    # a go_live_date in the future relative to as_of, if one exists in the
    # fixture; since the fixture has none, assert the general invariant: no
    # row's cumulative saving is ever negative.
    rows = service.process_roi_table(as_of=date(2020, 1, 1))  # before any go-live

    for row in rows:
        assert row["cumulative_saving_since_go_live_eur"] >= 0
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd backend && pytest tests/integration/test_executive_service.py -v -k process_roi_table`
Expected: FAIL — `AttributeError: 'ExecutiveService' object has no attribute 'process_roi_table'`

- [ ] **Step 3: Implement `process_roi_table()`**

Add to `backend/app/services/executive.py`. First add the two small pure helpers used by `roi.py` today (this file needs its own copies since `roi.py` is deleted in Task 4 — do not import from `roi.py`):

```python
def _payback_months(investment: Decimal, annual_saving: Decimal) -> float | None:
    if annual_saving <= 0:
        return None
    return float(
        (investment / (annual_saving / 12)).quantize(Decimal("0.001"), rounding=ROUND_HALF_UP)
    )


def _roi_pct(annual_saving: Decimal, multiplier: Decimal, investment: Decimal) -> float | None:
    if investment <= 0:
        return None
    return _round_pct((annual_saving * multiplier - investment) / investment)


def _months_elapsed(start: "date", as_of: "date") -> int:
    if as_of < start:
        return 0
    months = (as_of.year - start.year) * 12 + (as_of.month - start.month)
    if as_of.day < start.day:
        months -= 1
    return max(months, 0)
```

Add `from datetime import date` to the module's imports.

```python
    def process_roi_table(
        self, *, company: str | None = None, as_of: date | None = None
    ) -> list[dict[str, Any]]:
        as_of = as_of or date.today()
        bc_saving = self._repo.reference_variable("cost_per_hour_FTE") or Decimal("0")

        rows = []
        for (
            process_name,
            company_name,
            capex,
            fte_hours_month,
            go_live_date,
            roi_expected_yr,
        ) in self._repo.process_roi_rows():
            if company is not None and company_name != company:
                continue
            annual_saving = bc_saving * fte_hours_month * 12
            months_live = _months_elapsed(go_live_date, as_of) if go_live_date else 0
            cumulative_saving = (annual_saving / 12) * months_live

            expected_roi_pct = (
                _roi_pct(annual_saving, Decimal(roi_expected_yr), capex)
                if roi_expected_yr is not None
                else None
            )
            actual_roi_pct = _roi_pct(cumulative_saving, Decimal("1"), capex)

            rows.append(
                {
                    "process": process_name,
                    "company": company_name,
                    "go_live_date": go_live_date,
                    "capex_eur": _round_money(capex),
                    "annual_saving_eur": _round_money(annual_saving),
                    "payback_months": _payback_months(capex, annual_saving),
                    "cumulative_saving_since_go_live_eur": _round_money(cumulative_saving),
                    "expected_roi_pct": expected_roi_pct,
                    "actual_roi_pct": actual_roi_pct,
                }
            )

        rows.sort(
            key=lambda row: (row["actual_roi_pct"] is None, -(row["actual_roi_pct"] or 0))
        )
        return rows
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd backend && pytest tests/integration/test_executive_service.py -v -m integration`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add backend/app/services/executive.py backend/tests/integration/test_executive_service.py
git commit -m "feat: add ExecutiveService.process_roi_table with per-process expected/actual ROI"
```

---

### Task 3: `GET /api/v1/executive/processes`

**Files:**
- Modify: `backend/app/api/v1/executive.py`
- Modify: `backend/app/schemas/analytics.py`
- Modify: `backend/tests/integration/test_executive_api.py` (created by the companion plan's Task 3 — add to it)

**Interfaces:**
- Produces: `ProcessRoiRow` schema matching the service dict shape from Task 2 (with `go_live_date: date | None`).
- Produces: route `GET /api/v1/executive/processes?company=` `-> list[ProcessRoiRow]`. `as_of` is deliberately **not** a query parameter — it is a service-internal testability hook only; the route always uses "today."

- [ ] **Step 1: Write the failing test**

```python
def test_processes_endpoint_returns_process_roi_rows(
    client: TestClient, db_session: Session
) -> None:
    run_rpa_ingestion(db_session, FIXTURE)

    response = client.get("/api/v1/executive/processes")

    assert response.status_code == 200
    body = response.json()
    assert len(body) == 2  # Alpha and Beta -- the only ECONOMICS rows in the fixture
    row = body[0]
    assert set(row) == {
        "process",
        "company",
        "go_live_date",
        "capex_eur",
        "annual_saving_eur",
        "payback_months",
        "cumulative_saving_since_go_live_eur",
        "expected_roi_pct",
        "actual_roi_pct",
    }


def test_processes_endpoint_respects_the_company_filter(
    client: TestClient, db_session: Session
) -> None:
    run_rpa_ingestion(db_session, FIXTURE)

    response = client.get("/api/v1/executive/processes", params={"company": "Menarini"})

    assert response.status_code == 200
    body = response.json()
    assert len(body) == 1
    assert body[0]["process"] == "RPA - Test Alpha"
    assert body[0]["company"] == "Menarini"
```

(`FIXTURE`, `run_rpa_ingestion`, `TestClient`, `Session` imports already exist at the top of `backend/tests/integration/test_executive_api.py` from the companion plan's Task 3 — reuse them, don't re-import.)

- [ ] **Step 2: Run test to verify it fails**

Run: `cd backend && pytest tests/integration/test_executive_api.py -v -k processes`
Expected: FAIL — 404.

- [ ] **Step 3: Add schema and route**

```python
# schemas/analytics.py
from datetime import date


class ProcessRoiRow(BaseModel):
    process: str
    company: str | None
    go_live_date: date | None
    capex_eur: float
    annual_saving_eur: float
    payback_months: float | None
    cumulative_saving_since_go_live_eur: float
    expected_roi_pct: float | None
    actual_roi_pct: float | None
```

```python
# api/v1/executive.py
from app.schemas.analytics import ProcessRoiRow  # add to existing import line

@router.get("/processes", response_model=list[ProcessRoiRow])
def get_processes(
    service: ExecutiveServiceDependency, company: str | None = Query(default=None)
) -> list[ProcessRoiRow]:
    return [ProcessRoiRow(**row) for row in service.process_roi_table(company=company)]
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd backend && pytest tests/integration/test_executive_api.py -v -m integration`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add backend/app/api/v1/executive.py backend/app/schemas/analytics.py backend/tests/integration/test_executive_api.py
git commit -m "feat: add GET /api/v1/executive/processes"
```

---

### Task 4: Delete `RoiService`, `roi.py` router, and dead repository code

**Files:**
- Delete: `backend/app/services/roi.py`
- Delete: `backend/app/api/v1/roi.py`
- Delete: `backend/tests/integration/test_roi_service.py`
- Modify: `backend/app/api/v1/router.py`
- Modify: `backend/app/dependencies.py`
- Modify: `backend/app/repositories/analytics.py` (remove `process_economics_rows`, now unused)
- Modify: `backend/app/schemas/analytics.py` (remove `RoiProcessRow`, `RoiCompanyRow` if nothing else references them — check first)

- [ ] **Step 1: Confirm nothing else references the code being deleted**

```bash
grep -rn "RoiService\|RoiServiceDependency\|process_economics_rows\|RoiProcessRow\|RoiCompanyRow\|roi\.router\|from app.services.roi\|from app.api.v1 import.*roi\b" backend/app backend/tests
```

Expected: only hits inside the files this task deletes/modifies. If `RoiProcessRow`/`RoiCompanyRow` show up elsewhere, keep those two schema classes; otherwise delete them from `backend/app/schemas/analytics.py`.

- [ ] **Step 2: Delete the files**

```bash
git rm backend/app/services/roi.py backend/app/api/v1/roi.py backend/tests/integration/test_roi_service.py
```

- [ ] **Step 3: Remove `roi` from the router registration**

In `backend/app/api/v1/router.py`, remove `roi` from the import list (line 3-14) and remove `router.include_router(roi.router)` (line 22).

- [ ] **Step 4: Remove `RoiService` wiring from `dependencies.py`**

Remove the `from app.services.roi import RoiService` import, the `get_roi_service` function, and the `RoiServiceDependency` type alias from `backend/app/dependencies.py`.

- [ ] **Step 5: Remove `process_economics_rows` from the repository**

Delete the method from `backend/app/repositories/analytics.py` (its only caller, `RoiService.process_summary`, no longer exists).

- [ ] **Step 6: Run the full backend test suite**

Run: `cd backend && pytest -m integration`
Expected: PASS, no import errors, no reference to deleted modules.

- [ ] **Step 7: Commit**

```bash
git add -A backend/app
git commit -m "refactor: delete RoiService and /api/v1/roi now that Executive covers process ROI"
```

---

### Task 5: `ProcessRoiTable` frontend component

**Files:**
- Create: `frontend/src/components/ProcessRoiTable.tsx`
- Test: `frontend/src/components/ProcessRoiTable.test.tsx`

**Interfaces:**
- Consumes: `ProcessRoiRow[]` (Task 6's TS type).
- Produces: `ProcessRoiTable({ rows })` — a self-contained component owning its own sort/filter UI state (no external state needed; the page just passes the full row list once).

- [ ] **Step 1: Write the failing test**

```typescript
// frontend/src/components/ProcessRoiTable.test.tsx
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'

import { ProcessRoiTable } from './ProcessRoiTable'
import type { ProcessRoiRow } from '../api/executive'

const ROWS: ProcessRoiRow[] = [
  {
    process: 'RPA - Bad Process',
    company: 'Menarini',
    go_live_date: '2022-01-01',
    capex_eur: 10000,
    annual_saving_eur: 500,
    payback_months: 240,
    cumulative_saving_since_go_live_eur: 2000,
    expected_roi_pct: -50,
    actual_roi_pct: -80,
  },
  {
    process: 'RPA - Good Process',
    company: 'Codifi',
    go_live_date: '2020-01-01',
    capex_eur: 5000,
    annual_saving_eur: 8000,
    payback_months: 7.5,
    cumulative_saving_since_go_live_eur: 48000,
    expected_roi_pct: 300,
    actual_roi_pct: 860,
  },
]

describe('ProcessRoiTable', () => {
  it('does not render a company column', () => {
    render(<ProcessRoiTable rows={ROWS} />)

    expect(screen.queryByRole('columnheader', { name: 'Company' })).not.toBeInTheDocument()
  })

  it('sorts by actual ROI descending by default, best process first', () => {
    render(<ProcessRoiTable rows={ROWS} />)

    const dataRows = screen.getAllByRole('row').slice(1) // drop header row
    expect(within(dataRows[0]).getByText('RPA - Good Process')).toBeInTheDocument()
    expect(within(dataRows[1]).getByText('RPA - Bad Process')).toBeInTheDocument()
  })

  it('colors a negative actual ROI distinctly from a positive one, with a text cue', async () => {
    render(<ProcessRoiTable rows={ROWS} />)

    expect(screen.getByText('▲ +860.0%')).toBeInTheDocument()
    expect(screen.getByText('▼ -80.0%')).toBeInTheDocument()
  })

  it('filters to only negative-ROI processes when the status filter is applied', async () => {
    const user = userEvent.setup()
    render(<ProcessRoiTable rows={ROWS} />)

    await user.selectOptions(screen.getByLabelText('ROI status'), 'negative')

    expect(screen.queryByText('RPA - Good Process')).not.toBeInTheDocument()
    expect(screen.getByText('RPA - Bad Process')).toBeInTheDocument()
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd frontend && npx vitest run src/components/ProcessRoiTable.test.tsx`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement `ProcessRoiTable`**

```typescript
// frontend/src/components/ProcessRoiTable.tsx
import { useMemo, useState } from 'react'

import { formatValue } from '../api/metrics'
import type { ProcessRoiRow } from '../api/executive'

type SortKey = 'actual_roi_pct' | 'payback_months' | 'annual_saving_eur' | 'go_live_date'
type StatusFilter = 'all' | 'positive' | 'negative'

interface ProcessRoiTableProps {
  rows: ProcessRoiRow[]
}

function RoiCell({ pct }: { pct: number | null }) {
  if (pct === null) return <span className="text-slate-400">Not available</span>
  const positive = pct >= 0
  return (
    <span className={positive ? 'text-[#0ca30c]' : 'text-[#d03b3b]'}>
      {positive ? '▲' : '▼'} {positive ? '+' : ''}
      {pct.toFixed(1)}%
    </span>
  )
}

export function ProcessRoiTable({ rows }: ProcessRoiTableProps) {
  const [sortKey, setSortKey] = useState<SortKey>('actual_roi_pct')
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all')

  const visibleRows = useMemo(() => {
    let filtered = rows
    if (statusFilter === 'positive') {
      filtered = filtered.filter((row) => (row.actual_roi_pct ?? -Infinity) >= 0)
    } else if (statusFilter === 'negative') {
      filtered = filtered.filter((row) => (row.actual_roi_pct ?? Infinity) < 0)
    }

    return [...filtered].sort((a, b) => {
      if (sortKey === 'go_live_date') {
        return (b.go_live_date ?? '').localeCompare(a.go_live_date ?? '')
      }
      const av = a[sortKey]
      const bv = b[sortKey]
      if (av === null) return 1
      if (bv === null) return -1
      return (bv as number) - (av as number)
    })
  }, [rows, sortKey, statusFilter])

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-4">
        <label className="flex items-center gap-2 text-sm font-semibold text-slate-600">
          Sort by
          <select
            value={sortKey}
            onChange={(event) => setSortKey(event.target.value as SortKey)}
            className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm"
          >
            <option value="actual_roi_pct">Actual ROI</option>
            <option value="payback_months">Payback</option>
            <option value="annual_saving_eur">Annual saving</option>
            <option value="go_live_date">Go-live date</option>
          </select>
        </label>
        <label className="flex items-center gap-2 text-sm font-semibold text-slate-600">
          ROI status
          <select
            value={statusFilter}
            onChange={(event) => setStatusFilter(event.target.value as StatusFilter)}
            className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm"
          >
            <option value="all">All</option>
            <option value="positive">Positive</option>
            <option value="negative">Negative</option>
          </select>
        </label>
      </div>

      <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white shadow-sm">
        <table className="w-full text-sm">
          <caption className="sr-only">
            Per-process ROI: go-live date, CAPEX, annual saving, payback, expected vs. actual ROI
          </caption>
          <thead>
            <tr className="border-b border-slate-200 bg-slate-50 text-xs font-semibold uppercase tracking-wide text-slate-500">
              <th scope="col" className="px-4 py-3 text-left">
                Process
              </th>
              <th scope="col" className="px-4 py-3 text-left">
                Go-live
              </th>
              <th scope="col" className="px-4 py-3 text-right">
                CAPEX
              </th>
              <th scope="col" className="px-4 py-3 text-right">
                Annual saving
              </th>
              <th scope="col" className="px-4 py-3 text-right">
                Payback
              </th>
              <th scope="col" className="px-4 py-3 text-right">
                Cumulative saving since go-live
              </th>
              <th scope="col" className="px-4 py-3 text-right">
                Expected ROI
              </th>
              <th scope="col" className="px-4 py-3 text-right">
                Actual ROI
              </th>
            </tr>
          </thead>
          <tbody>
            {visibleRows.map((row) => (
              <tr key={row.process} className="border-b border-slate-100 last:border-0">
                <td className="px-4 py-3">{row.process}</td>
                <td className="px-4 py-3">{row.go_live_date ?? 'Not live'}</td>
                <td className="px-4 py-3 text-right tabular-nums">
                  {formatValue(row.capex_eur, 'eur')}
                </td>
                <td className="px-4 py-3 text-right tabular-nums">
                  {formatValue(row.annual_saving_eur, 'eur')}
                </td>
                <td className="px-4 py-3 text-right tabular-nums">
                  {row.payback_months === null
                    ? 'Not available'
                    : formatValue(row.payback_months, 'months')}
                </td>
                <td className="px-4 py-3 text-right tabular-nums">
                  {formatValue(row.cumulative_saving_since_go_live_eur, 'eur')}
                </td>
                <td className="px-4 py-3 text-right tabular-nums">
                  <RoiCell pct={row.expected_roi_pct} />
                </td>
                <td className="px-4 py-3 text-right tabular-nums">
                  <RoiCell pct={row.actual_roi_pct} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd frontend && npx vitest run src/components/ProcessRoiTable.test.tsx`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add frontend/src/components/ProcessRoiTable.tsx frontend/src/components/ProcessRoiTable.test.tsx
git commit -m "feat: add ProcessRoiTable component with sort/filter and expected-vs-actual ROI"
```

---

### Task 6: Wire the table into `ExecutivePage`, add `fetchExecutiveProcesses`, delete `RoiPage`

**Files:**
- Modify: `frontend/src/api/executive.ts`
- Modify: `frontend/src/pages/ExecutivePage.tsx`
- Modify: `frontend/src/pages/ExecutivePage.test.tsx`
- Delete: `frontend/src/pages/RoiPage.tsx`
- Delete: `frontend/src/pages/RoiPage.test.tsx`
- Delete: `frontend/src/api/roi.ts`
- Modify: `frontend/src/App.tsx`

**Interfaces:**
- Produces: `ProcessRoiRow` TS type, `fetchExecutiveProcesses(company?: string)` in `frontend/src/api/executive.ts`.

- [ ] **Step 1: Add the type and fetcher**

```typescript
// frontend/src/api/executive.ts
export interface ProcessRoiRow {
  process: string
  company: string | null
  go_live_date: string | null
  capex_eur: number
  annual_saving_eur: number
  payback_months: number | null
  cumulative_saving_since_go_live_eur: number
  expected_roi_pct: number | null
  actual_roi_pct: number | null
}

export async function fetchExecutiveProcesses(company?: string): Promise<ProcessRoiRow[]> {
  return getJson<ProcessRoiRow[]>('/api/v1/executive/processes', { company })
}
```

- [ ] **Step 2: Write the failing page test**

Add `'/api/v1/executive/processes': []` to the companion plan's `mockRoutes()` helper in `frontend/src/pages/ExecutivePage.test.tsx` (the page now queries it unconditionally, so every existing test's mock map needs the route or it 404s), then add:

```typescript
it('renders the single process ROI table, not the old quick-wins/company-summary tables', async () => {
  mockRoutes()
  renderWithQueryClient(<ExecutivePage />)

  expect(await screen.findByRole('heading', { name: 'Process ROI' })).toBeInTheDocument()
  expect(screen.queryByText('Quick wins (fastest payback)')).not.toBeInTheDocument()
  expect(screen.queryByText('Company ROI summary')).not.toBeInTheDocument()
})
```

- [ ] **Step 3: Run test to verify it fails**

Run: `cd frontend && npx vitest run src/pages/ExecutivePage.test.tsx`
Expected: FAIL — no "process roi" heading yet.

- [ ] **Step 4: Add the table section to `ExecutivePage.tsx`**

Add imports and a query, then a new section before the closing `</div>`:

```typescript
import { fetchExecutiveProcesses, /* existing imports */ } from '../api/executive'
import { ProcessRoiTable } from '../components/ProcessRoiTable'
```

```typescript
  const processes = useQuery({
    queryKey: ['executive', 'processes', company],
    queryFn: () => fetchExecutiveProcesses(company || undefined),
  })
```

```typescript
      <section aria-label="Process ROI">
        <h2 className="mb-4 font-semibold text-ink">Process ROI</h2>
        <AsyncSection
          isPending={processes.isPending}
          isError={processes.isError}
          error={processes.error}
          loadingLabel="Loading process ROI…"
        >
          <ProcessRoiTable rows={processes.data ?? []} />
        </AsyncSection>
      </section>
```

- [ ] **Step 5: Delete `RoiPage`, `roi.ts`, and the `/roi` route**

```bash
git rm frontend/src/pages/RoiPage.tsx frontend/src/pages/RoiPage.test.tsx frontend/src/api/roi.ts
```

In `frontend/src/App.tsx`, remove the `import { RoiPage } from './pages/RoiPage'` line and the `<Route path="roi" element={<RoiPage />} />` route.

- [ ] **Step 6: Check for a nav link to `/roi`**

```bash
grep -rn "'/roi'\|\"roi\"\|to=\"roi\"" frontend/src/components/Layout.tsx
```

If `Layout.tsx` has a nav entry pointing at `/roi`, remove it (the merged page lives at `/executive`, which already has its own nav entry).

- [ ] **Step 7: Run tests to verify they pass**

Run: `cd frontend && npx vitest run src/pages/ExecutivePage.test.tsx`
Expected: PASS

- [ ] **Step 8: Manually verify in the browser**

Run the dev servers (frontend + backend). Navigate to `/executive`. Confirm: the process table renders below the trend charts, defaults to best-ROI-first ordering, has no Company column, has working Sort-by and ROI-status filter controls, and Actual/Expected ROI cells show colored ▲/▼ text. Confirm `/roi` now 404s (or redirects, per the router's default) and no nav link points at it.

- [ ] **Step 9: Commit**

```bash
git add -A frontend/src
git commit -m "feat: merge process ROI table into Executive page, delete RoiPage"
```

---

### Task 7: Full-suite verification

**Files:** none (verification only)

- [ ] **Step 1: Backend**

Run: `cd backend && pytest -m integration && ruff check . && mypy app`
Expected: all green.

- [ ] **Step 2: Frontend**

Run: `cd frontend && npx vitest run && npx tsc --noEmit && npx eslint src`
Expected: all green.

- [ ] **Step 3: Report to the user**

Summarize: both plans complete, `/roi` removed, single `/executive` page live, and restate the "no per-year ROI columns" design decision from this plan's header so the user can push back if they disagree.

---

## Self-Review Notes (for the plan author, already applied above)

- Spec coverage: go-live date (Task 1/2/5), cumulative saving since go-live (Task 2/5), `roi_expected_yr`-based Expected ROI (Task 2), Actual ROI (Task 2), CAPEX kept (Task 2/5), red/green coloring with non-color cue (Task 5), payback kept (Task 2/5), company column removed + top selector reused (Task 5/6, `CompanyFilter` already on the page from the companion plan), one table only + default good-first ordering + sort/filter controls (Task 5), `RoiPage` deletion (Task 4/6) — all covered. The "study and tell me the best option" ask is answered explicitly in the Design Decision section above.
- No placeholders: every step has real code, real test data, or a real shell command.
- Type consistency checked: `process_roi_table()` dict keys match `ProcessRoiRow` Pydantic schema fields match the TS `ProcessRoiRow` interface match `ProcessRoiTable`'s column accessors.
