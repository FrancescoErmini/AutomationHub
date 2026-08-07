# Data assessment — "Dashboard Costi Running RPA"

Assessment only. No code or schema was changed to produce this report.

**Source reviewed:**
- Claude Design project `Dashboard Costi Running RPA` (`Executive Dashboard.dc.html`) — the target UI.
- Backend data model: `backend/app/models/{core,staging,analytics}.py`, ingestion (`backend/app/ingestion/*`), repositories (`backend/app/repositories/analytics.py`), services (`backend/app/services/*`).

**Verdict:** Roughly half of the UI is directly fuelable from the current `core` schema. The other half is blocked by one structural gap (AMS costs have no calendar-year key) plus several fields/tables that exist only as unstructured `staging` rows or don't exist yet at all — most of which you already flagged. Details and a consolidated punch list are below.

---

## 1. Header KPIs — Total Running Cost 2026 / 2025 / 2024

**Your formula:** `license cost (Y) + AMS cost (Y) + (2L tickets opened in Y × €500) + Σ(AMS RFC costs, Y)`

| Component | Status | Notes |
|---|---|---|
| License cost (Y) | ✅ Available | `core.license_cost(year, virtual_machine_id, cost_year_eur)` — `year` is a real calendar-year int, unique per `(year, vm)`. `SUM(cost_year_eur) WHERE year = 2026` works today. |
| AMS cost (Y) | ❌ **Blocked** | `core.ams_1l_cost` links to `core.ams_year`, but `ams_year.year` (the calendar-year column) **is never populated**. The ingestion loader (`rpa_core_loader.py:_load_ams_years`) only sets `code` (`"1st"/"2nd"/"3rd"`) and `ordinal` (1/2/3) — it never writes `year`. So AMS 1L/2L costs are keyed by *relative contract year* ("1st/2nd/3rd AMS year"), not by calendar year. There is currently no way to answer "what was the AMS cost in 2026" — only "what was the AMS cost in the most recent N contract years" (`ams_1l_cost_recent_years`, ordered by `ordinal desc`). This is the single biggest blocker for the header metric as specified. ==> MY_REVIEW: the data is in the postgres DB , not in the ingestion. Not a blocking point. |
| 2L tickets opened in Y × €500 | ✅ Available (different formula than what exists today) | `core.ticket.start_date` is a real date and `is_1l=False` flags a 2L ticket, so `COUNT(*) WHERE is_1l=False AND year(start_date)=2026` is straightforward. Note: this is a *flat-rate* estimate. The system already tracks **actual** 2L cost per ticket in `core.ams_2l_cost.cost_per_ticket_eur` (used today by `AnalyticsRepository.ams_2l_cost_total`) — real, non-€500 amounts. Nothing stops computing your €500-flat version too; just flagging that you have more accurate data sitting right next to the number you asked for, in case that was assumed unavailable. |
| Σ AMS RFC costs (Y) | ❌ **Blocked** | AMS RFC exists only as `staging.ams_rfc` — a raw JSONB dump of the workbook sheet, with **no required-columns contract** (`REQUIRED_COLUMNS["AMS RFC"] = frozenset()`, i.e. schema is unvalidated) and explicitly documented as "freeform, inconsistent row shapes" in `docs/rpa_final_validation_report.md` §11. It was deliberately **not** promoted to `core` — no typed cost column, no year/date column, no relationship to `process`/`ticket`. You cannot `SUM()` a cost out of it reliably today; the column even holding "cost" per row needs to be confirmed against the real sheet first.

 ==> MY_REVIEW: I create a csv cleaned with RFC , process name references and year and cost: C:\Users\erminif\workspace\automation-hub\data\raw\RPA_AMS_RFC_Amendment.csv
 
 |

**What's needed:** (a) populate `ams_year.year` during ingestion (a mapping from `1st/2nd/3rd` → an actual calendar year has to be decided — likely inferable from the earliest ticket/license date, but it's a business decision, not something the data self-declares), and (b) promote `staging.ams_rfc` to a typed `core` table with `year` + `cost_eur` at minimum.

---

## 2. Infrastructure section

