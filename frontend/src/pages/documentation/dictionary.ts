/**
 * Data Dictionary & Methodology — the single reference for every metric and
 * cost component in the Automation Hub portal.
 *
 * Hand-authored from the backend services and repository queries
 * (`app/services/*`, `app/repositories/analytics.py`, `app/services/sla_config.py`,
 * `app/services/idea_scoring.py`). Keep an entry's `technical` field in step with
 * the formula in code when either changes.
 */

export interface DictionaryEntry {
  /** Stable slug, unique across the whole dictionary. */
  id: string
  /** Human-facing field / metric name. */
  name: string
  /** Where the same number is shown in the portal, phrased as the user sees it. */
  dashboardRef?: string
  /** Unit shown next to the value (EUR, %, count, …). */
  unit?: string
  /** One short sentence: what this means for the business. */
  definition: string
  /** Where the raw numbers come from, in plain words. */
  source: string
  /** How the number is worked out, in plain words — no code. */
  calculation: string
  /** Optional: the exact formula with real column / variable names and rounding. */
  technical?: string
}

export interface DictionaryCategory {
  id: string
  title: string
  blurb: string
  entries: DictionaryEntry[]
}

export const DICTIONARY: DictionaryCategory[] = [
  {
    id: 'program-economics',
    title: 'Program Economics',
    blurb:
      'Portfolio-level savings, spend and return. Shown on the Executive dashboard.',
    entries: [
      {
        id: 'kpi_annual_saving_eur',
        name: 'Annual saving',
        dashboardRef: 'Executive → "Annual saving" KPI',
        unit: 'EUR / year',
        definition:
          'The labour cost avoided in a full year by the automations running today.',
        source:
          'Automated hours per month recorded for each process, plus the standard cost of one FTE hour.',
        calculation:
          'Add up the automated hours per month across all processes, annualise (× 12), and multiply by the standard FTE hourly rate.',
        technical:
          'cost_per_hour_FTE × Σ(process_economics.fte_hours_month_actual) × 12. cost_per_hour_FTE is read from core.reference_variable; returns 0 if it is missing. A company filter joins process → company.',
      },
      {
        id: 'kpi_total_saved_to_date_eur',
        name: 'Total saved to date',
        dashboardRef: 'Executive → "Total saved to date" KPI',
        unit: 'EUR',
        definition:
          'Cumulative labour cost avoided since each automation went live.',
        source:
          'Per-process annual saving, spread forward from each process’s go-live month.',
        calculation:
          'For every process, accrue its saving month by month from go-live onwards, then take the running total up to the latest month.',
        technical:
          'Last point of the saving-by-month series: a cumulative sum of (cost_per_hour_FTE × fte_hours_month_actual × 12), bucketed by month(process.go_live_date) (annual_saving_contribution_by_month).',
      },
      {
        id: 'kpi_total_spend_to_date_eur',
        name: 'Total spent to date',
        dashboardRef: 'Executive → "Total spent to date" KPI',
        unit: 'EUR',
        definition:
          'Every euro the RPA programme has spent so far — one-time build plus ongoing run.',
        source:
          'The portfolio cost ledger (core.tco_cost): every CAPEX and OPEX line item, dated.',
        calculation: 'Add every cost line in the ledger, across all years.',
        technical:
          'Σ over years of (tco_cost CAPEX total + OPEX total). Becomes unavailable when a company filter is applied — the ledger is portfolio-level with no per-company allocation rule.',
      },
      {
        id: 'kpi_net_position_eur',
        name: 'Net position',
        dashboardRef: 'Executive → "Net position" KPI (green when positive)',
        unit: 'EUR',
        definition:
          'Where the programme stands overall: everything saved minus everything spent.',
        source: 'The "Total saved to date" and "Total spent to date" figures.',
        calculation:
          'Total saved to date minus total spent to date. A positive number means the programme has more than paid for itself.',
        technical: 'total_saved_to_date − total_spend_to_date.',
      },
      {
        id: 'kpi_roi_multiple',
        name: 'ROI multiple',
        dashboardRef: 'Executive → "ROI multiple" KPI',
        unit: 'ratio (×)',
        definition: 'Euros saved for every euro spent, to date.',
        source: 'The "Total saved to date" and "Total spent to date" figures.',
        calculation: 'Total saved to date divided by total spent to date.',
        technical:
          'total_saved_to_date / total_spend_to_date, rounded to 2 decimals. Unavailable if spend to date is 0.',
      },
      {
        id: 'kpi_payback_year',
        name: 'Portfolio payback year',
        dashboardRef: 'Executive → "Portfolio payback year" KPI',
        unit: 'year',
        definition:
          'The year cumulative savings overtook cumulative spend — and never fell behind again.',
        source:
          'The yearly cumulative-spend curve (from the TCO trend) against the yearly cumulative-savings curve (from the go-live ramp).',
        calculation:
          'Walk the year-by-year savings-vs-spend curve backwards from the most recent year. The earliest year from which savings stayed at or above spend through to today is the payback year.',
        technical:
          'From savings_payback_trend(): iterate reversed(rows), stop at the first year where cumulative_saving < cumulative_spend; the last year still in surplus is the payback year. Unavailable if savings never overtook spend.',
      },
      {
        id: 'kpi_fte_freed',
        name: 'FTE-equivalent freed',
        dashboardRef: 'Executive → "FTE-equivalent freed" KPI',
        unit: 'FTE',
        definition: 'The automated workload expressed as full-time people.',
        source: 'Automated hours per month recorded for each process.',
        calculation:
          'Total automated hours per month divided by the hours one full-time employee works in a month (160 = 8h × 20 days).',
        technical:
          'Σ(process_economics.fte_hours_month_actual) / 160, rounded to 1 decimal.',
      },
      {
        id: 'kpi_total_capex_eur',
        name: 'Total CAPEX',
        dashboardRef: 'Executive economics (build investment)',
        unit: 'EUR',
        definition:
          'The one-time build cost of every automation in the portfolio.',
        source:
          'The CAPEX figure recorded per process (core.process_economics).',
        calculation: 'Add the build cost of every process.',
        technical:
          'Σ(process_economics.capex_eur). A company filter joins process → company.',
      },
      {
        id: 'kpi_total_tickets',
        name: 'Total tickets',
        dashboardRef: 'Executive & Operations (ticket count)',
        unit: 'count',
        definition:
          'The number of support tickets recorded against automations.',
        source: 'core.ticket.',
        calculation: 'Count every ticket, optionally filtered by company.',
        technical: 'COUNT(ticket); a company filter joins ticket → company.',
      },
      {
        id: 'company_roi_1_5y_pct',
        name: 'Company ROI (1.5 years)',
        dashboardRef: 'Executive → company summary table',
        unit: '%',
        definition:
          'Expected return for a company assuming 1.5 years of savings against its build cost.',
        source: 'Per-company annual saving and CAPEX.',
        calculation:
          'One-and-a-half years of the company’s annual saving, minus its build cost, divided by its build cost.',
        technical:
          '(annual_saving × 1.5 − capex) / capex, as a percentage. Null when the company’s CAPEX is 0.',
      },
      {
        id: 'exec_process_annual_saving_eur',
        name: 'Process annual saving',
        dashboardRef: 'Executive → Process ROI table',
        unit: 'EUR / year',
        definition: 'The yearly labour cost a single automation avoids.',
        source:
          'That process’s automated hours per month and the FTE hourly rate.',
        calculation:
          'Automated hours per month for the process × 12 × the standard FTE hourly rate.',
        technical:
          'cost_per_hour_FTE × process_economics.fte_hours_month_actual × 12.',
      },
      {
        id: 'exec_process_payback_months',
        name: 'Process payback (months)',
        dashboardRef: 'Executive → Process ROI table',
        unit: 'months',
        definition:
          'How long a process takes to repay its build cost from its own savings.',
        source: 'That process’s CAPEX and annual saving.',
        calculation: 'Build cost divided by one month of saving.',
        technical:
          'capex_eur / (annual_saving / 12), rounded to 3 decimals. Null when annual saving ≤ 0.',
      },
      {
        id: 'exec_process_cumulative_saving_eur',
        name: 'Cumulative saving since go-live',
        dashboardRef: 'Executive → Process ROI table',
        unit: 'EUR',
        definition: 'What a process has saved in total since it went live.',
        source: 'That process’s annual saving and its go-live date.',
        calculation:
          'One month of saving × the number of whole months since go-live.',
        technical:
          '(annual_saving / 12) × months_elapsed(go_live_date, as_of). months_elapsed counts whole calendar months and never goes negative.',
      },
      {
        id: 'exec_process_expected_roi_pct',
        name: 'Expected ROI %',
        dashboardRef: 'Executive → Process ROI table',
        unit: '%',
        definition:
          'The return a process was expected to deliver over its planned payback horizon.',
        source: 'That process’s annual saving, CAPEX and expected-ROI year.',
        calculation:
          'Annual saving × the number of expected years, minus build cost, divided by build cost.',
        technical:
          '(annual_saving × roi_expected_yr − capex) / capex, as a percentage. Shown only when process_economics.roi_expected_yr is set.',
      },
      {
        id: 'exec_process_actual_roi_pct',
        name: 'Actual ROI %',
        dashboardRef: 'Executive → Process ROI table (sort default)',
        unit: '%',
        definition: 'The return a process has actually delivered so far.',
        source: 'That process’s cumulative saving since go-live and its CAPEX.',
        calculation:
          'Cumulative saving so far minus build cost, divided by build cost.',
        technical:
          '(cumulative_saving_since_go_live − capex) / capex, as a percentage.',
      },
      {
        id: 'exec_tco_capex_by_year',
        name: 'CAPEX by year',
        dashboardRef: 'Executive → TCO & ROI chart (build bars)',
        unit: 'EUR',
        definition: 'One-time build spend booked in each calendar year.',
        source: 'The portfolio cost ledger (core.tco_cost), CAPEX lines only.',
        calculation: 'Add all CAPEX lines dated within the year.',
        technical:
          "SUM(tco_cost.cost_eur) WHERE cost_type = 'CAPEX', grouped by year(cost_date).",
      },
      {
        id: 'exec_tco_opex_by_year',
        name: 'OPEX by year',
        dashboardRef: 'Executive → TCO & ROI chart (run bars)',
        unit: 'EUR',
        definition:
          'Ongoing run / maintenance spend booked in each calendar year.',
        source: 'The portfolio cost ledger (core.tco_cost), OPEX lines only.',
        calculation: 'Add all OPEX lines dated within the year.',
        technical:
          "SUM(tco_cost.cost_eur) WHERE cost_type = 'OPEX', grouped by year(cost_date).",
      },
      {
        id: 'exec_tco_opex_subtype',
        name: 'OPEX breakdown by subtype',
        dashboardRef: 'Executive → TCO & ROI detail table',
        unit: 'EUR',
        definition:
          'The run spend for a year split by kind — AMS, change requests, licences, infrastructure, …',
        source:
          'The subtype tag on each OPEX line in the cost ledger (core.tco_cost.subtype).',
        calculation:
          'Within a year, add the OPEX lines under each subtype tag separately.',
        technical:
          "SUM(tco_cost.cost_eur) WHERE cost_type = 'OPEX', grouped by (year, COALESCE(subtype, 'OTHER')).",
      },
      {
        id: 'exec_tco_net_benefit',
        name: 'Net benefit (per year)',
        dashboardRef: 'Executive → TCO & ROI chart (net line)',
        unit: 'EUR',
        definition:
          'For a given year: cumulative savings so far, minus that year’s own spend.',
        source:
          'Cumulative FTE-based savings and that year’s CAPEX + OPEX from the ledger.',
        calculation:
          'Total savings accrued up to that year, minus the CAPEX and OPEX booked in that year (not cumulative spend).',
        technical:
          'cumulative_saving(up to year) − (capex[year] + opex[year]).',
      },
      {
        id: 'exec_build_run_split',
        name: 'Build vs Run split',
        dashboardRef: 'Executive → spend-mix tags ("Build 42% · Run 58%")',
        unit: '%',
        definition:
          'How total spend to date divides between one-time build and ongoing run.',
        source: 'All CAPEX and all OPEX lines in the cost ledger.',
        calculation: 'Total CAPEX as a share of total spend; the rest is Run.',
        technical: 'ΣCAPEX / (ΣCAPEX + ΣOPEX) across every ledger year.',
      },
    ],
  },
  {
    id: 'running-costs',
    title: 'Running Costs',
    blurb:
      'What it costs to keep the automation estate running each year. Shown on the Operations dashboard.',
    entries: [
      {
        id: 'kpi_total_running_cost_eur',
        name: 'Total running cost',
        dashboardRef: 'Operations → "Total running cost" hero KPI',
        unit: 'EUR / year',
        definition:
          'The all-in yearly cost of keeping the automation estate running.',
        source:
          'Licence, infrastructure, AMS 1L, 2L-ticket and change-request costs for the year.',
        calculation:
          'Licences + infrastructure + AMS 1L fee + (2L tickets opened that year × €500) + change requests, all for the same year.',
        technical:
          'license_eur(Y) + infra_eur(Y) + ams_1l_eur(Y) + (2L tickets opened in Y × €500) + Σ ams_rfc_cost(Y). Follows docs/dashboard_costi_running_rpa_data_assessment.md.',
      },
      {
        id: 'kpi_total_running_cost_delta_pct',
        name: 'Total running cost — change vs last year',
        dashboardRef: 'Operations → hero KPI sub-line',
        unit: '%',
        definition: 'How this year’s running cost compares with last year’s.',
        source: 'This year’s and last year’s total running cost.',
        calculation:
          'Difference between the two years divided by last year’s figure.',
        technical:
          '(total_eur[Y] − total_eur[Y−1]) / total_eur[Y−1], as a percentage. Unavailable when there is no prior-year data.',
      },
      {
        id: 'kpi_license_cost_eur',
        name: 'Licences (Blue Prism)',
        dashboardRef: 'Operations → "Blue Prism licences" KPI',
        unit: 'EUR / year',
        definition: 'The annual licence cost of the automation runtime.',
        source:
          'core.license_cost — one figure per calendar year per virtual machine.',
        calculation: 'Add the licence cost of every VM for that year.',
        technical: 'SUM(license_cost.cost_year_eur) WHERE year = Y.',
      },
      {
        id: 'kpi_licensed_vm_count',
        name: 'Licensed VM count',
        dashboardRef: 'Operations → "Blue Prism licences" KPI sub-line',
        unit: 'count',
        definition: 'How many machines carry a runtime licence this year.',
        source: 'core.license_cost.',
        calculation:
          'Count the distinct machines with a licence line for the year.',
        technical:
          'COUNT(DISTINCT license_cost.virtual_machine_id) WHERE year = Y.',
      },
      {
        id: 'kpi_infrastructure_cost_eur',
        name: 'Infrastructure',
        dashboardRef: 'Operations → "Infrastructure" KPI',
        unit: 'EUR / year',
        definition:
          'The annual server / VM hosting cost, separate from licences.',
        source:
          'core.vm_cost — one figure per calendar year per virtual machine.',
        calculation: 'Add the hosting cost of every VM for that year.',
        technical:
          'SUM(vm_cost.cost_eur) WHERE year = Y. Currently seeded at €0 pending real figures from the infrastructure team — the dashboard flags this as "indicative opex" when every point is 0.',
      },
      {
        id: 'kpi_ams_1l_cost_eur',
        name: 'AMS 1L',
        dashboardRef: 'Operations → "AMS 1L" KPI',
        unit: 'EUR / year',
        definition:
          'The fixed annual fee for first-level application maintenance & support.',
        source: 'core.ams_1l_cost — the annual fee for each AMS contract year.',
        calculation: 'Take the AMS 1L annual fee for that calendar year.',
        technical:
          'ams_1l_cost.annual_fee_eur, matched to the year via ams_year.year. ams_1l_cost.n_processes_baseline records the process count the fee assumed.',
      },
      {
        id: 'kpi_ticket_2l_cost_eur',
        name: '2L tickets',
        dashboardRef: 'Operations → "2L tickets" KPI',
        unit: 'EUR / year',
        definition:
          'The estimated cost of second-level (deep) support for the year, at a flat rate per ticket.',
        source:
          'core.ticket — second-level tickets (is_1l = false), counted by the date they were opened.',
        calculation: 'Number of 2L tickets opened in the year × €500.',
        technical:
          'COUNT(ticket WHERE is_1l = false AND year(start_date) = Y) × 500. A flat-rate estimate — actual per-ticket 2L cost is used instead in the per-process breakdown.',
      },
      {
        id: 'kpi_ticket_2l_count',
        name: '2L ticket count',
        dashboardRef: 'Operations → "2L tickets" KPI sub-line',
        unit: 'count',
        definition: 'How many second-level tickets were opened in the year.',
        source: 'core.ticket (is_1l = false), by open date.',
        calculation: 'Count 2L tickets with an open date inside the year.',
        technical:
          'COUNT(ticket) WHERE is_1l = false AND year(start_date) = Y.',
      },
      {
        id: 'kpi_ticket_2l_cost_delta_pct',
        name: '2L tickets — change vs last year',
        dashboardRef: 'Operations → "2L tickets" KPI sub-line',
        unit: '%',
        definition:
          'How 2L-ticket cost compares with last year — using the same elapsed period when the year is only part-done.',
        source: '2L ticket counts for the current and prior year.',
        calculation:
          'Normally this year vs all of last year. While the current year is still in progress, it compares 1 January–today against the same window last year, so a part-year is not judged against a full one.',
        technical:
          'Full year: (count[Y] − count[Y−1]) / count[Y−1]. Partial year: (count[Jan 1..as_of] − count[Jan 1..as_of, prior year]) / prior. The flat €500 rate cancels, so the delta is a pure count ratio.',
      },
      {
        id: 'kpi_change_request_cost_eur',
        name: 'Change Request',
        dashboardRef: 'Operations → "Change Request" KPI',
        unit: 'EUR / year',
        definition:
          'The cost of AMS change requests / amendments (RFCs) booked in the year.',
        source:
          'core.ams_rfc_cost — a curated ledger of RFCs with reference, year, cost and effort.',
        calculation: 'Add the cost of every RFC dated in the year.',
        technical:
          'SUM(ams_rfc_cost.cost_eur) WHERE year = Y. ams_rfc_cost.man_days records the effort per RFC.',
      },
      {
        id: 'kpi_change_request_count',
        name: 'Change Request count',
        dashboardRef: 'Operations → "Change Request" KPI sub-line',
        unit: 'count',
        definition: 'How many AMS RFCs were handled in the year.',
        source: 'core.ams_rfc_cost.',
        calculation: 'Count the RFC rows dated in the year.',
        technical: 'COUNT(ams_rfc_cost.id) WHERE year = Y.',
      },
      {
        id: 'kpi_avg_cost_per_process_eur',
        name: 'Average cost per process',
        dashboardRef: 'Operations → "Cost breakdown by process" heading stat',
        unit: 'EUR / year',
        definition: 'Total running cost shared evenly across every automation.',
        source: 'Total running cost for the year and the process count.',
        calculation: 'Total running cost divided by the number of processes.',
        technical:
          'total_eur(Y) / process_count. Unavailable when there are no processes.',
      },
      {
        id: 'kpi_process_count',
        name: 'Process count',
        dashboardRef: 'Operations → hero KPI sub-line ("across N processes")',
        unit: 'count',
        definition: 'How many automations exist in the catalogue.',
        source: 'core.process.',
        calculation: 'Count every process row.',
        technical: 'COUNT(process.id).',
      },
      {
        id: 'running_cost_trend_components',
        name: 'Running-cost trend components',
        dashboardRef: 'Operations → "Total running cost trend" chart',
        unit: 'EUR',
        definition:
          'The five cost components (licences, infrastructure, AMS 1L, 2L tickets, change requests) and their total, for every year with data.',
        source:
          'The same component queries as the header KPIs (license_cost, vm_cost, ams_1l_cost, 2L ticket count × €500, ams_rfc_cost).',
        calculation:
          'For each year that any component has data, compute all five components and their sum. No forward-looking estimates — real data only.',
        technical:
          'Per year in cost_years(): {license_eur, infrastructure_eur, ams_1l_eur, ticket_2l_eur, change_request_eur, total_eur}. cost_years() is the union of every year appearing in licences, VM cost, RFCs, AMS 1L or 2L tickets.',
      },
      {
        id: 'process_cost_license_share',
        name: 'Per-process licence share',
        dashboardRef:
          'Operations → "Cost breakdown by process" (Licence segment)',
        unit: 'EUR / year',
        definition:
          'A process’s slice of the licence cost of the machine it runs on.',
        source:
          'Licence cost for the process’s VM and year, and how many processes share that VM.',
        calculation:
          'Licence cost of that VM for the year, divided by the number of processes assigned to that VM.',
        technical:
          'license_cost(vm, Y) / count(processes on vm). A process is "on" the VM named in its first process_schedule row (ordered by id); no schedule row or no VM → €0.',
      },
      {
        id: 'process_cost_infra_share',
        name: 'Per-process infrastructure share',
        dashboardRef:
          'Operations → "Cost breakdown by process" (Infrastructure segment)',
        unit: 'EUR / year',
        definition:
          'A process’s slice of the hosting cost of the machine it runs on.',
        source:
          'VM hosting cost for the process’s VM and year, and how many processes share that VM.',
        calculation:
          'Hosting cost of that VM for the year, divided by the number of processes assigned to that VM.',
        technical:
          'vm_cost(vm, Y) / count(processes on vm). Same VM-assignment rule as the licence share.',
      },
      {
        id: 'process_cost_ams_1l_share',
        name: 'Per-process AMS 1L share',
        dashboardRef:
          'Operations → "Cost breakdown by process" (AMS 1L segment)',
        unit: 'EUR / year',
        definition:
          'Each process carries an equal slice of the fixed AMS 1L fee.',
        source:
          'The AMS 1L annual fee for the year and the total process count.',
        calculation:
          'AMS 1L annual fee divided by the number of processes — the same amount for every process.',
        technical: 'ams_1l_cost.annual_fee_eur(Y) / process_count.',
      },
      {
        id: 'process_cost_2l_actual',
        name: 'Per-process 2L cost (actual)',
        dashboardRef:
          'Operations → "Cost breakdown by process" (2L tickets segment)',
        unit: 'EUR / year',
        definition:
          'The real second-level support cost booked against a process’s tickets that year.',
        source:
          'core.ams_2l_cost.cost_per_ticket_eur, joined to tickets by process, for tickets opened in the year.',
        calculation:
          'Add the actual 2L cost of every ticket for that process opened during the year. This uses real amounts, not the flat €500 rate.',
        technical:
          'Σ(ams_2l_cost.cost_per_ticket_eur) for tickets of that process WHERE year(ticket.start_date) = Y. A ticket can have several 2L cost rows.',
      },
      {
        id: 'process_cost_total',
        name: 'Per-process total running cost',
        dashboardRef: 'Operations → "Cost breakdown by process" (row total)',
        unit: 'EUR / year',
        definition: 'Everything it costs to run one automation for the year.',
        source: 'The four per-process components above.',
        calculation:
          'Licence share + infrastructure share + AMS 1L share + actual 2L cost.',
        technical: 'license_eur + infrastructure_eur + ams_1l_eur + l2_eur.',
      },
      {
        id: 'infra_vm_count',
        name: 'VM count',
        dashboardRef: 'Operations → Infrastructure stat-line',
        unit: 'count',
        definition: 'How many virtual machines are in the automation fleet.',
        source: 'core.virtual_machine.',
        calculation: 'Count every VM row.',
        technical: 'COUNT(virtual_machine.id).',
      },
      {
        id: 'infra_db_count',
        name: 'Database count',
        dashboardRef: 'Operations → Infrastructure stat-line',
        unit: 'count',
        definition:
          'Number of databases in the estate — reported as the process count.',
        source: 'core.process (aliased as "DB count" for this stat-line).',
        calculation: 'Count every process row.',
        technical: 'COUNT(process.id), presented as "Database count".',
      },
      {
        id: 'occupancy_heatmap',
        name: 'Machine occupancy by time slot',
        dashboardRef: 'Operations → occupancy heatmap',
        unit: 'count (shaded by intensity)',
        definition:
          'How many scheduled process runs fall on each machine in each 4-hour slot of the day.',
        source:
          'core.process_schedule — its virtual_machine_id and its time_slot label (night, early morning, morning, afternoon, evening, late evening).',
        calculation:
          'For each machine and slot, count the scheduled processes. Cell shading is that count relative to the busiest cell.',
        technical:
          'COUNT(process_schedule.id) grouped by (virtual_machine, time_slot); intensity = round(count / max_count × 100). time_slot currently defaults to "morning" for every row, so the heatmap is degenerate until real values are back-filled.',
      },
    ],
  },
  {
    id: 'ams-operations',
    title: 'AMS Operations',
    blurb:
      'Ticket volume, resolution speed and support-tier mix for the maintenance service (operations API).',
    entries: [
      {
        id: 'ops_open_backlog',
        name: 'Open backlog',
        dashboardRef: 'Operations metrics → open ticket count',
        unit: 'count',
        definition: 'Tickets still open (no closure date).',
        source: 'core.ticket — rows with no end_date.',
        calculation: 'Total tickets minus closed tickets.',
        technical: 'COUNT(ticket) − COUNT(ticket.end_date).',
      },
      {
        id: 'ops_l1_l2_tickets',
        name: 'L1 / L2 ticket counts',
        dashboardRef: 'Operations & SLA / KPI → support-tier split',
        unit: 'count',
        definition:
          'Tickets handled at first level (L1) versus escalated to second level (L2).',
        source: 'core.ticket.is_1l (true = L1, false = L2).',
        calculation: 'Count tickets in each tier.',
        technical:
          'COUNT(ticket) FILTER (is_1l = true) and FILTER (is_1l = false).',
      },
      {
        id: 'ops_l1_ratio',
        name: 'L1 ratio',
        dashboardRef: 'SLA / KPI → "L1 / L2 Ratio" KPI (target ≥ 80%)',
        unit: 'ratio / %',
        definition:
          'Share of tickets resolved at first level without escalation — higher is better.',
        source: 'core.ticket.is_1l.',
        calculation: 'L1 tickets divided by all tickets.',
        technical:
          'COUNT(is_1l = true) / COUNT(*). On the Operations metrics it is a 0–1 ratio (4 dp); on SLA / KPI it is a percentage scoped to the selected year, with a target of ≥ 80%.',
      },
      {
        id: 'ops_resolution_days',
        name: 'Resolution time — average / median / P90',
        dashboardRef: 'Operations & SLA / KPI → resolution stats',
        unit: 'days',
        definition:
          'How long closed tickets took from open to close — the typical case (average, median) and the slow tail (P90).',
        source:
          'core.ticket.start_date and end_date for closed tickets with both dates.',
        calculation:
          'For every closed ticket, the number of days between open and close; then the average, the middle value (median) and the 90th-percentile value.',
        technical:
          'days = end_date − start_date (PostgreSQL date subtraction → integer days). avg = AVG(days); median = percentile_cont(0.5); P90 = percentile_cont(0.9). Only tickets with both dates.',
      },
      {
        id: 'ops_sla_proxy_le_3d',
        name: 'SLA proxy — resolved ≤ 3 days',
        dashboardRef: 'Operations metrics → SLA proxy %',
        unit: '%',
        definition:
          'A rough on-time measure: the share of closed tickets resolved within three days.',
        source: 'core.ticket open/close dates for closed tickets.',
        calculation:
          'Closed tickets resolved in 3 days or fewer, divided by all closed tickets with dates.',
        technical:
          'COUNT(days ≤ 3) / COUNT(closed with dates). The breach % is 1 − that. A coarse proxy — the SLA / KPI page uses per-priority targets instead.',
      },
      {
        id: 'ops_cost_per_ticket',
        name: 'Cost per ticket',
        dashboardRef: 'Operations metrics → cost per ticket',
        unit: 'EUR',
        definition: 'The blended support cost carried by each ticket.',
        source:
          '3-year AMS 1L cost, total actual AMS 2L cost, and 3-year licence cost.',
        calculation:
          'Add those three running-cost pools and divide by the total number of tickets.',
        technical:
          '(ams_1l_cost_3y + ams_2l_cost_total + license_cost_3y) / COUNT(ticket). Unavailable when there are no tickets.',
      },
      {
        id: 'ops_l2_cost_per_ticket',
        name: 'L2 cost per ticket',
        dashboardRef: 'Operations metrics → L2 cost per ticket',
        unit: 'EUR',
        definition: 'The average actual cost of a second-level ticket.',
        source:
          'core.ams_2l_cost.cost_per_ticket_eur and the count of distinct 2L-costed tickets.',
        calculation:
          'Total actual 2L cost divided by the number of tickets that incurred a 2L cost.',
        technical:
          'SUM(ams_2l_cost.cost_per_ticket_eur) / COUNT(DISTINCT ams_2l_cost.ticket_id). Unavailable when no ticket has a 2L cost.',
      },
      {
        id: 'ops_root_cause_pareto',
        name: 'Root-cause pareto',
        dashboardRef: 'Operations & SLA / KPI → root-cause bars',
        unit: 'count',
        definition:
          'Which root causes drive the most tickets, most-frequent first.',
        source: 'core.ticket.root_cause_id → core.root_cause.name.',
        calculation:
          'Count tickets per root cause and sort by count, descending.',
        technical:
          'COUNT(ticket) grouped by root_cause.name, ORDER BY count DESC. Tickets with no root cause are shown as "unclassified" where the year-scoped breakdown is used.',
      },
      {
        id: 'ops_top_processes',
        name: 'Top processes by ticket volume',
        dashboardRef: 'Operations metrics → top-processes list',
        unit: 'count',
        definition: 'The automations that generate the most support tickets.',
        source: 'core.ticket.process_id → core.process.canonical_name.',
        calculation:
          'Count tickets per process and take the highest (default: top 10).',
        technical:
          'COUNT(ticket) grouped by process.canonical_name, ORDER BY count DESC, LIMIT n.',
      },
      {
        id: 'ops_avg_resolution_by',
        name: 'Average resolution time by root cause / process / company',
        dashboardRef: 'SLA / KPI → "Avg resolution time by root cause"',
        unit: 'days',
        definition: 'Where resolution time is being spent, grouped three ways.',
        source:
          'Closed tickets with both dates, joined to root cause, process or company.',
        calculation: 'Average open-to-close days within each group.',
        technical:
          'AVG(end_date − start_date) grouped by root_cause.name / process.canonical_name / company.name.',
      },
      {
        id: 'ops_backlog_aging_buckets',
        name: 'Backlog aging buckets',
        dashboardRef: 'SLA / KPI → backlog aging (0-3 / 4-7 / 8-15 / >15 days)',
        unit: 'count',
        definition: 'How long the currently-open tickets have been waiting.',
        source:
          'core.ticket — open tickets (no end_date) with a start_date, aged against today.',
        calculation:
          'For each open ticket, days since it opened; then count into four buckets: 0–3, 4–7, 8–15, over 15 days.',
        technical:
          'age_days = as_of − start_date; bucket_for_age(): ≤3 → 0_3, ≤7 → 4_7, ≤15 → 8_15, else over_15. Shared with the Operations and Service-Performance domains.',
      },
      {
        id: 'ops_tickets_by_month',
        name: 'Tickets by month',
        dashboardRef: 'SLA / KPI & Executive → ticket-volume trend',
        unit: 'count',
        definition: 'Ticket intake over time.',
        source: 'core.ticket.start_date.',
        calculation: 'Count tickets by the month they were opened.',
        technical: "COUNT(ticket) grouped by to_char(start_date, 'YYYY-MM').",
      },
    ],
  },
  {
    id: 'service-sla',
    title: 'Service & SLA / KPI',
    blurb:
      'Contractual service levels, repair-time attainment, and the four managed KPIs. Shown on the SLA / KPI dashboard.',
    entries: [
      {
        id: 'sla_headline_attainment_pct',
        name: 'Resolution SLA attainment',
        dashboardRef: 'SLA / KPI → headline "Resolution SLA attainment" %',
        unit: '%',
        definition:
          'The share of closed tickets that were resolved within their contractual repair target.',
        source:
          'Closed tickets for the year, each with its ticket type and Einstein priority; targets from the AMS 1L contract (sla_config).',
        calculation:
          'For every closed ticket, check whether open-to-close days met that ticket’s repair target (which depends on incident vs service request and on priority). Attainment is the share that did.',
        technical:
          'within = (end_date − start_date) ≤ repair_target_days(type, einstein_priority); headline = Σwithin / Σclosed, as a percentage. Green ≥ 95%, amber ≥ 90%, else red.',
      },
      {
        id: 'sla_commitment_matrix',
        name: 'SLA commitment matrix',
        dashboardRef: 'SLA / KPI → contractual SLA table',
        unit: 'hours',
        definition:
          'The signed AMS 1L reaction and repair targets, by ticket type and priority band.',
        source: 'sla_config.SLA_TARGETS — the contract, as reference data.',
        calculation:
          'Einstein priority 0–1 → High, 2–3 → Medium, 4–5 → Low. Each (type, band) pair has a reaction and a repair target in hours.',
        technical:
          'Incident: High 1h/4h, Medium 2h/8h, Low 8h/16h. Service Request: High 8h/8h, Medium 16h/16h, Low 24h/32h. Every ticket in the warehouse currently carries priority 3 (Medium).',
      },
      {
        id: 'sla_repair_target_days',
        name: 'Repair target (days)',
        dashboardRef: 'SLA / KPI → contractual SLA table (day column)',
        unit: 'days',
        definition:
          'The contractual repair target converted to whole days, because tickets are dated but not timed.',
        source: 'The repair-hours target from the commitment matrix.',
        calculation:
          'Round the repair hours up to whole working days, assuming an 8-hour day (≤ 8h → 1 day, ≤ 16h → 2 days, ≤ 32h → 4 days). At least 1 day.',
        technical:
          'repair_target_days = max(1, ceil(repair_hours / 8)). For today’s all-priority-3 data: Incident = 1 day, Service Request = 2 days.',
      },
      {
        id: 'sla_reaction_time',
        name: 'Reaction-time SLA',
        dashboardRef: 'SLA / KPI → shown for reference only',
        unit: 'hours',
        definition:
          'The contractual first-response target — displayed but not measured.',
        source:
          'sla_config; there is no first-response timestamp in core.ticket.',
        calculation:
          'Not calculated. Source tickets carry no response time, so reaction-time attainment cannot be computed.',
        technical:
          'Reaction targets exist in SLA_TARGETS but no attainment is derived. See SLA_ATTAINMENT_CAVEAT.',
      },
      {
        id: 'sla_attainment_by_group',
        name: 'Attainment by type / band / month',
        dashboardRef: 'SLA / KPI → attainment breakdown + monthly trend',
        unit: '%',
        definition:
          'Repair-time attainment split by ticket type, priority band and month.',
        source: 'The same closed-ticket set as the headline number.',
        calculation:
          'Within each group, the share of closed tickets that met their repair target.',
        technical:
          'Per group: within_target / closed, as a percentage; breached = closed − within_target. Monthly trend is drawn against a 95% target line.',
      },
      {
        id: 'sla_open_past_target',
        name: 'Open past target',
        dashboardRef:
          'SLA / KPI → "Open past target — now" + oldest-open table',
        unit: 'count',
        definition: 'Open tickets that have already blown their repair target.',
        source:
          'Currently-open tickets, aged against today, versus each ticket’s repair target.',
        calculation:
          'For each open ticket, compare days-open with its repair target; list those over target, oldest first.',
        technical:
          'age_days = as_of − start_date; kept when age_days > repair_target_days(type, priority). Table shows up to 100.',
      },
      {
        id: 'kpi_rpa_internal_root_cause_pct',
        name: 'RPA Internal Root Causes',
        dashboardRef:
          'SLA / KPI → "RPA Internal Root Causes" KPI (target < 25%)',
        unit: '%',
        definition:
          'The share of incidents caused by the automation itself, rather than upstream systems or data.',
        source:
          "core.ticket for the year: root cause 'Problema Funzionale RPA', over all non-service-request tickets.",
        calculation:
          'Tickets with root cause "Problema Funzionale RPA" divided by all incident tickets (excluding service requests) for the year.',
        technical:
          "COUNT(root_cause = 'Problema Funzionale RPA') / COUNT(ticket WHERE ticket_type != 'Service Request'), for the selected year. Green < 25%.",
      },
      {
        id: 'kpi_backlog_aging_pct',
        name: 'Open Backlog Aging',
        dashboardRef: 'SLA / KPI → "Open Backlog Aging" KPI (target < 5%)',
        unit: '%',
        definition:
          'The share of the year’s tickets that are still open and now more than two weeks old.',
        source:
          'core.ticket for the year — open tickets (no end_date) older than 14 days.',
        calculation:
          'Open tickets from the year that are more than 14 days old, divided by all tickets opened that year.',
        technical:
          'COUNT(end_date IS NULL AND age_days > 14) / COUNT(ticket in year). Green < 5%.',
      },
      {
        id: 'kpi_median_resolution_days',
        name: 'Median Resolution Time (MTTR)',
        dashboardRef:
          'SLA / KPI → "Median Resolution Time (MTTR)" KPI (target < 1 day)',
        unit: 'days',
        definition: 'The typical time to resolve a ticket opened in the year.',
        source:
          'core.ticket open/close dates for tickets opened in the year and since closed.',
        calculation:
          'The middle value of open-to-close days across those tickets.',
        technical:
          'percentile_cont(0.5) WITHIN GROUP (end_date − start_date) for tickets with year(start_date) = Y and a valid end_date. Green < 1 day.',
      },
      {
        id: 'sla_compliance_pct',
        name: 'SLA compliance / breach (≤ 3-day proxy)',
        dashboardRef:
          'Service-performance metrics → compliance %, breach %, breach tickets',
        unit: '%',
        definition:
          'A programme-wide on-time proxy: closed tickets resolved within three days.',
        source:
          'core.ticket open/close dates for all closed tickets with dates.',
        calculation:
          'Compliance = share resolved in ≤ 3 days. Breach = the rest. Breach tickets = the count behind the breach %.',
        technical:
          'compliance = COUNT(days ≤ 3) / COUNT(closed with dates); breach_pct = 1 − compliance; breach_tickets = closed_with_dates − within_3_days.',
      },
      {
        id: 'sla_p90_resolution_days',
        name: 'P90 resolution time',
        dashboardRef: 'SLA / KPI → headline strip (P90)',
        unit: 'days',
        definition:
          'The slow-tail resolution time — 90% of tickets close faster than this.',
        source: 'Closed tickets with both dates.',
        calculation: 'The 90th-percentile of open-to-close days.',
        technical: 'percentile_cont(0.9) WITHIN GROUP (end_date − start_date).',
      },
      {
        id: 'dq_metrics',
        name: 'Data-quality metrics',
        dashboardRef: 'SLA / KPI → data-quality panel',
        unit: '%',
        definition:
          'How complete the ticket data is: the share of tickets missing a root cause, a process link, or a company.',
        source:
          'core.ticket — null checks on root_cause_id, process_id, company_id.',
        calculation:
          'Each metric is the count of tickets missing that field divided by all tickets.',
        technical:
          'dq_root_cause_not_classified_pct = COUNT(root_cause_id IS NULL) / COUNT(*); likewise for process_id and company_id. These sit next to the RPA-internal-root-cause KPI because null root causes weaken it.',
      },
      {
        id: 'sla_quality_breakdown',
        name: 'Root-cause & ticket-type breakdown (L1 / L2)',
        dashboardRef: 'SLA / KPI → quality breakdown',
        unit: '% / count',
        definition:
          'For each support tier: the root-cause mix (top 4 plus "Other") and the incident vs service-request split.',
        source:
          'core.ticket for the year, grouped by is_1l, root cause and ticket type.',
        calculation:
          'Within each tier, share of tickets per root cause (top 4, rest pooled as "Other"), and the incident / service-request percentages.',
        technical:
          'Per is_1l: root-cause counts → top 4 + "Other"; service_request_pct and incident_pct over (SR + Incident). Null root cause → "unclassified".',
      },
      {
        id: 'sla_observed_priorities',
        name: 'Observed priorities / bands',
        dashboardRef: 'SLA / KPI → shown beside the attainment number',
        unit: 'list',
        definition:
          'Which Einstein priorities and provider bands actually appear in the data — context for the attainment figure.',
        source: 'core.priority.value on the year’s closed tickets.',
        calculation:
          'The distinct priority values and their mapped bands seen in the ticket set.',
        technical:
          'Every warehouse ticket currently carries priority 3 (Medium), so attainment across bands only becomes meaningful once real priorities land.',
      },
    ],
  },
  {
    id: 'idea-scoring',
    title: 'Idea Scoring Engine',
    blurb:
      'The ROI, feasibility and classification computed when an automation idea is submitted through the wizard.',
    entries: [
      {
        id: 'idea_annual_transactions',
        name: 'Annual transactions',
        dashboardRef: 'Idea detail → scoring outputs',
        unit: 'count / year',
        definition: 'How many times the process runs in a year.',
        source:
          'Wizard inputs: task frequency and transaction volume per occurrence.',
        calculation:
          'Transaction volume multiplied by a factor for how often the task runs.',
        technical:
          'transaction_volume × frequency_factor, where Daily = 250, Weekly = 52, Monthly = 12, Quarterly = 4, Yearly = 1.',
      },
      {
        id: 'idea_base_hours',
        name: 'Base hours',
        dashboardRef: 'Idea detail → scoring outputs',
        unit: 'hours / year',
        definition:
          'The yearly hours spent doing the task itself, before rework.',
        source: 'Annual transactions and average handling time per task.',
        calculation: 'Annual transactions × minutes per task ÷ 60.',
        technical: '(annual_transactions × avg_time_per_task_minutes) / 60.',
      },
      {
        id: 'idea_rework_hours',
        name: 'Rework hours',
        dashboardRef: 'Idea detail → scoring outputs',
        unit: 'hours / year',
        definition: 'The yearly hours lost to fixing errors.',
        source: 'Annual transactions, the error rate, and average rework time.',
        calculation: 'Annual transactions × error rate × rework minutes ÷ 60.',
        technical:
          '(annual_transactions × (error_rate_pct / 100) × avg_rework_time_minutes) / 60. error_rate_pct is entered as a percentage.',
      },
      {
        id: 'idea_total_hours_saved',
        name: 'Total hours saved',
        dashboardRef: 'Idea detail → scoring outputs',
        unit: 'hours / year',
        definition: 'The full yearly effort the automation would remove.',
        source: 'Base hours and rework hours.',
        calculation: 'Base hours plus rework hours.',
        technical: 'base_hours + rework_hours.',
      },
      {
        id: 'idea_gross_roi_eur',
        name: 'Gross ROI',
        dashboardRef: 'Idea detail → scoring outputs; Ideas feasibility matrix',
        unit: 'EUR / year',
        definition: 'The yearly euro value of the effort saved.',
        source:
          'Total hours saved and the loaded FTE cost supplied in the wizard.',
        calculation:
          'Total hours saved × the hourly rate, where the hourly rate is the loaded annual FTE cost spread over a working year (2,000 hours).',
        technical: 'total_hours_saved × (avg_loaded_fte_cost_eur / (250 × 8)).',
      },
      {
        id: 'idea_feasibility_score',
        name: 'Feasibility score',
        dashboardRef:
          'Idea detail → scoring outputs; Ideas feasibility matrix (X axis)',
        unit: '0–100',
        definition: 'How readily the process can be automated — 100 is ideal.',
        source:
          'Wizard answers on process/system stability, decision logic, variations, interface and input format.',
        calculation:
          'Start at 100 and subtract a penalty for each hard-to-automate answer.',
        technical:
          'score = 100 − Σ penalties: major overhaul planned −30, platform migration planned −20, subjective judgment −25, 6+ custom paths −20, Citrix / virtual desktop −15, physical paper −15.',
      },
      {
        id: 'idea_feasibility_band',
        name: 'Feasibility band',
        dashboardRef: 'Idea detail → scoring outputs',
        unit: 'High / Medium / Low',
        definition: 'The feasibility score bucketed into a band.',
        source: 'The feasibility score.',
        calculation: '80 or above → High; 50–79 → Medium; below 50 → Low.',
        technical: 'score ≥ 80 → High; score ≥ 50 → Medium; else Low.',
      },
      {
        id: 'idea_technology_category',
        name: 'Technology category',
        dashboardRef:
          'Idea detail → scoring outputs; Ideas classification donut',
        unit: 'category',
        definition: 'The kind of automation technology the idea needs.',
        source: 'Wizard answers on unstructured data and cognitive reasoning.',
        calculation:
          'Free text or cognitive reasoning needed → GenAI / Agentic. Standard forms → RPA + AI Document Understanding. Otherwise → Traditional RPA.',
        technical:
          "unstructured_data = 'Yes - Free Text (Emails/Contracts)' OR cognitive_reasoning = 'Yes (Summarization/Sentiment/Extraction)' → GenAI / Agentic; unstructured_data = 'Yes - Standard Forms' → RPA + AI Document Understanding; else Traditional RPA.",
      },
      {
        id: 'idea_final_classification',
        name: 'Final classification',
        dashboardRef:
          'Idea detail → scoring outputs; Ideas classification donut',
        unit: 'category',
        definition:
          'The recommended verdict: Quick Win, Low-Hanging Fruit, Strategic Investment, or Deprioritize / Avoid.',
        source:
          'The feasibility band and the gross ROI against a ROI threshold.',
        calculation:
          'Low feasibility → Deprioritize / Avoid. High feasibility → Quick Win if ROI is high, else Low-Hanging Fruit. Medium feasibility → Strategic Investment if ROI is high, else Deprioritize / Avoid.',
        technical:
          'is_high_roi = gross_roi_eur ≥ roi_threshold_eur. band Low → "Deprioritize / Avoid"; band High → "Quick Win" / "Low-Hanging Fruit"; band Medium → "Strategic Investment" / "Deprioritize / Avoid".',
      },
    ],
  },
  {
    id: 'source-data',
    title: 'Source Data & Constants',
    blurb:
      'The underlying tables and the one shared constant that every metric above is built from.',
    entries: [
      {
        id: 'ref_cost_per_hour_fte',
        name: 'cost_per_hour_FTE',
        dashboardRef: 'Feeds every saving / ROI figure',
        unit: 'EUR / hour',
        definition:
          'The standard fully-loaded cost of one hour of human work — the price put on every automated hour.',
        source: 'core.reference_variable, name = "cost_per_hour_FTE".',
        calculation:
          'Not calculated — a maintained constant. Editable in the admin panel.',
        technical:
          "reference_variable.value WHERE name = 'cost_per_hour_FTE'. If absent, savings-based metrics return 0.",
      },
      {
        id: 'src_process_economics',
        name: 'Process economics row',
        dashboardRef: 'Business Cases page; feeds Program Economics',
        unit: 'mixed',
        definition:
          'The per-process cost and effort inputs: build cost, expected ROI horizon, measured automated hours per month, and any extra annual saving.',
        source:
          'core.process_economics (one row per process), edited on the Business Cases page.',
        calculation:
          'Entered, not derived. capex_eur = build cost; roi_expected_yr = planned payback years; fte_hours_month_actual = measured automated hours per month; extra_annual_saving_eur = additional saving beyond labour.',
        technical:
          'Columns: capex_eur, roi_expected_yr, fte_hours_month_actual, extra_annual_saving_eur, note. Unique on process_id.',
      },
      {
        id: 'src_license_cost',
        name: 'License cost',
        dashboardRef: 'Feeds Licences KPI & per-process licence share',
        unit: 'EUR / year',
        definition:
          'The runtime licence cost of one machine for one calendar year.',
        source: 'core.license_cost.',
        calculation: 'Entered per (year, VM); unique on that pair.',
        technical: 'Columns: year, virtual_machine_id, cost_year_eur.',
      },
      {
        id: 'src_vm_cost',
        name: 'VM cost (infrastructure)',
        dashboardRef: 'Feeds Infrastructure KPI & per-process infra share',
        unit: 'EUR / year',
        definition:
          'The general hosting / running cost of one machine for one year — distinct from its licence.',
        source: 'core.vm_cost.',
        calculation:
          'Entered per (year, VM). Seeded at €0 for every licensed machine until the infrastructure team supplies real figures.',
        technical:
          'Columns: year, virtual_machine_id, cost_eur. Mirrors license_cost’s shape.',
      },
      {
        id: 'src_ams_1l_cost',
        name: 'AMS 1L cost',
        dashboardRef: 'Feeds AMS 1L KPI & per-process AMS 1L share',
        unit: 'EUR / year',
        definition:
          'The fixed first-level support fee for an AMS contract year, and the process count it assumed.',
        source: 'core.ams_1l_cost, linked to core.ams_year.',
        calculation: 'Entered per AMS year; unique on ams_year.',
        technical:
          'Columns: ams_year_id, annual_fee_eur, n_processes_baseline. Matched to a calendar year through ams_year.year.',
      },
      {
        id: 'src_ams_2l_cost',
        name: 'AMS 2L cost',
        dashboardRef:
          'Feeds actual 2L cost in the per-process breakdown & L2 cost per ticket',
        unit: 'EUR',
        definition:
          'The actual second-level support cost booked against a specific ticket.',
        source: 'core.ams_2l_cost, linked to core.ticket.',
        calculation:
          'Entered per cost line. A ticket can have several lines (verified in the source), so this is not unique on ticket.',
        technical:
          'Columns: ticket_id, company_id, closed_date, cost_per_ticket_eur.',
      },
      {
        id: 'src_ams_rfc_cost',
        name: 'AMS RFC cost',
        dashboardRef: 'Feeds the Change Request KPI',
        unit: 'EUR',
        definition:
          'A single AMS change request / amendment: its reference, year, cost and effort in man-days.',
        source:
          'core.ams_rfc_cost — a curated, typed promotion of the raw RFC workbook sheet.',
        calculation: 'Entered per RFC; optionally linked to a process.',
        technical:
          'Columns: process_id, rfc_ref, year, description, man_days, root_cause_raw, cost_eur. root_cause_raw is kept unnormalised.',
      },
      {
        id: 'src_tco_cost',
        name: 'TCO cost ledger',
        dashboardRef: 'Feeds "Total spent to date" & the TCO & ROI chart',
        unit: 'EUR',
        definition:
          'The portfolio cost ledger — one dated line per cost item, tagged CAPEX or OPEX with an optional subtype.',
        source:
          'core.tco_cost. Distinct from the per-process economics and the running-cost tables.',
        calculation: 'Entered per line item.',
        technical:
          "Columns: cost_date, cost_eur, cost_type ('CAPEX' | 'OPEX'), subtype (AMS, CR, LICENSES, INFRA, …), description.",
      },
      {
        id: 'src_process_schedule',
        name: 'Process schedule',
        dashboardRef:
          'Feeds the occupancy heatmap & VM assignment for cost shares',
        unit: 'mixed',
        definition:
          'When and where a process runs: its machine, its run frequency and times, average duration, and its time-slot label.',
        source: 'core.process_schedule (a process can have more than one row).',
        calculation:
          'Mostly free text from the source. avg_minutes and rpa_hours_month are numeric where available; time_slot defaults to "morning".',
        technical:
          'Columns: virtual_machine_id, scheduled_description, frequency, run_time, avg_minutes, run_user, rpa_hours_month, time_slot. VM assignment for cost shares uses the first row by id.',
      },
      {
        id: 'src_ticket',
        name: 'Ticket',
        dashboardRef: 'Feeds every AMS Operations and SLA / KPI metric',
        unit: 'mixed',
        definition:
          'One support ticket: its type, priority, support tier, dates, root cause, and the process and company it belongs to.',
        source: 'core.ticket.',
        calculation:
          'Recorded, not derived. Resolution time is end_date − start_date; an open ticket has no end_date. is_1l splits L1 from L2.',
        technical:
          'Key columns: ticket_type, priority_id → priority.value (Einstein 0–5), is_1l, start_date, end_date, root_cause_id, process_id, company_id, support_level_id. Dates have no time-of-day component.',
      },
      {
        id: 'src_ams_year',
        name: 'AMS year',
        dashboardRef: 'Links AMS 1L / 2L costs to calendar years',
        unit: 'mixed',
        definition:
          'A row of the AMS contract timeline — the "1st / 2nd / 3rd" contract year and the calendar year it maps to.',
        source: 'core.ams_year.',
        calculation: 'Reference data.',
        technical:
          'Columns: code ("1st" / "2nd" / "3rd"), ordinal (1 / 2 / 3), year (calendar year).',
      },
    ],
  },
]
