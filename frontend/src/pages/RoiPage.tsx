import { useQuery } from '@tanstack/react-query'

import { formatValue } from '../api/metrics'
import {
  fetchRoiCompanies,
  fetchRoiCostStack,
  fetchRoiKpis,
  fetchRoiProcesses,
  fetchRoiQuickWins,
} from '../api/roi'
import { AsyncSection } from '../components/AsyncSection'
import { DataTable } from '../components/DataTable'
import { MetricCard } from '../components/MetricCard'
import { RankBarChart } from '../components/RankBarChart'
import type { RoiCompanyRow, RoiProcessRow } from '../api/roi'

const KPI_CARDS: { key: string; label: string }[] = [
  { key: 'roi_annual_saving_eur', label: 'Annual saving' },
  { key: 'roi_tco_3y_eur', label: 'TCO (3Y)' },
  { key: 'roi_1_5y_pct', label: 'ROI 1.5Y' },
  { key: 'roi_3y_full_cost_pct', label: 'ROI 3Y (full cost)' },
  { key: 'roi_5y_pct', label: 'ROI 5Y' },
  { key: 'roi_net_benefit_3y_eur', label: 'Net benefit (3Y)' },
  { key: 'roi_payback_months', label: 'Payback' },
]

function processColumns() {
  return [
    { key: 'process' as const, label: 'Process' },
    { key: 'company' as const, label: 'Company' },
    {
      key: 'capex_eur' as const,
      label: 'CAPEX',
      align: 'right' as const,
      format: (value: unknown) => formatValue(value as number, 'eur'),
    },
    {
      key: 'annual_saving_eur' as const,
      label: 'Annual saving',
      align: 'right' as const,
      format: (value: unknown) => formatValue(value as number, 'eur'),
    },
    {
      key: 'payback_months' as const,
      label: 'Payback',
      align: 'right' as const,
      format: (value: unknown) =>
        value === null
          ? 'Not available'
          : formatValue(value as number, 'months'),
    },
    {
      key: 'roi_1_5y_pct' as const,
      label: 'ROI 1.5Y',
      align: 'right' as const,
      format: (value: unknown) =>
        value === null ? 'Not available' : formatValue(value as number, 'pct'),
    },
  ]
}

