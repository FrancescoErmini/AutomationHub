import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'

import { fetchFilters } from '../api/metadata'
import { formatValue } from '../api/metrics'
import {
  fetchBacklogAging,
  fetchOperationsKpis,
  fetchRootCausePareto,
  fetchSupportLevelTrend,
  fetchTopProcesses,
} from '../api/operations'
import { AsyncSection } from '../components/AsyncSection'
import { CompanyFilter } from '../components/CompanyFilter'
import { MetricCard } from '../components/MetricCard'
import { RankBarChart } from '../components/RankBarChart'
import { TrendChart } from '../components/TrendChart'

const KPI_CARDS: { key: string; label: string }[] = [
  { key: 'ops_total_tickets', label: 'Total tickets' },
  { key: 'ops_open_backlog', label: 'Open backlog' },
  { key: 'ops_closed_tickets', label: 'Closed tickets' },
  { key: 'ops_l1_tickets', label: 'L1 tickets' },
  { key: 'ops_l2_tickets', label: 'L2 tickets' },
  { key: 'ops_l1_ratio', label: 'L1 ratio' },
  { key: 'ops_l2_ratio', label: 'L2 ratio' },
  { key: 'ops_sla_proxy_le_3d_pct', label: 'SLA proxy (≤3d)' },
  { key: 'ops_avg_resolution_days', label: 'Avg resolution' },
  { key: 'ops_median_resolution_days', label: 'Median resolution' },
  { key: 'ops_p90_resolution_days', label: 'P90 resolution' },
  { key: 'ops_cost_per_ticket', label: 'Cost per ticket' },
  { key: 'ops_l2_cost_per_ticket', label: 'L2 cost per ticket' },
]

export function OperationsPage() {
  const [company, setCompany] = useState('')

  const filters = useQuery({
    queryKey: ['metadata', 'filters'],
    queryFn: fetchFilters,
  })
  const kpis = useQuery({
    queryKey: ['operations', 'kpis', company],
    queryFn: () => fetchOperationsKpis(company || undefined),
  })
  const supportLevelTrend = useQuery({
    queryKey: ['operations', 'support-level-trend'],
    queryFn: fetchSupportLevelTrend,
  })
  const rootCausePareto = useQuery({
    queryKey: ['operations', 'root-cause-pareto'],
    queryFn: fetchRootCausePareto,
  })
  const topProcesses = useQuery({
    queryKey: ['operations', 'top-processes'],
    queryFn: () => fetchTopProcesses(10),
  })
  const backlogAging = useQuery({
    queryKey: ['operations', 'backlog-aging'],
    queryFn: () => fetchBacklogAging(),
  })

  const backlogRows = backlogAging.data
    ? [
        { label: '0-3 days', value: backlogAging.data.backlog_0_3_days },
        { label: '4-7 days', value: backlogAging.data.backlog_4_7_days },
        { label: '8-15 days', value: backlogAging.data.backlog_8_15_days },
        {
          label: 'Over 15 days',
          value: backlogAging.data.backlog_over_15_days,
        },
      ]
    : []

  return (
    <div className="space-y-8">
      <header className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-ink">
            RPA AMS Operations
          </h1>
          <p className="mt-1 text-slate-600">
            Ticket volume, resolution performance, and cost per ticket for the
            AMS support desk.
          </p>
        </div>
        {filters.data && (
          <CompanyFilter
            companies={filters.data.companies}
            value={company}
            onChange={setCompany}
          />
        )}
      </header>

      <AsyncSection
        isPending={kpis.isPending}
        isError={kpis.isError}
        error={kpis.error}
        loadingLabel="Loading operations KPIs…"
      >
        <section
          aria-label="Operations KPIs"
          className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4"
        >
          {KPI_CARDS.map((card) => (
            <MetricCard
              key={card.key}
              label={card.label}
              metric={kpis.data?.[card.key]}
            />
          ))}
        </section>
      </AsyncSection>

      <section
        aria-label="L1 vs L2 trend"
        className="rounded-xl border border-slate-200 bg-white p-5"
      >
        <h2 className="mb-4 font-semibold text-ink">L1 vs L2 ticket trend</h2>
        <AsyncSection
          isPending={supportLevelTrend.isPending}
          isError={supportLevelTrend.isError}
          error={supportLevelTrend.error}
          loadingLabel="Loading support level trend…"
        >
          {supportLevelTrend.data && supportLevelTrend.data.length > 0 ? (
            <TrendChart
              data={supportLevelTrend.data}
              xKey="period"
              series={[
                { key: 'l1', label: 'L1' },
                { key: 'l2', label: 'L2' },
              ]}
              valueFormatter={(value) => formatValue(value, 'count')}
            />
          ) : (
            <p className="text-sm text-slate-500">
              No support level trend data available.
            </p>
          )}
        </AsyncSection>
      </section>

      <section
        aria-label="Root cause and top processes"
        className="grid gap-6 lg:grid-cols-2"
      >
        <div className="rounded-xl border border-slate-200 bg-white p-5">
          <h2 className="mb-4 font-semibold text-ink">Root cause pareto</h2>
          <AsyncSection
            isPending={rootCausePareto.isPending}
            isError={rootCausePareto.isError}
            error={rootCausePareto.error}
            loadingLabel="Loading root cause pareto…"
          >
            <RankBarChart
              data={(rootCausePareto.data ?? []).map((row) => ({
                label: row.root_cause,
                value: row.count,
              }))}
              valueFormatter={(value) => formatValue(value, 'count')}
            />
          </AsyncSection>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-5">
          <h2 className="mb-4 font-semibold text-ink">
            Top processes by ticket volume
          </h2>
          <AsyncSection
            isPending={topProcesses.isPending}
            isError={topProcesses.isError}
            error={topProcesses.error}
            loadingLabel="Loading top processes…"
          >
            <RankBarChart
              data={(topProcesses.data ?? []).map((row) => ({
                label: row.process,
                value: row.ticket_count,
              }))}
              valueFormatter={(value) => formatValue(value, 'count')}
              color="#bfa6d8"
            />
          </AsyncSection>
        </div>
      </section>

      <section
        aria-label="Backlog aging"
        className="rounded-xl border border-slate-200 bg-white p-5"
      >
        <h2 className="mb-4 font-semibold text-ink">
          Backlog aging (open tickets)
        </h2>
        <AsyncSection
          isPending={backlogAging.isPending}
          isError={backlogAging.isError}
          error={backlogAging.error}
          loadingLabel="Loading backlog aging…"
        >
          <RankBarChart
            data={backlogRows}
            valueFormatter={(value) => formatValue(value, 'count')}
          />
        </AsyncSection>
      </section>
    </div>
  )
}
