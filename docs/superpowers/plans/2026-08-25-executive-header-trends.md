# Executive Header & Trend Charts Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the Executive page's fixed-multiplier ROI cards (ROI 1.5Y/3Y) and separate cost-breakdown bar chart with (a) a "how we spend vs. how we save" KPI header, (b) a year-by-component TCO decomposition chart, and (c) a cumulative-savings-vs-cumulative-spend payback chart — all sourced through the ORM, reusing `SimpleOpsService`'s already-built cost-trend logic instead of re-deriving it.

**Architecture:** `ExecutiveService` gains a `SimpleOpsService` collaborator (constructor injection, mirroring the existing `AnalyticsRepository` injection pattern) and calls its `license_cost_trend()`, `infrastructure()`, and `ams_trend()` methods to source the running-cost side of the TCO decomposition — no new running-cost math is written. `ExecutiveService` adds one new repository method (`capex_by_year`) for the capex side, which `SimpleOpsService` has no equivalent for (capex is a process/project cost, not a running cost). Two new endpoints (`/executive/tco-trend`, `/executive/savings-payback`) back two new chart components; `kpis()` is rewritten to a 6-card "spend vs. save" set. This plan does **not** touch `RoiPage`/`roi.py` — they stay live at `/roi` unchanged. The companion plan `2026-08-25-executive-process-roi-table.md` finishes the merge by moving the process table into this page and deleting `RoiPage`/`roi.py`.

**Tech Stack:** FastAPI + SQLAlchemy 2.0 (backend), React + TanStack Query + Recharts + Tailwind (frontend), pytest (`pytest.mark.integration`, real Postgres via `db_session` fixture), Vitest/RTL for frontend tests (mirror `ExecutivePage.test.tsx`'s existing setup).

**Spec:** `.claude/specs/feature-02-executive-page-refactoring.md` (header/trend sections — lines 1-17)

## Global Constraints

- **ORM/DB only.** No new code may read `app.ingestion`, `openpyxl`, or any `.xlsx`/`.csv` file at request time. `run_rpa_ingestion` may still be used in **tests** to seed the scratch Postgres test DB from `data/fixtures/rpa_sample.xlsx` — that is existing convention (see `test_executive_service.py`, `test_simple_ops_service.py`) for populating a throwaway database, not a runtime data source, and is not a violation of this constraint.
- **Reuse Simple Ops.** Any running-cost-by-year figure (license, infrastructure, AMS 1L, AMS 2L) must be sourced by calling `SimpleOpsService` methods, never by re-querying `AnalyticsRepository` for the same aggregation a second time.
- **No fixed ROI multipliers.** This plan does not introduce any new 1.5x/3x/5x-style hardcoded horizon — those are being removed, not added to. (The per-process `roi_expected_yr` work is in the companion plan.)
- **`tco-trend` covers real years only** — it must never fabricate or project a future year (unlike `SimpleOpsService.running_cost_trend()`, which deliberately adds one projected year). Every year in its output must correspond to an actual `AmsYear.year` row.
- **Dataviz palette.** Any new chart uses the repo's already-validated categorical palette (`frontend/src/components/TrendChart.tsx`'s comment cites the source): slot 1 blue `#2a78d6`, slot 2 orange `#eb6834`, slot 3 aqua `#1baf7a`, slot 4 yellow `#eda100`. Never invent a new hex. A ≥2-series chart always shows a legend.
- **Prerequisite data check.** Before Task 2, confirm `core.ams_1l_cost` has a row for every year in `core.ams_year` (the user is backfilling the 2027 AMS 1L cost row that was missing as of 2026-08-25). If any `AmsYear.year` still has no matching `Ams1LCost` row, `SimpleOpsService.license_cost_trend()`/`ams_trend()`/`infrastructure()` will silently omit that year (they derive their year list from `ams_1l_by_year()`) — the TCO chart will just show fewer years, not crash, but flag it to the user rather than silently shipping an incomplete chart.

---

### Task 0: Verify the AMS 2027 backfill landed

**Files:** none (verification only)

- [ ] **Step 1: Query `core.ams_year` and `core.ams_1l_cost` row counts**

```bash
psql "$DATABASE_URL" -c "select y.year, c.annual_fee_eur from core.ams_year y left join core.ams_1l_cost c on c.ams_year_id = y.id order by y.year;"
```

Expected: one row per `ams_year.year` (2024-2027) with a non-null `annual_fee_eur`. If any row has `annual_fee_eur` NULL, stop and tell the user before continuing — Task 2 onward assumes every AMS year has a cost row.

- [ ] **Step 2: Report result before proceeding to Task 1.**

---

### Task 1: `AnalyticsRepository.capex_by_year()` + company-aware cumulative saving

**Files:**
- Modify: `backend/app/repositories/analytics.py`
- Test: `backend/tests/integration/test_analytics_repository.py` (create — no repository-level test file exists yet; other repo methods are only exercised indirectly through service tests, but this plan adds a repo method with no service wrapper needed for its raw form, so it gets its own direct test)

**Interfaces:**
- Produces: `AnalyticsRepository.capex_by_year(*, company: str | None = None) -> dict[int, Decimal]` — capex summed by the calendar year of `Process.go_live_date`; a process with `go_live_date IS NULL` is excluded (it has no committed capex-recognition year).
- Produces: `AnalyticsRepository.annual_saving_contribution_by_month(*, company: str | None = None) -> list[tuple[str, Decimal]]` — same method, now accepting an optional company filter (existing callers in `executive.py` pass no argument, so this is backward compatible).

- [ ] **Step 1: Write the failing tests**

```python
# backend/tests/integration/test_analytics_repository.py
from pathlib import Path

import pytest
from sqlalchemy.orm import Session

from app.ingestion.rpa_pipeline import run_rpa_ingestion
from app.repositories.analytics import AnalyticsRepository

pytestmark = pytest.mark.integration

FIXTURE = Path(__file__).resolve().parents[3] / "data" / "fixtures" / "rpa_sample.xlsx"


@pytest.fixture
def repo(db_session: Session) -> AnalyticsRepository:
    run_rpa_ingestion(db_session, FIXTURE)
    return AnalyticsRepository(db_session)


def test_capex_by_year_buckets_by_process_go_live_year(repo: AnalyticsRepository) -> None:
    # Alpha (go-live 2021-06-01, capex 12500.00) and Beta (go-live 2021-09-03,
    # capex 8200.50) both fall in 2021; Gamma has no ECONOMICS row, Delta has
    # a go-live date but no ECONOMICS row either -- neither contributes capex.
    by_year = repo.capex_by_year()

    assert by_year == {2021: pytest.approx(20700.50)}


def test_capex_by_year_respects_the_company_filter(repo: AnalyticsRepository) -> None:
    menarini = repo.capex_by_year(company="Menarini")
    codifi = repo.capex_by_year(company="Codifi")

    assert menarini == {2021: pytest.approx(12500.00)}
    assert codifi == {2021: pytest.approx(8200.50)}


def test_annual_saving_contribution_by_month_respects_the_company_filter(
    repo: AnalyticsRepository,
) -> None:
    all_companies = repo.annual_saving_contribution_by_month()
    menarini_only = repo.annual_saving_contribution_by_month(company="Menarini")

    # pytest.approx can't subtract a float expected from a Decimal actual
    # directly (TypeError) -- cast to float first.
    assert float(sum((v for _, v in all_companies), Decimal("0"))) == pytest.approx(17715.60)
    assert float(sum((v for _, v in menarini_only), Decimal("0"))) == pytest.approx(26.60 * 40 * 12)
```