| Data point | Status | Notes |
|---|---|---|
| VM running cost by year (2020–2026) | ❌ Not modeled yet (as you flagged) | No table maps a cost to a VM by year outside of `license_cost` (which is *license* cost, not general opex). You'll need something like `core.vm_cost(year, virtual_machine_id, cost_eur)`, mirroring `license_cost`'s shape. Confirmed: doesn't exist anywhere in `core` or `staging` today.


 ==> MY_REVIEW: Yes, and you can create this table core.vm_cost(year, virtual_machine_id, cost_eur) with the same machine and year in licenses and zero euro in cost. 
 
|
| Number of VMs | ✅ Available | `core.virtual_machine`, already has a repo method (`AnalyticsRepository.virtual_machine_count`). |
| Number of DBs (= number of processes) | ✅ Available | `core.process` row count. Trivial `COUNT(*)`, no new column needed — just a service-layer decision to alias process count as "DB count," per your instruction. |
| Utenze (user accounts) | Skipped per your instruction | No such table exists (correctly out of scope for now). |

---

## 3. "Machine occupancy by time slot" heatmap

❌ **Not modeled yet (as you flagged).** `core.process_schedule` has `run_time` (free text, e.g. `"09:30\n12:30\n15:00"`) and `frequency` (free text), but no categorical slot label. You need a new column — e.g. `process_schedule.time_slot` — constrained to `{morning, afternoon, evening, late_evening, night, early_morning}`, backfilled to `'morning'` for existing rows, as you described. 

==> MY_REVIEW: Yes, and you can add this column  and put default to morning for every process. 

One thing worth flagging now rather than after the migration: with every existing row defaulted to `'morning'`, the heatmap will be **degenerate** (100% of occupancy in one bucket, all other slots empty) until real values are back-filled per row. That's expected and fine as an interim state — just noting it so it isn't mistaken for a bug when the chart renders lopsided immediately after the migration.

