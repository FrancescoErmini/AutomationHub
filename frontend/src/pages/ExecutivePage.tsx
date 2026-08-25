import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'

import {
  fetchExecutiveKpis,
  fetchExecutiveProcesses,
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
import { ProcessRoiTable } from '../components/ProcessRoiTable'
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
  const processes = useQuery({
    queryKey: ['executive', 'processes', company],
    queryFn: () => fetchExecutiveProcesses(company || undefined),
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
    </div>
  )
}