Add `from decimal import Decimal` to the test file's imports.

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd backend && pytest tests/integration/test_analytics_repository.py -v -m integration`
Expected: FAIL — `AttributeError: 'AnalyticsRepository' object has no attribute 'capex_by_year'`, and a `TypeError` on the company kwarg for the third test.

- [ ] **Step 3: Implement `capex_by_year`**

Add to `backend/app/repositories/analytics.py`, near `capex_eur` (after line 100):

```python
    def capex_by_year(self, *, company: str | None = None) -> dict[int, Decimal]:
        year = func.extract("year", Process.go_live_date)
        stmt = (
            select(year, func.coalesce(func.sum(ProcessEconomics.capex_eur), 0))
            .select_from(ProcessEconomics)
            .join(Process, Process.id == ProcessEconomics.process_id)
            .where(Process.go_live_date.is_not(None))
            .group_by(year)
        )
        if company is not None:
            stmt = stmt.join(Company, Company.id == Process.company_id).where(
                Company.name == company
            )
        rows = self._session.execute(stmt).tuples().all()
        return {int(yr): Decimal(total) for yr, total in rows}
```

- [ ] **Step 4: Add the company filter to `annual_saving_contribution_by_month`**

Replace the existing method (`backend/app/repositories/analytics.py:190-205`):

```python
    def annual_saving_contribution_by_month(
        self, *, company: str | None = None
    ) -> list[tuple[str, Decimal]]:
        """Per-process annual saving (bc_saving * fte_hours_month_actual * 12)
        bucketed by the process's go-live month, for a saving ramp-up trend."""
        bc_saving = self.reference_variable("cost_per_hour_FTE")
        if bc_saving is None:
            return []
        month = func.to_char(cast(Process.go_live_date, Date), "YYYY-MM")
        stmt = (
            select(month.label("month"), func.sum(ProcessEconomics.fte_hours_month_actual))
            .join(ProcessEconomics, ProcessEconomics.process_id == Process.id)
            .where(Process.go_live_date.is_not(None))
            .group_by(month)
            .order_by(month)
        )
        if company is not None:
            stmt = stmt.join(Company, Company.id == Process.company_id).where(
                Company.name == company
            )
        rows = self._session.execute(stmt).tuples().all()
        return [(month, bc_saving * Decimal(fte) * 12) for month, fte in rows]
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `cd backend && pytest tests/integration/test_analytics_repository.py -v -m integration`
Expected: PASS (3 tests)

- [ ] **Step 6: Commit**

```bash
git add backend/app/repositories/analytics.py backend/tests/integration/test_analytics_repository.py
git commit -m "feat: add capex_by_year and company-scoped saving contribution to AnalyticsRepository"
```

---

### Task 2: Inject `SimpleOpsService` into `ExecutiveService`, add `tco_trend()`

**Files:**
- Modify: `backend/app/services/executive.py`
- Modify: `backend/app/dependencies.py`
- Modify: `backend/tests/integration/test_executive_service.py`

**Interfaces:**
- Consumes: `SimpleOpsService.license_cost_trend() -> list[{"year": int, "cost_eur": float}]`, `SimpleOpsService.infrastructure() -> {"trend": list[{"year": int, "cost_eur": float}], ...}`, `SimpleOpsService.ams_trend() -> {"l1": list[{"year", "cost_eur", "process_count"}], "l2": list[{"year", "cost_eur", "ticket_count"}]}` (all `backend/app/services/simple_ops.py`).
- Produces: `ExecutiveService.tco_trend() -> list[dict]`, each `{"year": int, "capex_eur": float, "license_eur": float, "infrastructure_eur": float, "ams_eur": float, "total_eur": float}`, sorted by year ascending. `ams_eur` is AMS 1L + AMS 2L (actual, not flat-rate) combined for that year.

- [ ] **Step 1: Write the failing test**

