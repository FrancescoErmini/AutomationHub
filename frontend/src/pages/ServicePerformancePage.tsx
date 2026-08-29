import { useQuery } from '@tanstack/react-query'

import { formatValue } from '../api/metrics'
import {
  fetchDataQuality,
  fetchResolution,
  fetchServicePerformanceKpis,
  fetchSlaTrend,
} from '../api/servicePerformance'
import { AsyncSection } from '../components/AsyncSection'
import { MetricCard } from '../components/MetricCard'
import { RankBarChart } from '../components/RankBarChart'
import { TrendChart } from '../components/TrendChart'

const KPI_CARDS: { key: string; label: string }[] = [
  { key: 'sla_compliance_pct', label: 'SLA compliance' },
  { key: 'sla_breach_pct', label: 'SLA breach' },
  { key: 'sla_breach_tickets', label: 'SLA breach tickets' },
  { key: 'sla_p90_resolution_days', label: 'P90 resolution' },
  { key: 'backlog_over_15_days', label: 'Backlog over 15 days' },
  { key: 'dq_root_cause_not_classified_pct', label: 'Unclassified root cause' },
  {
    key: 'dq_tickets_without_process_mapping_pct',
    label: 'Unmapped processes',
  },
  { key: 'dq_tickets_without_company_pct', label: 'Unmapped companies' },
]

export function ServicePerformancePage() {
  const kpis = useQuery({
    queryKey: ['service-performance', 'kpis'],
    queryFn: () => fetchServicePerformanceKpis(),
  })
  const slaTrend = useQuery({
    queryKey: ['service-performance', 'sla-trend'],
    queryFn: fetchSlaTrend,
  })
  const resolution = useQuery({
    queryKey: ['service-performance', 'resolution'],
    queryFn: fetchResolution,
  })
  const dataQuality = useQuery({
    queryKey: ['service-performance', 'data-quality'],
    queryFn: fetchDataQuality,
  })

  return (
    <div className="space-y-8">
      <header>
        <h1 className="text-3xl font-bold tracking-tight text-ink">
          SLA / Service Performance / Data Quality
        </h1>
        <p className="mt-1 text-slate-600">
          Compliance against the &le;3-day resolution proxy, backlog aging, and
          source data completeness.
        </p>
      </header>

      <AsyncSection
        isPending={kpis.isPending}
        isError={kpis.isError}
        error={kpis.error}
        loadingLabel="Loading SLA / data quality KPIs…"
      >
        <section
          aria-label="SLA and data quality KPIs"
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
        aria-label="SLA trend"
        className="rounded-xl border border-slate-200 bg-white p-5"
      >
        <h2 className="mb-4 font-semibold text-ink">SLA trend</h2>
        <AsyncSection
          isPending={slaTrend.isPending}
          isError={slaTrend.isError}
          error={slaTrend.error}
          loadingLabel="Loading SLA trend…"
        >
          {slaTrend.data && slaTrend.data.length > 0 ? (
            <TrendChart
              data={slaTrend.data}
              xKey="period"
              series={[{ key: 'value', label: 'Tickets' }]}
              valueFormatter={(value) => formatValue(value, 'count')}
            />
          ) : (
            <p className="text-sm text-slate-500">
              No SLA trend data available.
            </p>
          )}
        </AsyncSection>
      </section>

      <AsyncSection
        isPending={resolution.isPending}
        isError={resolution.isError}
        error={resolution.error}
        loadingLabel="Loading resolution analyses…"
      >
        <section
          aria-label="Resolution analyses"
          className="grid gap-6 lg:grid-cols-3"
        >
          <div className="rounded-xl border border-slate-200 bg-white p-5">
            <h2 className="mb-4 font-semibold text-ink">
              Avg resolution by root cause
            </h2>
            <RankBarChart
              data={(resolution.data?.by_root_cause ?? []).map((row) => ({
                label: row.label,
                value: row.avg_days,
              }))}
              valueFormatter={(value) => formatValue(value, 'days')}
            />
          </div>
          <div className="rounded-xl border border-slate-200 bg-white p-5">
            <h2 className="mb-4 font-semibold text-ink">
              Avg resolution by process
            </h2>
            <RankBarChart
              data={(resolution.data?.by_process ?? []).map((row) => ({
                label: row.label,
                value: row.avg_days,
              }))}
              valueFormatter={(value) => formatValue(value, 'days')}
              color="#b5762e"
            />
          </div>
          <div className="rounded-xl border border-slate-200 bg-white p-5">
            <h2 className="mb-4 font-semibold text-ink">
              Avg resolution by company
            </h2>
            <RankBarChart
              data={(resolution.data?.by_company ?? []).map((row) => ({
                label: row.label,
                value: row.avg_days,
              }))}
              valueFormatter={(value) => formatValue(value, 'days')}
              color="#0f7b6c"
            />
          </div>
        </section>
      </AsyncSection>

      <section aria-label="Data quality summary">
        <h2 className="mb-4 font-semibold text-ink">Data quality summary</h2>
        <AsyncSection
          isPending={dataQuality.isPending}
          isError={dataQuality.isError}
          error={dataQuality.error}
          loadingLabel="Loading data quality summary…"
        >
          <div className="grid gap-4 sm:grid-cols-3">
            {(dataQuality.data ?? []).map((metric) => (
              <MetricCard
                key={metric.metric_name}
                label={metric.metric_name.replace(/_/g, ' ')}
                metric={metric}
              />
            ))}
          </div>
        </AsyncSection>
      </section>
    </div>
  )
}