export function RoiPage() {
  const kpis = useQuery({ queryKey: ['roi', 'kpis'], queryFn: fetchRoiKpis })
  const processes = useQuery({
    queryKey: ['roi', 'processes'],
    queryFn: fetchRoiProcesses,
  })
  const companies = useQuery({
    queryKey: ['roi', 'companies'],
    queryFn: fetchRoiCompanies,
  })
  const quickWins = useQuery({
    queryKey: ['roi', 'quick-wins'],
    queryFn: () => fetchRoiQuickWins(5),
  })
  const costStack = useQuery({
    queryKey: ['roi', 'cost-stack'],
    queryFn: fetchRoiCostStack,
  })

  const savingVsTco =
    kpis.data &&
    kpis.data.roi_annual_saving_eur.value !== null &&
    kpis.data.roi_tco_3y_eur.value !== null
      ? [
          {
            label: '3Y saving (annual x3)',
            value: (kpis.data.roi_annual_saving_eur.value as number) * 3,
          },
          {
            label: 'TCO (3Y)',
            value: kpis.data.roi_tco_3y_eur.value as number,
          },
        ]
      : []

  return (
    <div className="space-y-10">
      <header>
        <h1 className="text-3xl font-bold tracking-tight text-ink">
          ROI / Business Value
        </h1>
        <p className="mt-1 text-slate-600">
          Portfolio-level return on investment. Process-level TCO is unavailable
          where AMS 1L and license costs have no documented per-process
          allocation rule.
        </p>
      </header>

      <AsyncSection
        isPending={kpis.isPending}
        isError={kpis.isError}
        error={kpis.error}
        loadingLabel="Loading ROI KPIs…"
      >
        <section
          aria-label="ROI KPIs"
          className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4"
        >
          {KPI_CARDS.map((card) => (
            <MetricCard
              key={card.key}
              label={card.label}
              metric={kpis.data?.[card.key]}
            />
          ))}
          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <p className="text-sm font-semibold text-slate-500">ROI status</p>
            <p className="mt-2 text-2xl font-bold tracking-tight text-ink">
              {kpis.data?.roi_status.value ?? 'Not available'}
            </p>
          </div>
        </section>
      </AsyncSection>

      <section
        aria-label="Saving vs TCO"
        className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"
      >
        <h2 className="mb-4 font-semibold text-ink">Saving vs TCO (3Y)</h2>
        {savingVsTco.length > 0 ? (
          <RankBarChart
            data={savingVsTco}
            valueFormatter={(value) => formatValue(value, 'eur')}
          />
        ) : (
          <p className="text-sm text-slate-500">Not available.</p>
        )}
      </section>

      <section
        aria-label="Cost stack"
        className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"
      >
        <h2 className="mb-4 font-semibold text-ink">Cost stack</h2>
        <AsyncSection
          isPending={costStack.isPending}
          isError={costStack.isError}
          error={costStack.error}
          loadingLabel="Loading cost stack…"
        >
          <RankBarChart
            data={(costStack.data ?? [])
              .filter(
                (metric) =>
                  metric.available && typeof metric.value === 'number',
              )
              .map((metric) => ({
                label: metric.metric_name
                  .replace('roi_cost_stack_', '')
                  .replace('_eur', ''),
                value: metric.value as number,
              }))}
            valueFormatter={(value) => formatValue(value, 'eur')}
          />
        </AsyncSection>
      </section>

      <section aria-label="Quick wins">
        <h2 className="mb-4 font-semibold text-ink">
          Quick wins (fastest payback)
        </h2>
        <AsyncSection
          isPending={quickWins.isPending}
          isError={quickWins.isError}
          error={quickWins.error}
          loadingLabel="Loading quick wins…"
        >
          <DataTable<RoiProcessRow>
            caption="Processes ranked by fastest CAPEX payback"
            rows={quickWins.data ?? []}
            getRowKey={(row) => row.process}
            columns={processColumns()}
          />
        </AsyncSection>
      </section>

      <section aria-label="Process ROI summary">
        <h2 className="mb-4 font-semibold text-ink">Process ROI summary</h2>
        <AsyncSection
          isPending={processes.isPending}
          isError={processes.isError}
          error={processes.error}
          loadingLabel="Loading process ROI summary…"
        >
          <DataTable<RoiProcessRow>
            caption="CAPEX, annual saving, payback, and ROI 1.5Y per process"
            rows={processes.data ?? []}
            getRowKey={(row) => row.process}
            columns={processColumns()}
          />
        </AsyncSection>
      </section>

      <section aria-label="Company ROI summary">
        <h2 className="mb-4 font-semibold text-ink">Company ROI summary</h2>
        <AsyncSection
          isPending={companies.isPending}
          isError={companies.isError}
          error={companies.error}
          loadingLabel="Loading company ROI summary…"
        >
          <DataTable<RoiCompanyRow>
            caption="Annual saving, CAPEX, ROI 1.5Y, and payback per company"
            rows={companies.data ?? []}
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
              {
                key: 'roi_1_5y_pct',
                label: 'ROI 1.5Y',
                align: 'right',
                format: (value) =>
                  value === null
                    ? 'Not available'
                    : formatValue(value as number, 'pct'),
              },
              {
                key: 'payback_months',
                label: 'Payback',
                align: 'right',
                format: (value) =>
                  value === null
                    ? 'Not available'
                    : formatValue(value as number, 'months'),
              },
            ]}
          />
        </AsyncSection>
      </section>
    </div>
  )
}
