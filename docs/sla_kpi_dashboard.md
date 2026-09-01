# SLA / KPI dashboard — CIO briefing rework

Rework of the `/sla-kpi` page (nav: "SLA / KPI", was "Performances") from a flat
stack of five equal sections into a decision-oriented briefing. Branch:
`redesign/sla-kpi-cio-dashboard`.

## SLA model

The AMS 1L contract keys targets on the **Einstein priority** (0–5) on each
ticket, via `core.ticket.priority_id → core.priority.value`, mapped to a provider
band:

| Einstein | Band | Incident reaction / repair | Service Request reaction / repair |
|---|---|---|---|
| 0–1 | High | 1 h / 4 h | 8 h / 8 h |
| 2–3 | Medium | 2 h / 8 h | 16 h / 16 h |
| 4–5 | Low | 8 h / 16 h | 24 h / 32 h |

All of this lives in `backend/app/services/sla_config.py`. **Every ticket in the
warehouse currently carries Einstein priority `3` (Medium)** — the dashboard shows
the observed priorities/bands so this is visible, and `DEFAULT_EINSTEIN_PRIORITY`
handles any missing value.

## What the dashboard measures

- **Reaction-time SLAs: not measured.** Tickets have no response timestamp.
- **Repair-time SLAs: measured** on the resolution date at **calendar-day**
  granularity. `end_date - start_date <= repair_target_days(type, priority)`,
  where `repair_target_days` = `ceil(repair_hours / 8)` (8h→1d, 16h→2d, 32h→4d).
  Approximate — a ticket opened late in the day can fall either side of a
  same-day target. For the current all-priority-3 data: Incident target = 1 day,
  Service Request target = 2 days.

## Changes

### Backend (additive — no existing endpoint changed shape)

| File | Change |
|---|---|
| `app/services/sla_config.py` | **New.** Einstein-priority → band → (reaction, repair) matrix, day-target derivation, KPI tile thresholds (were literals in `sla_kpis`), attainment bands, `status_for` / `attainment_status`. |
| `app/services/simple_ops.py` | `sla_kpis` reads thresholds from `sla_config`. New `sla_commitments()` and `sla_attainment(year, as_of)` (per-ticket target from its priority; groups by type, band, month; lists open tickets past target). Root-cause "Other" bucket was `"Altro"`. |
| `app/repositories/analytics.py` | New: `closed_tickets_for_sla(year)`, `open_tickets_for_sla(as_of)` — raw rows incl. `priority.value`; the SLA formula stays in the service. |
| `app/schemas/simple_ops.py` | `SlaCommitmentRow`, `SlaAttainment` (+ `SlaResolvedTarget`, `SlaAttainmentGroup`, …). |
| `app/api/v1/simple_ops.py` | `GET /simple-ops/sla-commitments`, `GET /simple-ops/sla-attainment`. |

### Frontend

- `theme.css` / `tailwind.config.js`: added `--ah-warning` (amber). **`--status-amber`
  was aliased to `--ah-pending` grey** — "at risk" was indistinguishable from "no data".
- `StatusBadge`: added a `warning` tone.
- `TrendChart` / `RankBarChart`: optional `referenceValue` / `referenceLabel` (target line).
- `SlaKpiPage.tsx`: full rewrite — real year picker; headline strip (attainment %,
  breaches, open-past-target, P90); exceptions panel + oldest-open-past-target
  table; KPI tiles with text status pills + proper "No data" handling; contractual
  SLA table (Einstein + provider priority) + measurability caveat + attainment
  breakdown by type and band; attainment-by-month trend with 95% target line;
  root-cause bars replacing the conic-gradient donuts.
- `Layout.tsx`: nav "Performances" → "SLA / KPI".

## Not done / open

- Per-KPI sparklines on the four legacy tiles (needs a monthly series per KPI).
- Backlog-aging buckets still 0-3 / 4-7 / 8-15 / >15; the 14-day KPI target sits
  inside the 8-15 band. Left alone — shared with the Operations and
  Service-Performance pages.
- `supportLevelTrend`, `rootCausePareto`, `resolution`, `backlogAging` are not
  year-scoped in the backend; the page states this rather than pretending.
- Attainment becomes meaningful across bands only once tickets carry real
  Einstein priorities (all `3` today). The reaction-time SLA needs response
  timestamps in the warehouse.
- Verified: `tsc`, `eslint --max-warnings 0`, `prettier`, `vite build` pass;
  `sla_config` pure logic unit-checked; backend otherwise `py_compile`-only (no
  ruff/mypy/Postgres in the dev environment). **Not run against a live DB or in a
  browser.**