```python
# backend/tests/integration/test_executive_service.py — add near the top-level tests
from sqlalchemy import update

from app.models.core import AmsYear
from app.services.simple_ops import SimpleOpsService


@pytest.fixture
def simple_ops(db_session: Session) -> SimpleOpsService:
    db_session.execute(update(AmsYear).where(AmsYear.ordinal == 1).values(year=2024))
    db_session.execute(update(AmsYear).where(AmsYear.ordinal == 2).values(year=2025))
    db_session.commit()
    return SimpleOpsService(AnalyticsRepository(db_session))


def test_tco_trend_composes_capex_with_simple_ops_running_cost_components(
    db_session: Session, simple_ops: SimpleOpsService
) -> None:
    service = ExecutiveService(AnalyticsRepository(db_session), simple_ops)

    trend = service.tco_trend()

    assert [row["year"] for row in trend] == [2024, 2025]
    license_by_year = {p["year"]: p["cost_eur"] for p in simple_ops.license_cost_trend()}
    infra_by_year = {p["year"]: p["cost_eur"] for p in simple_ops.infrastructure()["trend"]}
    ams = simple_ops.ams_trend()
    ams_1l_by_year = {p["year"]: p["cost_eur"] for p in ams["l1"]}
    ams_2l_by_year = {p["year"]: p["cost_eur"] for p in ams["l2"]}

    for row in trend:
        yr = row["year"]
        assert row["license_eur"] == pytest.approx(license_by_year.get(yr, 0.0))
        assert row["infrastructure_eur"] == pytest.approx(infra_by_year.get(yr, 0.0))
        assert row["ams_eur"] == pytest.approx(
            ams_1l_by_year.get(yr, 0.0) + ams_2l_by_year.get(yr, 0.0)
        )
        assert row["total_eur"] == pytest.approx(
            row["capex_eur"] + row["license_eur"] + row["infrastructure_eur"] + row["ams_eur"]
        )
    # Fixture capex is all go-live-2021 -- neither 2024 nor 2025 has any.
    assert trend[0]["capex_eur"] == pytest.approx(0.0)
    assert trend[1]["capex_eur"] == pytest.approx(0.0)


def test_tco_trend_includes_a_year_with_capex_but_no_running_cost_data(
    db_session: Session, simple_ops: SimpleOpsService
) -> None:
    # 2021 has capex (20700.50) but is outside the AMS-year range (2024-2025),
    # so it has no license/infra/AMS data. tco_trend must still surface it --
    # a CIO must see where CAPEX landed even if the running-cost feed doesn't
    # go back that far.
    service = ExecutiveService(AnalyticsRepository(db_session), simple_ops)

    trend = {row["year"]: row for row in service.tco_trend()}

    assert 2021 in trend
    assert trend[2021]["capex_eur"] == pytest.approx(20700.50)
    assert trend[2021]["license_eur"] == pytest.approx(0.0)
    assert trend[2021]["total_eur"] == pytest.approx(20700.50)
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd backend && pytest tests/integration/test_executive_service.py -v -m integration -k tco_trend`
Expected: FAIL — `TypeError: ExecutiveService.__init__() takes 2 positional arguments but 3 were given` (constructor doesn't accept `simple_ops` yet), then `AttributeError: 'ExecutiveService' object has no attribute 'tco_trend'`.

- [ ] **Step 3: Update `ExecutiveService.__init__` and add `tco_trend()`**

In `backend/app/services/executive.py`, change the constructor (line 29-31) and add the new method after `cost_breakdown` (end of file):

```python
from app.services.simple_ops import SimpleOpsService  # add to imports


class ExecutiveService:
    def __init__(self, repo: AnalyticsRepository, simple_ops: SimpleOpsService) -> None:
        self._repo = repo
        self._simple_ops = simple_ops
```

```python
    def tco_trend(self) -> list[dict[str, Any]]:
        """Per-year TCO decomposition: CAPEX (own query, by go-live year) plus
        license/infrastructure/AMS running cost, sourced from SimpleOpsService
        rather than re-derived -- those formulas already live there."""
        capex_by_year = self._repo.capex_by_year()
        license_by_year = {p["year"]: p["cost_eur"] for p in self._simple_ops.license_cost_trend()}
        infra_by_year = {
            p["year"]: p["cost_eur"] for p in self._simple_ops.infrastructure()["trend"]
        }
        ams = self._simple_ops.ams_trend()
        ams_1l_by_year = {p["year"]: p["cost_eur"] for p in ams["l1"]}
        ams_2l_by_year = {p["year"]: p["cost_eur"] for p in ams["l2"]}

        years = sorted(
            set(capex_by_year)
            | set(license_by_year)
            | set(infra_by_year)
            | set(ams_1l_by_year)
            | set(ams_2l_by_year)
        )
        rows = []
        for year in years:
            capex = float(capex_by_year.get(year, Decimal("0")))
            license_eur = license_by_year.get(year, 0.0)
            infra_eur = infra_by_year.get(year, 0.0)
            ams_eur = ams_1l_by_year.get(year, 0.0) + ams_2l_by_year.get(year, 0.0)
            rows.append(
                {
                    "year": year,
                    "capex_eur": round(capex, 2),
                    "license_eur": round(license_eur, 2),
                    "infrastructure_eur": round(infra_eur, 2),
                    "ams_eur": round(ams_eur, 2),
                    "total_eur": round(capex + license_eur + infra_eur + ams_eur, 2),
                }
            )
        return rows
```

- [ ] **Step 4: Update `dependencies.py` to inject `SimpleOpsService` into `ExecutiveService`**

In `backend/app/dependencies.py`, `get_executive_service` must depend on `SimpleOpsServiceDependency`. Since `SimpleOpsServiceDependency` is defined *after* `get_executive_service` today, reorder: move the `get_simple_ops_service`/`SimpleOpsServiceDependency` definitions above `get_executive_service`.

```python
def get_simple_ops_service(repo: AnalyticsRepositoryDependency) -> SimpleOpsService:
    return SimpleOpsService(repo)


SimpleOpsServiceDependency = Annotated[SimpleOpsService, Depends(get_simple_ops_service)]


def get_executive_service(
    repo: AnalyticsRepositoryDependency, simple_ops: SimpleOpsServiceDependency
) -> ExecutiveService:
    return ExecutiveService(repo, simple_ops)
```

Remove the old `get_executive_service` (line 41-42) and the old `get_simple_ops_service`/`SimpleOpsServiceDependency` (line 63-64, 76) from their original positions.

- [ ] **Step 5: Fix the other `ExecutiveService(...)` call site**

`backend/tests/integration/test_executive_service.py`'s existing `service` fixture (line 15-18) constructs `ExecutiveService(AnalyticsRepository(db_session))` directly — update it:

```python
@pytest.fixture
def service(db_session: Session, simple_ops: SimpleOpsService) -> ExecutiveService:
    run_rpa_ingestion(db_session, FIXTURE)
    return ExecutiveService(AnalyticsRepository(db_session), simple_ops)
```

Note this changes the existing `service` fixture's dependency order — `simple_ops` fixture (added in Step 1 above) must itself call `run_rpa_ingestion` first or depend on a fixture that does; since both `service` and `simple_ops` need the ingestion to have run against the *same* `db_session`, restructure so ingestion runs once: make `simple_ops` NOT run ingestion (only patch `AmsYear`), and have `service` run ingestion before constructing `simple_ops`'s repository — simplest fix is to run `run_rpa_ingestion` inside `service` (as before) and have `simple_ops` (used only by the two new `tco_trend` tests) run it too via its own fixture, since `db_session` is function-scoped and each test gets a clean DB. Concretely, `simple_ops` fixture becomes:

```python
@pytest.fixture
def simple_ops(db_session: Session) -> SimpleOpsService:
    run_rpa_ingestion(db_session, FIXTURE)
    db_session.execute(update(AmsYear).where(AmsYear.ordinal == 1).values(year=2024))
    db_session.execute(update(AmsYear).where(AmsYear.ordinal == 2).values(year=2025))
    db_session.commit()
    return SimpleOpsService(AnalyticsRepository(db_session))
```

And the `service` fixture used by the *existing* (pre-Task-2) tests, which don't need AMS years patched, becomes:

```python
@pytest.fixture
def service(db_session: Session) -> ExecutiveService:
    run_rpa_ingestion(db_session, FIXTURE)
    simple_ops = SimpleOpsService(AnalyticsRepository(db_session))
    return ExecutiveService(AnalyticsRepository(db_session), simple_ops)
```

and `test_tco_trend_*` takes `simple_ops` directly (not `service`) as shown in Step 1, building its own `ExecutiveService` from `db_session` + `simple_ops` so the AMS-year patch is visible to it.

**Correction (post-implementation):** there was a *second*, module-scoped `ExecutiveService(repo)` call site this step missed — `backend/tests/integration/test_excel_reconciliation.py:114`. It only surfaced when running the full `backend/tests/integration` suite (during the companion plan's Task 4), not from `test_executive_service.py` alone, because that file is excluded from a plain `pytest -k executive` sweep by name. Fixed the same way: `ExecutiveService(repo, SimpleOpsService(repo))`. Lesson: after changing a shared service constructor's signature, grep the whole `backend/tests/` tree for the class name before declaring the step done, not just the file the plan happened to name.

- [ ] **Step 6: Run all executive service tests**

Run: `cd backend && pytest tests/integration/test_executive_service.py -v -m integration`
Expected: PASS (all existing tests + 2 new `tco_trend` tests)

- [ ] **Step 7: Commit**

```bash
git add backend/app/services/executive.py backend/app/dependencies.py backend/tests/integration/test_executive_service.py
git commit -m "feat: inject SimpleOpsService into ExecutiveService, add tco_trend()"
```

---

### Task 3: `GET /api/v1/executive/tco-trend`

**Files:**
- Modify: `backend/app/api/v1/executive.py`
- Modify: `backend/app/schemas/analytics.py`
- Test: `backend/tests/integration/test_executive_api.py` (create — this repo's convention for HTTP-level tests is a `test_<router>_api.py` file inside `backend/tests/integration/`, using the `client`/`db_session` fixtures from that directory's `conftest.py`; see `backend/tests/integration/test_process_catalog_api.py` for the exact pattern this mirrors)

**Interfaces:**
- Produces: `TcoTrendPoint` schema `{year: int, capex_eur: float, license_eur: float, infrastructure_eur: float, ams_eur: float, total_eur: float}`.
- Produces: route `GET /api/v1/executive/tco-trend -> list[TcoTrendPoint]`.

- [ ] **Step 1: Write the failing test**

```python
# backend/tests/integration/test_executive_api.py
from pathlib import Path

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import update
from sqlalchemy.orm import Session

from app.ingestion.rpa_pipeline import run_rpa_ingestion
from app.models.core import AmsYear

pytestmark = pytest.mark.integration

FIXTURE = Path(__file__).resolve().parents[3] / "data" / "fixtures" / "rpa_sample.xlsx"


def test_tco_trend_endpoint_returns_a_list_of_year_rows(
    client: TestClient, db_session: Session
) -> None:
    run_rpa_ingestion(db_session, FIXTURE)
    db_session.execute(update(AmsYear).where(AmsYear.ordinal == 1).values(year=2024))
    db_session.execute(update(AmsYear).where(AmsYear.ordinal == 2).values(year=2025))
    db_session.commit()

    response = client.get("/api/v1/executive/tco-trend")

    assert response.status_code == 200
    body = response.json()
    assert [row["year"] for row in body] == [2021, 2024, 2025]
    for row in body:
        assert set(row) == {
            "year",
            "capex_eur",
            "license_eur",
            "infrastructure_eur",
            "ams_eur",
            "total_eur",
        }
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd backend && pytest tests/integration/test_executive_api.py -v -k tco_trend`
Expected: FAIL with 404 (route doesn't exist).

- [ ] **Step 3: Add the schema**

In `backend/app/schemas/analytics.py`, add after `ExecutiveTrends`:

```python
class TcoTrendPoint(BaseModel):
    year: int
    capex_eur: float
    license_eur: float
    infrastructure_eur: float
    ams_eur: float
    total_eur: float
```

- [ ] **Step 4: Add the route**

In `backend/app/api/v1/executive.py`, add:

```python
from app.schemas.analytics import CompanySummaryRow, ExecutiveTrends, TcoTrendPoint, TrendPoint

@router.get("/tco-trend", response_model=list[TcoTrendPoint])
def get_tco_trend(service: ExecutiveServiceDependency) -> list[TcoTrendPoint]:
    return [TcoTrendPoint(**row) for row in service.tco_trend()]
```

- [ ] **Step 5: Run test to verify it passes**

Run: `cd backend && pytest tests/integration/test_executive_api.py -v -k tco_trend`
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add backend/app/api/v1/executive.py backend/app/schemas/analytics.py backend/tests/integration/test_executive_api.py
git commit -m "feat: add GET /api/v1/executive/tco-trend"
```

---

### Task 4: `ExecutiveService.savings_payback_trend()` + `GET /api/v1/executive/savings-payback`

**Files:**
- Modify: `backend/app/services/executive.py`
- Modify: `backend/app/api/v1/executive.py`
- Modify: `backend/app/schemas/analytics.py`
- Modify: `backend/tests/integration/test_executive_service.py`
- Modify: `backend/tests/integration/test_executive_api.py`

**Interfaces:**
- Consumes: `ExecutiveService.tco_trend()` (Task 2), `ExecutiveService.trends()["saving_by_month"]` (existing, already cumulative).
- Produces: `ExecutiveService.savings_payback_trend() -> list[dict]`, each `{"year": int, "cumulative_spend_eur": float, "cumulative_saving_eur": float}`, one row per year present in `tco_trend()`, sorted ascending. `cumulative_spend_eur` is the running total of `total_eur` from `tco_trend()` up to and including that year. `cumulative_saving_eur` is the last value of `saving_by_month` at or before December of that year (0 if no saving data exists yet for that year or earlier).
- Produces: `SavingsPaybackPoint` schema, route `GET /api/v1/executive/savings-payback -> list[SavingsPaybackPoint]`.

- [ ] **Step 1: Write the failing service test**

```python
def test_savings_payback_trend_accumulates_spend_and_saving_by_year(
    db_session: Session, simple_ops: SimpleOpsService
) -> None:
    service = ExecutiveService(AnalyticsRepository(db_session), simple_ops)

    payback = service.savings_payback_trend()
    tco = service.tco_trend()

    years = [row["year"] for row in tco]
    assert [row["year"] for row in payback] == years

    running_spend = 0.0
    for tco_row, payback_row in zip(tco, payback, strict=True):
        running_spend += tco_row["total_eur"]
        assert payback_row["cumulative_spend_eur"] == pytest.approx(running_spend)
        # cumulative saving is monotonically non-decreasing across years
    savings = [row["cumulative_saving_eur"] for row in payback]
    assert savings == sorted(savings)
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd backend && pytest tests/integration/test_executive_service.py -v -k savings_payback`
Expected: FAIL — `AttributeError: 'ExecutiveService' object has no attribute 'savings_payback_trend'`

- [ ] **Step 3: Implement `savings_payback_trend()`**

Add to `backend/app/services/executive.py`, after `tco_trend`:

```python
    def savings_payback_trend(self) -> list[dict[str, Any]]:
        """Cumulative spend (running CAPEX + running-cost total, from
        tco_trend) vs. cumulative realized saving (from the existing
        go-live-month saving ramp), one point per real year -- the portfolio
        payback curve."""
        tco_rows = self.tco_trend()
        cumulative_by_month = self.trends()["saving_by_month"]

        rows = []
        running_spend = Decimal("0")
        for tco_row in tco_rows:
            year = tco_row["year"]
            running_spend += Decimal(str(tco_row["total_eur"]))
            cumulative_saving = Decimal("0")
            for point in cumulative_by_month:
                point_year = int(point["period"][:4])
                if point_year <= year:
                    cumulative_saving = Decimal(str(point["value"]))
                else:
                    break
            rows.append(
                {
                    "year": year,
                    "cumulative_spend_eur": _round_money(running_spend),
                    "cumulative_saving_eur": _round_money(cumulative_saving),
                }
            )
        return rows
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd backend && pytest tests/integration/test_executive_service.py -v -k savings_payback`
Expected: PASS

- [ ] **Step 5: Add schema, route, and API test**

```python
# schemas/analytics.py
class SavingsPaybackPoint(BaseModel):
    year: int
    cumulative_spend_eur: float
    cumulative_saving_eur: float
```

```python
# api/v1/executive.py
@router.get("/savings-payback", response_model=list[SavingsPaybackPoint])
def get_savings_payback(service: ExecutiveServiceDependency) -> list[SavingsPaybackPoint]:
    return [SavingsPaybackPoint(**row) for row in service.savings_payback_trend()]
```

Add the corresponding test to `backend/tests/integration/test_executive_api.py`, following the exact same shape as Task 3's `test_tco_trend_endpoint_returns_a_list_of_year_rows` (seed via `run_rpa_ingestion` + the `AmsYear` patch, hit `client.get("/api/v1/executive/savings-payback")`, assert `set(row) == {"year", "cumulative_spend_eur", "cumulative_saving_eur"}` for each row), then run it.

- [ ] **Step 6: Commit**

```bash
git add backend/app/services/executive.py backend/app/api/v1/executive.py backend/app/schemas/analytics.py backend/tests/integration/test_executive_service.py backend/tests/integration/test_executive_api.py
git commit -m "feat: add savings_payback_trend service method and API endpoint"
```

---

### Task 5: Rewrite `ExecutiveService.kpis()` to a spend-vs-save header

**Files:**
- Modify: `backend/app/services/executive.py`
- Modify: `backend/tests/integration/test_executive_service.py`

**Interfaces:**
- Produces: `kpis()` now returns exactly these keys: `kpi_annual_saving_eur`, `kpi_total_saved_to_date_eur`, `kpi_total_capex_eur`, `kpi_total_spend_to_date_eur`, `kpi_net_position_eur`, `kpi_total_tickets`. The old `kpi_roi_1_5y_ok_pct`, `kpi_run_cost_3y_eur`, `kpi_tco_3y_eur`, `kpi_net_benefit_3y_eur`, `kpi_roi_3y_full_cost_pct` are removed.
- Company-filter behavior unchanged in spirit: `kpi_total_spend_to_date_eur` and `kpi_net_position_eur` (both depend on portfolio-level running cost) become unavailable under a company filter, with the same documented reason string used today. `kpi_annual_saving_eur`, `kpi_total_saved_to_date_eur`, `kpi_total_capex_eur`, `kpi_total_tickets` stay available and company-scoped (capex and saving are legitimately attributable).

- [ ] **Step 1: Write the failing tests** (replace the old ROI-card tests in `test_executive_service.py`)

Remove `test_kpis_roi_percentages_match_the_documented_formulas` and `test_kpis_are_unavailable_not_zero_when_capex_is_zero`'s ROI-1.5y assertion (Test 3 in the current file), replacing with:

```python
def test_kpis_expose_spend_vs_saving_headline_metrics(service: ExecutiveService) -> None:
    kpis = service.kpis()

    assert kpis["kpi_annual_saving_eur"].value == pytest.approx(17715.60)
    assert kpis["kpi_total_capex_eur"].value == pytest.approx(20700.50)
    assert kpis["kpi_total_saved_to_date_eur"].available
    assert kpis["kpi_total_spend_to_date_eur"].available
    assert kpis["kpi_net_position_eur"].value == pytest.approx(
        kpis["kpi_total_saved_to_date_eur"].value - kpis["kpi_total_spend_to_date_eur"].value
    )


def test_kpis_mark_spend_metrics_unavailable_under_a_company_filter(
    service: ExecutiveService,
) -> None:
    kpis = service.kpis(company="Menarini")

    for name in ("kpi_total_spend_to_date_eur", "kpi_net_position_eur"):
        assert kpis[name].available is False, name

    # capex and saving stay attributable per company.
    assert kpis["kpi_total_capex_eur"].available
    assert kpis["kpi_total_capex_eur"].value == pytest.approx(12500.00)
    assert kpis["kpi_total_saved_to_date_eur"].available
```

Remove the now-obsolete `test_kpis_run_cost_and_tco_sum_the_three_run_cost_components` and `test_kpis_roi_percentages_match_the_documented_formulas` tests, and remove the ROI-card assertion from `test_kpis_mark_shared_cost_metrics_unavailable_under_a_company_filter` (keep the rest of that test, updating the metric-name tuple to `("kpi_total_spend_to_date_eur", "kpi_net_position_eur")`).

**Correction (post-implementation):** `test_kpis_are_unavailable_not_zero_when_capex_is_zero` was deleted outright rather than modified — its entire premise (a `capex_eur == 0` division producing an unavailable ROI%) no longer applies to any of the 6 new KPI keys, none of which divide by capex. Its "unavailable, not a fabricated zero" concern is already covered by `test_kpis_mark_spend_metrics_unavailable_under_a_company_filter`. Separately, `backend/tests/integration/test_rpa_api.py::test_executive_kpis_respects_the_company_query_param` also referenced the removed `kpi_run_cost_3y_eur` key and needed updating to `kpi_total_spend_to_date_eur` — the plan hadn't anticipated this file depending on the KPI key names too.

- [ ] **Step 2: Run tests to verify the new ones fail**

Run: `cd backend && pytest tests/integration/test_executive_service.py -v -k "spend_vs_saving or unavailable_under_a_company_filter"`
Expected: FAIL — old keys still present, new keys missing.

- [ ] **Step 3: Rewrite `kpis()`**

Replace `backend/app/services/executive.py`'s `kpis` method (lines 33-117) with:

```python
    def kpis(self, *, company: str | None = None) -> dict[str, MetricValue]:
        filters: dict[str, Any] = {"company": company} if company else {}

        annual_saving = self._repo.annual_saving_eur(company=company)
        capex = self._repo.capex_eur(company=company)
        ticket_counts = self._repo.ticket_counts(company=company)
        saving_by_month = self.trends(company=company)["saving_by_month"]
        total_saved_to_date = (
            Decimal(str(saving_by_month[-1]["value"])) if saving_by_month else Decimal("0")
        )

        metrics: dict[str, MetricValue] = {
            "kpi_annual_saving_eur": available_metric(
                "kpi_annual_saving_eur", _round_money(annual_saving), "eur", filters=filters
            ),
            "kpi_total_capex_eur": available_metric(
                "kpi_total_capex_eur", _round_money(capex), "eur", filters=filters
            ),
            "kpi_total_saved_to_date_eur": available_metric(
                "kpi_total_saved_to_date_eur",
                _round_money(total_saved_to_date),
                "eur",
                filters=filters,
            ),
            "kpi_total_tickets": available_metric(
                "kpi_total_tickets", ticket_counts.total, "count", filters=filters
            ),
        }

        if company is not None:
            reason = (
                "AMS 1L and license costs are portfolio-level with no documented "
                "per-company allocation rule"
            )
            metrics["kpi_total_spend_to_date_eur"] = unavailable_metric(
                "kpi_total_spend_to_date_eur", "eur", reason=reason, filters=filters
            )
            metrics["kpi_net_position_eur"] = unavailable_metric(
                "kpi_net_position_eur", "eur", reason=reason, filters=filters
            )
            return metrics

        total_spend_to_date = sum(
            (Decimal(str(row["total_eur"])) for row in self.tco_trend()), Decimal("0")
        )
        net_position = total_saved_to_date - total_spend_to_date
        metrics["kpi_total_spend_to_date_eur"] = available_metric(
            "kpi_total_spend_to_date_eur", _round_money(total_spend_to_date), "eur", filters=filters
        )
        metrics["kpi_net_position_eur"] = available_metric(
            "kpi_net_position_eur", _round_money(net_position), "eur", filters=filters
        )
        return metrics
```

- [ ] **Step 4: Add a `company` parameter to `trends()`**

`savings_payback_trend()` (Task 4) and the new `kpis()` both need `trends()` to be company-aware. Update `backend/app/services/executive.py`'s `trends` method (lines 119-130):

```python
    def trends(self, *, company: str | None = None) -> dict[str, list[dict[str, Any]]]:
        contributions = self._repo.annual_saving_contribution_by_month(company=company)
        cumulative = Decimal("0")
        saving_by_month: list[dict[str, Any]] = []
        for period, amount in contributions:
            cumulative += amount
            saving_by_month.append({"period": period, "value": _round_money(cumulative)})

        tickets_by_month = [
            {"period": period, "value": count}
            for period, count in self._repo.tickets_by_month(company=company)
        ]
        return {"saving_by_month": saving_by_month, "tickets_by_month": tickets_by_month}
```

(`tickets_by_month` on the repository already accepts `company` — no repository change needed there.) Existing callers of `trends()` with no arguments are unaffected (default `company=None`).

- [ ] **Step 5: Run all executive service tests**

Run: `cd backend && pytest tests/integration/test_executive_service.py -v -m integration`
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add backend/app/services/executive.py backend/tests/integration/test_executive_service.py
git commit -m "feat: replace fixed-multiplier ROI cards with spend-vs-save KPI header"
```

---

### Task 6: Frontend API client for the two new endpoints + revised `MetricMap` keys

**Files:**
- Modify: `frontend/src/api/executive.ts`

**Interfaces:**
- Produces: `TcoTrendPoint`, `SavingsPaybackPoint` TypeScript interfaces; `fetchExecutiveTcoTrend()`, `fetchExecutiveSavingsPayback()` functions.

- [ ] **Step 1: Add types and fetchers**

```typescript
export interface TcoTrendPoint {
  year: number
  capex_eur: number
  license_eur: number
  infrastructure_eur: number
  ams_eur: number
  total_eur: number
}

export interface SavingsPaybackPoint {
  year: number
  cumulative_spend_eur: number
  cumulative_saving_eur: number
}

export async function fetchExecutiveTcoTrend(): Promise<TcoTrendPoint[]> {
  return getJson<TcoTrendPoint[]>('/api/v1/executive/tco-trend')
}

export async function fetchExecutiveSavingsPayback(): Promise<SavingsPaybackPoint[]> {
  return getJson<SavingsPaybackPoint[]>('/api/v1/executive/savings-payback')
}
```

- [ ] **Step 2: Remove now-unused exports**

`fetchExecutiveCostBreakdown` and `CompanySummaryRow`/`fetchExecutiveCompanySummary` are dropped by Task 8 (page rewrite removes the cost-breakdown and company-summary sections — see Task 8's design note). Leave them in this file for now; Task 8 removes their only callers, and a follow-up cleanup step in Task 8 deletes the now-dead exports from this file in the same commit as the page rewrite (keeps this task's diff reviewable in isolation).

- [ ] **Step 3: No test needed** — this file has no direct unit test in the current codebase (verified: only `executive.ts` consumers are tested, via `ExecutivePage.test.tsx`). Task 8's page test exercises these fetchers through MSW/mock wiring.

- [ ] **Step 4: Commit**

```bash
git add frontend/src/api/executive.ts
git commit -m "feat: add fetchExecutiveTcoTrend and fetchExecutiveSavingsPayback API clients"
```

---

### Task 7: `StackedBarChart` and `PaybackAreaChart` components

**Files:**
- Create: `frontend/src/components/StackedBarChart.tsx`
- Create: `frontend/src/components/PaybackAreaChart.tsx`

**No dedicated component test for either.** `frontend/src/test/setup.ts` doesn't polyfill `ResizeObserver`, and jsdom has none natively — Recharts' `<ResponsiveContainer>` measures `0x0` under jsdom and never mounts its children (`<Legend>`, `<Bar>`, etc.), confirmed empirically: an RTL test asserting on Recharts-rendered legend text fails with the container stuck at `width: 0px; height: 0px`, regardless of whether the component is implemented correctly. This is exactly why the two *existing* chart components in this codebase, `TrendChart` and `RankBarChart`, have zero dedicated test files — check `frontend/src/components/` yourself before writing tests here; there is no precedent for testing a Recharts component's internals directly in this repo. Follow the same convention: implement both components with no test file, and verify them through `ExecutivePage.test.tsx`'s heading-level assertions (which check plain text outside the zero-sized chart container, so they render fine) plus the manual browser check in Task 8.

**Interfaces:**
- Produces: `StackedBarChart({ data, xKey, series, height?, valueFormatter? })` — `series: { key: string; label: string; color: string }[]`, one stacked `Bar` per series, year on the x-axis.
- Produces: `PaybackAreaChart({ data, xKey, spendKey, savingKey, height?, valueFormatter? })` — two-series combo chart (spend as a filled area, saving as a line crossing over it).

- [ ] **Step 1: Implement `StackedBarChart`**

```typescript
// frontend/src/components/StackedBarChart.tsx
import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'

interface Series {
  key: string
  label: string
  color: string
}

interface StackedBarChartProps {
  data: Array<Record<string, string | number>>
  xKey: string
  series: Series[]
  height?: number
  valueFormatter?: (value: number) => string
}

export function StackedBarChart({
  data,
  xKey,
  series,
  height = 300,
  valueFormatter,
}: StackedBarChartProps) {
  return (
    <div style={{ height }}>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 8, right: 16, bottom: 0, left: 0 }}>
          <CartesianGrid stroke="#e1e0d9" vertical={false} />
          <XAxis
            dataKey={xKey}
            tick={{ fill: '#898781', fontSize: 12 }}
            stroke="#c3c2b7"
          />
          <YAxis
            tick={{ fill: '#898781', fontSize: 12 }}
            stroke="#c3c2b7"
            width={64}
            tickFormatter={valueFormatter}
          />
          <Tooltip
            formatter={(value) =>
              valueFormatter ? valueFormatter(Number(value)) : String(value)
            }
            contentStyle={{ borderRadius: 8, borderColor: '#e1e0d9', fontSize: 13 }}
          />
          <Legend wrapperStyle={{ fontSize: 12 }} />
          {series.map((item) => (
            <Bar
              key={item.key}
              dataKey={item.key}
              name={item.label}
              stackId="tco"
              fill={item.color}
              stroke="#fcfcfb"
              strokeWidth={2}
            />
          ))}
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}
```

(`stroke="#fcfcfb"` on each `Bar` gives the required 2px surface gap between stacked segments per the dataviz mark spec.)

- [ ] **Step 2: Implement `PaybackAreaChart`**

```typescript
// frontend/src/components/PaybackAreaChart.tsx
import {
  Area,
  CartesianGrid,
  ComposedChart,
  Legend,
  Line,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'

interface PaybackAreaChartProps {
  data: Array<Record<string, string | number>>
  xKey: string
  spendKey: string
  savingKey: string
  height?: number
  valueFormatter?: (value: number) => string
}

export function PaybackAreaChart({
  data,
  xKey,
  spendKey,
  savingKey,
  height = 320,
  valueFormatter,
}: PaybackAreaChartProps) {
  return (
    <div style={{ height }}>
      <ResponsiveContainer width="100%" height="100%">
        <ComposedChart data={data} margin={{ top: 8, right: 16, bottom: 0, left: 0 }}>
          <CartesianGrid stroke="#e1e0d9" vertical={false} />
          <XAxis dataKey={xKey} tick={{ fill: '#898781', fontSize: 12 }} stroke="#c3c2b7" />
          <YAxis
            tick={{ fill: '#898781', fontSize: 12 }}
            stroke="#c3c2b7"
            width={64}
            tickFormatter={valueFormatter}
          />
          <Tooltip
            formatter={(value) =>
              valueFormatter ? valueFormatter(Number(value)) : String(value)
            }
            contentStyle={{ borderRadius: 8, borderColor: '#e1e0d9', fontSize: 13 }}
          />
          <Legend wrapperStyle={{ fontSize: 12 }} />
          <Area
            type="monotone"
            dataKey={spendKey}
            name="Cumulative spend"
            fill="#2a78d6"
            fillOpacity={0.15}
            stroke="#2a78d6"
            strokeWidth={2}
          />
          <Line
            type="monotone"
            dataKey={savingKey}
            name="Cumulative saving"
            stroke="#eb6834"
            strokeWidth={2}
            dot={{ r: 3 }}
            activeDot={{ r: 5 }}
          />
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  )
}
```

- [ ] **Step 3: Typecheck**

Run: `cd frontend && npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add frontend/src/components/StackedBarChart.tsx frontend/src/components/PaybackAreaChart.tsx
git commit -m "feat: add StackedBarChart and PaybackAreaChart components"
```

---

### Task 8: Rewrite `ExecutivePage.tsx`

**Files:**
- Modify: `frontend/src/pages/ExecutivePage.tsx`
- Modify: `frontend/src/pages/ExecutivePage.test.tsx`
- Modify: `frontend/src/api/executive.ts` (remove now-dead `fetchExecutiveCompanySummary`, `fetchExecutiveCostBreakdown`, `CompanySummaryRow` — no remaining callers after this task)

**Design note (why the company-summary table and cost-breakdown bar chart are removed, not kept alongside the new charts):** The spec asks for "one only table" for the per-process view (companion plan) and a single company selector instead of a per-row company column. Keeping the old company-summary `DataTable` here as well would leave three separate tabular views of company/process data on one page, which contradicts that instruction's spirit even though the spec's literal words are inside the per-process section. The old cost-breakdown `RankBarChart` (3Y-only, no year axis) is strictly superseded by the new year-by-component `StackedBarChart` from Task 7. Both are deleted in this task.

- [ ] **Step 1: Write the failing test**

Replace `frontend/src/pages/ExecutivePage.test.tsx` entirely. It uses `renderWithQueryClient`/`mockFetchRoutes`/`metric` from `../test/mockFetch` (the existing convention — confirmed against the current file):

```typescript
import { cleanup, screen, within } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { metric, mockFetchRoutes, renderWithQueryClient } from '../test/mockFetch'
import { ExecutivePage } from './ExecutivePage'

afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
})

function mockRoutes() {
  return mockFetchRoutes({
    '/api/v1/metadata/filters': { companies: ['Menarini', 'Codifi'] },
    '/api/v1/executive/kpis': {
      kpi_annual_saving_eur: metric('kpi_annual_saving_eur', 17715.6, 'eur'),
      kpi_total_capex_eur: metric('kpi_total_capex_eur', 20700.5, 'eur'),
      kpi_total_saved_to_date_eur: metric('kpi_total_saved_to_date_eur', 12768, 'eur'),
      kpi_total_spend_to_date_eur: metric('kpi_total_spend_to_date_eur', 158700.5, 'eur'),
      kpi_net_position_eur: metric('kpi_net_position_eur', -145932.5, 'eur'),
      kpi_total_tickets: metric('kpi_total_tickets', 709, 'count'),
    },
    '/api/v1/executive/trends': {
      saving_by_month: [{ period: '2021-06', value: 12768 }],
      tickets_by_month: [{ period: '2024-01', value: 5 }],
    },
    '/api/v1/executive/tco-trend': [
      {
        year: 2024,
        capex_eur: 0,
        license_eur: 13000,
        infrastructure_eur: 0,
        ams_eur: 45500,
        total_eur: 58500,
      },
    ],
    '/api/v1/executive/savings-payback': [
      { year: 2024, cumulative_spend_eur: 58500, cumulative_saving_eur: 12768 },
    ],
  })
}

describe('ExecutivePage', () => {
  it('renders the spend-vs-save KPI header, not the old ROI cards', async () => {
    mockRoutes()
    renderWithQueryClient(<ExecutivePage />)

    const kpiSection = await screen.findByRole('region', { name: 'Executive KPIs' })
    expect(within(kpiSection).getByText('Total spent to date')).toBeInTheDocument()
    expect(within(kpiSection).getByText('Total saved to date')).toBeInTheDocument()
    expect(within(kpiSection).getByText('Net position')).toBeInTheDocument()
    expect(within(kpiSection).queryByText('ROI 1.5Y OK %')).not.toBeInTheDocument()
    expect(within(kpiSection).queryByText('ROI 3Y')).not.toBeInTheDocument()
  })

  it('renders the TCO decomposition and payback charts', async () => {
    mockRoutes()
    renderWithQueryClient(<ExecutivePage />)

    expect(
      await screen.findByRole('heading', { name: 'TCO by component, by year' }),
    ).toBeInTheDocument()
    expect(
      screen.getByRole('heading', { name: 'Cumulative savings vs. cumulative spend' }),
    ).toBeInTheDocument()
  })

  it('shows an unavailable metric as text, not a fabricated zero', async () => {
    mockFetchRoutes({
      '/api/v1/metadata/filters': { companies: ['Menarini', 'Codifi'] },
      '/api/v1/executive/kpis': {
        kpi_annual_saving_eur: metric('kpi_annual_saving_eur', 17715.6, 'eur'),
        kpi_total_capex_eur: metric('kpi_total_capex_eur', 20700.5, 'eur'),
        kpi_total_saved_to_date_eur: metric('kpi_total_saved_to_date_eur', 12768, 'eur'),
        kpi_total_spend_to_date_eur: metric('kpi_total_spend_to_date_eur', null, 'eur', false),
        kpi_net_position_eur: metric('kpi_net_position_eur', null, 'eur', false),
        kpi_total_tickets: metric('kpi_total_tickets', 6, 'count'),
      },
      '/api/v1/executive/trends': { saving_by_month: [], tickets_by_month: [] },
      '/api/v1/executive/tco-trend': [],
      '/api/v1/executive/savings-payback': [],
    })
    renderWithQueryClient(<ExecutivePage />)

    expect(await screen.findAllByText('Not available')).not.toHaveLength(0)
    expect(screen.queryByText('€0')).not.toBeInTheDocument()
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd frontend && npx vitest run src/pages/ExecutivePage.test.tsx`
Expected: FAIL — old labels present, new ones missing.

- [ ] **Step 3: Rewrite `ExecutivePage.tsx`**

```typescript
import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'

import {
  fetchExecutiveKpis,
  fetchExecutiveSavingsPayback,
  fetchExecutiveTcoTrend,
  fetchExecutiveTrends,
} from '../api/executive'
import { fetchFilters } from '../api/metadata'
import { formatValue } from '../api/metrics'
import { AsyncSection } from '../components/AsyncSection'
import { CompanyFilter } from '../components/CompanyFilter'
import { MetricCard } from '../components/MetricCard'
import { PaybackAreaChart } from '../components/PaybackAreaChart'
import { StackedBarChart } from '../components/StackedBarChart'
import { TrendChart } from '../components/TrendChart'

const KPI_CARDS: { key: string; label: string }[] = [
  { key: 'kpi_annual_saving_eur', label: 'Annual saving' },
  { key: 'kpi_total_capex_eur', label: 'Total CAPEX' },
  { key: 'kpi_total_saved_to_date_eur', label: 'Total saved to date' },
  { key: 'kpi_total_spend_to_date_eur', label: 'Total spent to date' },
  { key: 'kpi_net_position_eur', label: 'Net position' },
  { key: 'kpi_total_tickets', label: 'Total tickets' },
]

const TCO_SERIES = [
  { key: 'capex_eur', label: 'CAPEX', color: '#2a78d6' },
  { key: 'license_eur', label: 'Licences', color: '#eb6834' },
  { key: 'infrastructure_eur', label: 'Infrastructure', color: '#1baf7a' },
  { key: 'ams_eur', label: 'AMS support', color: '#eda100' },
]

export function ExecutivePage() {
  const [company, setCompany] = useState('')

  const filters = useQuery({ queryKey: ['metadata', 'filters'], queryFn: fetchFilters })
  const kpis = useQuery({
    queryKey: ['executive', 'kpis', company],
    queryFn: () => fetchExecutiveKpis(company || undefined),
  })
  const trends = useQuery({ queryKey: ['executive', 'trends'], queryFn: fetchExecutiveTrends })
  const tcoTrend = useQuery({
    queryKey: ['executive', 'tco-trend'],
    queryFn: fetchExecutiveTcoTrend,
  })
  const payback = useQuery({
    queryKey: ['executive', 'savings-payback'],
    queryFn: fetchExecutiveSavingsPayback,
  })

  return (
    <div className="space-y-10">
      <header className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-ink">Executive</h1>
          <p className="mt-1 text-slate-600">
            Portfolio KPIs sourced from PostgreSQL; unavailable metrics are shown as such
            rather than zero.
          </p>
        </div>
        {filters.data && (
          <CompanyFilter companies={filters.data.companies} value={company} onChange={setCompany} />
        )}
      </header>

      <AsyncSection
        isPending={kpis.isPending}
        isError={kpis.isError}
        error={kpis.error}
        loadingLabel="Loading executive KPIs…"
      >
        <section aria-label="Executive KPIs" className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {KPI_CARDS.map((card) => (
            <MetricCard key={card.key} label={card.label} metric={kpis.data?.[card.key]} />
          ))}
        </section>
      </AsyncSection>

      <section
        aria-label="TCO trend"
        className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"
      >
        <h2 className="mb-4 font-semibold text-ink">TCO by component, by year</h2>
        <AsyncSection
          isPending={tcoTrend.isPending}
          isError={tcoTrend.isError}
          error={tcoTrend.error}
          loadingLabel="Loading TCO trend…"
        >
          {tcoTrend.data && tcoTrend.data.length > 0 ? (
            <StackedBarChart
              data={tcoTrend.data}
              xKey="year"
              series={TCO_SERIES}
              valueFormatter={(value) => formatValue(value, 'eur')}
            />
          ) : (
            <p className="text-sm text-slate-500">No TCO trend data available.</p>
          )}
        </AsyncSection>
      </section>

      <section
        aria-label="Savings payback"
        className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"
      >
        <h2 className="mb-4 font-semibold text-ink">
          Cumulative savings vs. cumulative spend
        </h2>
        <AsyncSection
          isPending={payback.isPending}
          isError={payback.isError}
          error={payback.error}
          loadingLabel="Loading payback trend…"
        >
          {payback.data && payback.data.length > 0 ? (
            <PaybackAreaChart
              data={payback.data}
              xKey="year"
              spendKey="cumulative_spend_eur"
              savingKey="cumulative_saving_eur"
              valueFormatter={(value) => formatValue(value, 'eur')}
            />
          ) : (
            <p className="text-sm text-slate-500">No payback trend data available.</p>
          )}
        </AsyncSection>
      </section>

      <section aria-label="Trends" className="grid gap-6 lg:grid-cols-2">
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <h2 className="mb-4 font-semibold text-ink">Saving trend</h2>
          <AsyncSection
            isPending={trends.isPending}
            isError={trends.isError}
            error={trends.error}
            loadingLabel="Loading saving trend…"
          >
            {trends.data && trends.data.saving_by_month.length > 0 ? (
              <TrendChart
                data={trends.data.saving_by_month}
                xKey="period"
                series={[{ key: 'value', label: 'Cumulative annual saving' }]}
                valueFormatter={(value) => formatValue(value, 'eur')}
              />
            ) : (
              <p className="text-sm text-slate-500">No saving trend data available.</p>
            )}
          </AsyncSection>
        </div>
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <h2 className="mb-4 font-semibold text-ink">Ticket trend</h2>
          <AsyncSection
            isPending={trends.isPending}
            isError={trends.isError}
            error={trends.error}
            loadingLabel="Loading ticket trend…"
          >
            {trends.data && trends.data.tickets_by_month.length > 0 ? (
              <TrendChart
                data={trends.data.tickets_by_month}
                xKey="period"
                series={[{ key: 'value', label: 'Tickets' }]}
                valueFormatter={(value) => formatValue(value, 'count')}
              />
            ) : (
              <p className="text-sm text-slate-500">No ticket trend data available.</p>
            )}
          </AsyncSection>
        </div>
      </section>
    </div>
  )
}
```

- [ ] **Step 4: Remove dead exports from `frontend/src/api/executive.ts`**

Delete `CompanySummaryRow`, `fetchExecutiveCompanySummary`, `fetchExecutiveCostBreakdown` (no remaining callers).

- [ ] **Step 5: Run test to verify it passes**

Run: `cd frontend && npx vitest run src/pages/ExecutivePage.test.tsx`
Expected: PASS

- [ ] **Step 6: Manually verify in the browser**

Run: `cd frontend && npm run dev` (and the backend dev server per the repo's existing run instructions — check `docs/` or `README.md` if unclear). Navigate to `/executive`. Confirm: 6 KPI cards render with real numbers (not "Not available" everywhere), the TCO stacked bar chart renders with a 4-entry legend, the payback area/line chart renders with a 2-entry legend, and the two trend line charts below still work. Toggle the company selector and confirm "Total spent to date"/"Net position" switch to "Not available" while "Annual saving"/"Total CAPEX"/"Total saved to date" keep showing numbers.

- [ ] **Step 7: Commit**

```bash
git add frontend/src/pages/ExecutivePage.tsx frontend/src/pages/ExecutivePage.test.tsx frontend/src/api/executive.ts
git commit -m "feat: rewrite Executive page with spend-vs-save header and TCO/payback charts"
```

---

## Self-Review Notes (for the plan author, already applied above)

- Spec coverage: header metrics redesign (Task 5, 8), "clear picture where TCO number comes from + evolution over years, decomposed by component" (Task 2/3/8 — TCO stacked chart), "beautiful chart below metrics showing cumulative saving vs. spending, payback trajectory" (Task 4/7/8), infra-cost endpoint reuse from Simple Ops (Task 2, via `SimpleOpsService.infrastructure()`) — all covered. Per-process table, company-column removal, quick-wins removal are explicitly out of scope for this plan (companion plan).
- No placeholders: every step has real code or a real shell command.
- Type consistency checked: `tco_trend()`'s dict shape matches `TcoTrendPoint` schema matches `TcoTrendPoint` TS interface matches `TCO_SERIES` keys used in `ExecutivePage.tsx`; `savings_payback_trend()` shape matches `SavingsPaybackPoint` schema/TS/`PaybackAreaChart` prop usage throughout.