Also worth confirming before you build it: `process_schedule` has no unique constraint on `process_id` — a process can have more than one schedule row (e.g. it's matched 1:1 with rows in the source `SCHEDULES` sheet, not deduplicated per process). If any process has multiple rows, each could in principle get a different `time_slot` label, which is fine for a heatmap (multiple slots per VM) but means "one process → one label" isn't guaranteed at the DB level. 


==> MY_REIVEW: You are right, it could happen,do not put constraints.

---

## 4. SLA / Quality KPIs

### RPA Internal Root Causes %
**Your formula:** tickets with root cause `"Problema Funzionale RPA"` ÷ total incidents (excluding Service Requests), 2026 only.

✅ **Available**, with two real fields backing it independently:
- `core.ticket.ticket_type` is free text populated from the source `TICKET_TYPE` column with observed values `"Incident"` / `"Service Request"` — so "excluding Service Requests" filters on `ticket_type != 'Service Request'`.
- `core.ticket.root_cause_id` → `core.root_cause.name`, with `"Problema Funzionale RPA"` and `"Evasione SR"` confirmed as real values used in the fixtures/tests (`test_operations_service.py`).
- `core.ticket.start_date` gives the year filter.

No schema change needed — only a new query (current `root_cause_pareto()` has no year filter, no `ticket_type` filter, and no denominator restricted to incidents; needs a new repo/service method).

⚠️ **Data-quality caveat, not a data-availability gap:** the codebase already tracks `dq_root_cause_not_classified_pct` as a known-weak metric — meaning a non-trivial share of tickets have `root_cause_id = NULL` in the real data. That directly affects how trustworthy this specific KPI is once computed; worth keeping the existing DQ metric visible next to it rather than hiding it.

==> MY_REVIEW: Treat the black root causes as an invisible label 'unclassified', or just put a defulat in case no value is present that really put 'unclassified' as string.

### Backlog Aging
**Your formula:** open tickets (no closure date) opened >2 weeks ago ÷ total tickets for 2026.

✅ **Available.** `core.ticket.start_date` / `end_date` (NULL end_date = still open) are exactly what's needed, and `AnalyticsRepository.open_ticket_ages_days()` + `bucket_for_age()` already implement age-bucketing — just at different boundaries (0-3 / 4-7 / 8-15 / >15 days) than your ">2 weeks" (14-day) cutoff, and without a year filter on the denominator. Needs a new query, not new data.

---

## 5. Cost breakdown by process

**Your formula:** `(license cost 2026 for that process's VM ÷ count of processes on that VM) + (AMS 1L annual cost 2026 ÷ total process count) + Σ(2L ticket costs for that process, 2026)`

| Piece | Status | Notes |
|---|---|---|
| Process → VM mapping | ✅ Available, one caveat | `core.process_schedule.virtual_machine_id` (nullable FK to `virtual_machine`). Works for the "count processes per VM" step. Caveat: it's nullable (a schedule row can have no VM), and as noted in §3, a process isn't guaranteed to map to exactly one VM at the DB level — worth a quick check of the real data for how often either edge case actually occurs before trusting the split. |
| License cost per VM, 2026 | ✅ Available, and a good fit | `core.license_cost(year, virtual_machine_id, cost_year_eur)` is already keyed exactly this way (unique per year+VM) — this is the cleanest part of the whole request, no changes needed. |
| AMS 1L annual cost 2026 ÷ total processes | ❌ Blocked by the same AMS-year gap as §1 | Same root cause: `ams_1l_cost` can't be filtered by calendar year 2026 today, only by relative contract-year ordinal. Once `ams_year.year` is populated, this becomes a straightforward query. Total process count itself (`COUNT(core.process)`) is trivially available. 
MY_REIVEW: see my commend above

|
| Σ 2L ticket cost per process, 2026 | ✅ Available, with one decision to make | `core.ams_2l_cost.cost_per_ticket_eur` joined to `ticket.process_id`. Two candidate date fields exist for "which year a 2L cost belongs to": `ticket.start_date` (when the ticket was opened) and `ams_2l_cost.closed_date` (when the 2L cost row was closed/booked) — these can disagree for tickets that span a year boundary. Not a data gap, just needs an explicit choice. |

Worth noting explicitly: `backend/app/services/executive.py`'s current design *deliberately* refuses to allocate AMS 1L / license cost to a process or company, with the documented reason *"AMS 1L and license costs are portfolio-level with no documented per-process or per-company allocation rule."* Your formula above **is** that allocation rule (VM-proportional for licenses, process-count-proportional for AMS 1L). That's a genuine, welcome resolution of a previously-open limitation — once the AMS-year gap is fixed, this section can replace several `unavailable_metric(...)` results with real numbers.

---

## Consolidated punch list

**Schema changes needed (new tables/columns):**
1. Populate `core.ams_year.year` (calendar year) during ingestion — currently always `NULL`. Blocks header AMS cost, and the AMS-1L part of cost-breakdown-by-process.
2. Promote AMS RFC from `staging.ams_rfc` (raw JSONB) to a typed `core` table with at least `year`/`date` and `cost_eur` — needs the real sheet's columns confirmed first, since today it has no required-columns contract at all.
3. New VM running-cost table (e.g. `core.vm_cost(year, virtual_machine_id, cost_eur)`), zero-filled 2020–2026 — you already own this action item.
4. New `time_slot` label column on `core.process_schedule` (enum-like, default `'morning'`) — you already own this action item.

**No schema change needed, only new service/repo queries:**
- Per-calendar-year (not "recent N years") sums for `license_cost` and — once (1) above lands — `ams_1l_cost`.
- 2L ticket count × flat rate, filtered by year, alongside (not replacing) the existing actual-cost aggregation.
- Root-cause % restricted to `ticket_type != 'Service Request'` and a given year.
- Backlog aging with a 14-day cutoff and a year-scoped denominator instead of the current 3/7/15-day buckets.
- Process-level cost breakdown joining `process_schedule` → `license_cost` (by VM+year) and `ticket` → `ams_2l_cost` (by process).
- Process count and VM count exposed as "DB count" / infra stat-line values.

**Decisions to confirm with you before implementation:**
- The `1st/2nd/3rd` AMS contract year → calendar year mapping (e.g., does "1st AMS year" = 2024 for every process, or does it float per process based on go-live date?).
- Which date field defines "2L ticket belongs to year 2026" — `ticket.start_date` or `ams_2l_cost.closed_date`.

==> MY_REVIEW: use the start date, the end date may be black.

- What to do when a process has zero or >1 VM in `process_schedule` for the cost-breakdown split.
==> if zero, then consider zero license cost. if > 1 , then use the first one that the array return, i dont care much.

- Confirm the real AMS RFC sheet's column names before modeling `core.ams_rfc` (source is `staging.ams_rfc.raw_row`, currently unvalidated).
==> MY_REVIEW: You will create it, so confirm it your self.