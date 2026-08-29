import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'

import { fetchExecutiveKpis, fetchExecutiveProcesses, fetchExecutiveTcoRoi } from '../api/executive'
import { fetchFilters } from '../api/metadata'
import { formatValue } from '../api/metrics'
import { AsyncSection } from '../components/AsyncSection'
import { CompanyFilter } from '../components/CompanyFilter'
import { MetricCard } from '../components/MetricCard'
import { ProcessRoiTable } from '../components/ProcessRoiTable'
import { TcoRoiChart } from '../components/TcoRoiChart'

const KPI_CARDS: { key: string; label: string; signColor?: boolean }[] = [
  { key: 'kpi_total_saved_to_date_eur', label: 'Total saved to date' },
  { key: 'kpi_total_spend_to_date_eur', label: 'Total spent to date' },
  { key: 'kpi_net_position_eur', label: 'Net position', signColor: true },
  { key: 'kpi_annual_saving_eur', label: 'Annual saving' },
  { key: 'kpi_roi_multiple', label: 'ROI multiple' },
  { key: 'kpi_payback_year', label: 'Portfolio payback year' },
  { key: 'kpi_fte_freed', label: 'FTE-equivalent freed' },
]

function median(values: number[]): number | null {
  if (values.length === 0) return null
  const sorted = [...values].sort((a, b) => a - b)
  const mid = Math.floor(sorted.length / 2)
  return sorted.length % 2 === 0 ? (sorted[mid - 1] + sorted[mid]) / 2 : sorted[mid]
}

export function ExecutivePage() {
  const [company, setCompany] = useState('')

  const filters = useQuery({ queryKey: ['metadata', 'filters'], queryFn: fetchFilters })
  const kpis = useQuery({
    queryKey: ['executive', 'kpis', company],
    queryFn: () => fetchExecutiveKpis(company || undefined),
  })
  const processes = useQuery({
    queryKey: ['executive', 'processes', company],
    queryFn: () => fetchExecutiveProcesses(company || undefined),
  })
  const tcoRoi = useQuery({
    queryKey: ['executive', 'tco-roi'],
    queryFn: fetchExecutiveTcoRoi,
  })

  const processRoiStats = (() => {
    const rows = processes.data
    if (!rows || rows.length === 0) return null
    const paybackMonths = rows
      .map((row) => row.payback_months)
      .filter((value): value is number => value !== null)
    const medianPaybackMonths = median(paybackMonths)
    if (medianPaybackMonths === null) return null
    const avgCapexEur = rows.reduce((sum, row) => sum + row.capex_eur, 0) / rows.length
    return { medianPaybackMonths, avgCapexEur }
  })()

  return (
    <div className="space-y-8">
      <header>
        <h1 className="text-3xl font-bold tracking-tight text-ink">Executive Dashboard</h1>
        <p className="mt-1 text-slate-600">
          A strategic overview of the RPA program's economics and process-level ROI.
        </p>
      </header>

      <AsyncSection
        isPending={kpis.isPending}
        isError={kpis.isError}
        error={kpis.error}
        loadingLabel="Loading executive KPIs…"
      >
        <section aria-label="Executive KPIs" className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {KPI_CARDS.map((card) => (
            <MetricCard
              key={card.key}
              label={card.label}
              metric={kpis.data?.[card.key]}
              signColor={card.signColor}
            />
          ))}
        </section>
      </AsyncSection>

      <section
        aria-label="TCO and ROI analysis"
        className="rounded-xl border border-slate-200 bg-white p-5"
      >
        <h2 className="mb-4 font-semibold text-ink">RPA Total Cost of Ownership (TCO) &amp; ROI Analysis</h2>
        <AsyncSection
          isPending={tcoRoi.isPending}
          isError={tcoRoi.isError}
          error={tcoRoi.error}
          loadingLabel="Loading TCO & ROI…"
        >
          {tcoRoi.data && tcoRoi.data.length > 0 ? (
            <TcoRoiChart data={tcoRoi.data} valueFormatter={(value) => formatValue(value, 'eur')} />
          ) : (
            <p className="text-sm text-slate-500">No TCO & ROI data available.</p>
          )}
        </AsyncSection>
      </section>

      <section aria-label="Process ROI">
        <div className="mb-4 flex flex-wrap items-baseline justify-between gap-x-6 gap-y-2">
          <h2 className="font-semibold text-ink">Process ROI</h2>
          {processRoiStats && (
            <p className="text-sm text-slate-500">
              Median payback:{' '}
              <span className="font-semibold text-ink">
                {formatValue(processRoiStats.medianPaybackMonths, 'months')}
              </span>
              {' · '}
              Avg. cost per automation:{' '}
              <span className="font-semibold text-ink">
                {formatValue(processRoiStats.avgCapexEur, 'eur')}
              </span>
            </p>
          )}
        </div>
        {filters.data && (
          <div className="mb-4">
            <CompanyFilter companies={filters.data.companies} value={company} onChange={setCompany} />
          </div>
        )}
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
