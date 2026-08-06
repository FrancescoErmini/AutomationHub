import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'

import {
  fetchExecutiveCompanySummary,
  fetchExecutiveCostBreakdown,
  fetchExecutiveKpis,
  fetchExecutiveTrends,
} from '../api/executive'
import { fetchFilters } from '../api/metadata'
import { formatValue } from '../api/metrics'
import { AsyncSection } from '../components/AsyncSection'
import { CompanyFilter } from '../components/CompanyFilter'
import { DataTable } from '../components/DataTable'
import { MetricCard } from '../components/MetricCard'
import { RankBarChart } from '../components/RankBarChart'
import { TrendChart } from '../components/TrendChart'
import type { CompanySummaryRow } from '../api/executive'

const KPI_CARDS: { key: string; label: string }[] = [
  { key: 'kpi_annual_saving_eur', label: 'Annual saving' },
  { key: 'kpi_roi_1_5y_ok_pct', label: 'ROI 1.5Y OK %' },
  { key: 'kpi_roi_3y_full_cost_pct', label: 'ROI 3Y' },
  { key: 'kpi_net_benefit_3y_eur', label: '3Y net benefit' },
  { key: 'kpi_run_cost_3y_eur', label: '3Y run cost' },
  { key: 'kpi_total_tickets', label: 'Total tickets' },
]

export function ExecutivePage() {
  const [company, setCompany] = useState('')

  const filters = useQuery({
    queryKey: ['metadata', 'filters'],
    queryFn: fetchFilters,
  })
  const kpis = useQuery({
    queryKey: ['executive', 'kpis', company],
    queryFn: () => fetchExecutiveKpis(company || undefined),
  })
  const trends = useQuery({
    queryKey: ['executive', 'trends'],
    queryFn: fetchExecutiveTrends,
  })
  const companySummary = useQuery({
    queryKey: ['executive', 'company-summary'],
    queryFn: fetchExecutiveCompanySummary,
  })
  const costBreakdown = useQuery({
    queryKey: ['executive', 'cost-breakdown'],
    queryFn: fetchExecutiveCostBreakdown,
  })

  return (
    <div className="space-y-10">
      <header className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-ink">
            CIO Executive Overview
          </h1>
          <p className="mt-1 text-slate-600">
            Portfolio KPIs sourced from PostgreSQL; unavailable metrics are
            shown as such rather than zero.
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
        loadingLabel="Loading executive KPIs…"
      >
        <section
          aria-label="Executive KPIs"
          className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3"
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
              <p className="text-sm text-slate-500">
                No saving trend data available.
              </p>
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
              <p className="text-sm text-slate-500">
                No ticket trend data available.
              </p>
            )}
          </AsyncSection>
        </div>
      </section>

      <section aria-label="Company summary">
        <h2 className="mb-4 font-semibold text-ink">Company summary</h2>
        <AsyncSection
          isPending={companySummary.isPending}
          isError={companySummary.isError}
          error={companySummary.error}
          loadingLabel="Loading company summary…"
        >
          <DataTable<CompanySummaryRow>
            caption="Annual saving, CAPEX, ticket volume, and ROI 1.5Y by company"
            rows={companySummary.data ?? []}
            getRowKey={(row) => row.company}
            columns={[
              { key: 'company', label: 'Company' },
              {
                key: 'annual_saving_eur',
                label: 'Annual saving',
                align: 'right',
                format: (value) => formatValue(value as number, 'eur'),
              },
              {
                key: 'capex_eur',
                label: 'CAPEX',
                align: 'right',
                format: (value) => formatValue(value as number, 'eur'),
              },
              { key: 'total_tickets', label: 'Tickets', align: 'right' },
              {
                key: 'roi_1_5y_pct',
                label: 'ROI 1.5Y',
                align: 'right',
                format: (value) =>
                  value === null
                    ? 'Not available'
                    : formatValue(value as number, 'pct'),
              },
            ]}
          />
        </AsyncSection>
      </section>

      <section aria-label="Cost breakdown">
        <h2 className="mb-4 font-semibold text-ink">
          Cost breakdown (3Y run cost components)
        </h2>
        <AsyncSection
          isPending={costBreakdown.isPending}
          isError={costBreakdown.isError}
          error={costBreakdown.error}
          loadingLabel="Loading cost breakdown…"
        >
          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <RankBarChart
              data={(costBreakdown.data ?? [])
                .filter(
                  (metric) =>
                    metric.available && typeof metric.value === 'number',
                )
                .map((metric) => ({
                  label: metric.metric_name
                    .replace('cost_breakdown_', '')
                    .replace('_eur', ''),
                  value: metric.value as number,
                }))}
              valueFormatter={(value) => formatValue(value, 'eur')}
            />
          </div>
        </AsyncSection>
      </section>
    </div>
  )
}
