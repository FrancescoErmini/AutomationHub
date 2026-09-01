import { useState } from 'react'
import type { ReactNode } from 'react'
import { useQuery } from '@tanstack/react-query'

import {
  fetchExecutiveKpis,
  fetchExecutiveProcesses,
  fetchExecutiveTcoRoi,
} from '../api/executive'
import { fetchFilters } from '../api/metadata'
import { formatValue } from '../api/metrics'
import { AsyncSection } from '../components/AsyncSection'
import { CompanyFilter } from '../components/CompanyFilter'
import { MetricCard } from '../components/MetricCard'
import { ProcessRoiTable } from '../components/ProcessRoiTable'
import { TcoRoiChart } from '../components/TcoRoiChart'
import { DeltaChip, PageHeader, SectionHeading, Tag } from '../components/ui'

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
  return sorted.length % 2 === 0
    ? (sorted[mid - 1] + sorted[mid]) / 2
    : sorted[mid]
}

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
    const avgCapexEur =
      rows.reduce((sum, row) => sum + row.capex_eur, 0) / rows.length
    return { medianPaybackMonths, avgCapexEur }
  })()

  // Historical build-vs-run split of total spend to date: CAPEX is the
  // one-time build investment, OPEX the ongoing run/maintenance cost. Summed
  // across every year in the cost ledger, this matches the Total spent to date
  // KPI exactly.
  const spendMix = (() => {
    const rows = tcoRoi.data
    if (!rows || rows.length === 0) return null
    const build = rows.reduce((sum, row) => sum + row.capex_eur, 0)
    const run = rows.reduce((sum, row) => sum + row.opex_eur, 0)
    const total = build + run
    if (total <= 0) return null
    const buildPct = Math.round((build / total) * 100)
    return { buildPct, runPct: 100 - buildPct }
  })()

  // Year-over-year change across the two most recent *complete* years. The
  // latest year in the ledger is year-to-date, so it is excluded from the
  // comparison (see footnote). Needs >=3 ledger years: one dropped, two compared.
  const yoy = (() => {
    const rows = tcoRoi.data
    if (!rows || rows.length < 3) return null
    const sorted = [...rows].sort((a, b) => a.year - b.year)
    const complete = sorted.slice(0, -1)
    const lastIdx = complete.length - 1
    const last = complete[lastIdx]
    const prev = complete[lastIdx - 1]

    let running = 0
    const cumulativeSpend = complete.map(
      (row) => (running += row.capex_eur + row.opex_eur),
    )
    const netLast = last.savings_eur - cumulativeSpend[lastIdx]
    const netPrev = prev.savings_eur - cumulativeSpend[lastIdx - 1]

    const annualLast = last.savings_eur - prev.savings_eur
    const annualPrev =
      complete.length >= 3
        ? prev.savings_eur - complete[lastIdx - 2].savings_eur
        : prev.savings_eur

    const pctChange = (current: number, base: number): number | null =>
      Number.isFinite(base) && base !== 0
        ? ((current - base) / Math.abs(base)) * 100
        : null

    return {
      netPosition: pctChange(netLast, netPrev),
      annualSaving: pctChange(annualLast, annualPrev),
    }
  })()

  const showYoyFootnote =
    yoy != null && (yoy.netPosition != null || yoy.annualSaving != null)

  // Forward-looking break-even when the historical payback year is not yet
  // reached: how long the current net deficit takes to clear on run-only cash
  // flow -- gross annual saving minus the latest full-year recurring OpEx, with
  // no further build investment.
  const paybackProjection = (() => {
    if (kpis.data?.['kpi_payback_year']?.available) return null

    const netPos = kpis.data?.['kpi_net_position_eur']
    const annualSaving = kpis.data?.['kpi_annual_saving_eur']
    const rows = tcoRoi.data
    if (typeof netPos?.value !== 'number' || typeof annualSaving?.value !== 'number')
      return null
    if (!rows || rows.length === 0) return null

    const deficit = -netPos.value
    if (deficit <= 0) return null

    const sorted = [...rows].sort((a, b) => a.year - b.year)
    // latest *complete* year's OpEx as the recurring run cost
    const recurringOpex = (sorted[sorted.length - 2] ?? sorted[sorted.length - 1])
      .opex_eur
    const netAnnualCashFlow = annualSaving.value - recurringOpex
    if (netAnnualCashFlow <= 0) return null

    return { years: deficit / netAnnualCashFlow }
  })()

  const cardChips = (key: string): ReactNode => {
    if (key === 'kpi_total_spend_to_date_eur' && spendMix) {
      return (
        <>
          <Tag>Build {spendMix.buildPct}%</Tag>
          <Tag>Run {spendMix.runPct}%</Tag>
        </>
      )
    }
    if (key === 'kpi_net_position_eur' && yoy?.netPosition != null) {
      return <DeltaChip pct={yoy.netPosition} footnote />
    }
    if (key === 'kpi_annual_saving_eur' && yoy?.annualSaving != null) {
      return <DeltaChip pct={yoy.annualSaving} footnote />
    }
    if (key === 'kpi_payback_year' && paybackProjection) {
      return <Tag>Run-only mode</Tag>
    }
    return null
  }

  const cardFallback = (key: string): ReactNode => {
    if (key === 'kpi_payback_year' && paybackProjection) {
      return <>~{paybackProjection.years.toFixed(1)} yrs †</>
    }
    return null
  }

  return (
    <div className="space-y-8">
      <PageHeader
        title="Executive Dashboard"
        subtitle="A strategic overview of the RPA program's economics and process-level ROI."
      />

      <AsyncSection
        isPending={kpis.isPending}
        isError={kpis.isError}
        error={kpis.error}
        loadingLabel="Loading executive KPIs…"
      >
        <section
          aria-label="Executive KPIs"
          className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4"
        >
          {KPI_CARDS.map((card) => (
            <MetricCard
              key={card.key}
              label={card.label}
              metric={kpis.data?.[card.key]}
              signColor={card.signColor}
              chips={cardChips(card.key)}
              fallback={cardFallback(card.key)}
            />
          ))}
        </section>
        {(showYoyFootnote || paybackProjection) && (
          <div className="mt-3 space-y-1 text-xs text-slate-500">
            {showYoyFootnote && (
              <p>
                * Year-over-year compares the two most recent complete years; the
                current year-to-date is excluded.
              </p>
            )}
            {paybackProjection && (
              <p>
                † Run-only projection: current net deficit ÷ (gross annual saving
                − latest full-year recurring OpEx). Assumes no further build
                investment.
              </p>
            )}
          </div>
        )}
      </AsyncSection>

      <section
        aria-label="TCO and ROI analysis"
        className="rounded-xl border border-slate-200 bg-white p-5 shadow-card"
      >
        <h2 className="mb-4 text-base font-bold tracking-tight text-ink">
          RPA Total Cost of Ownership (TCO) &amp; ROI Analysis
        </h2>
        <AsyncSection
          isPending={tcoRoi.isPending}
          isError={tcoRoi.isError}
          error={tcoRoi.error}
          loadingLabel="Loading TCO & ROI…"
        >
          {tcoRoi.data && tcoRoi.data.length > 0 ? (
            <TcoRoiChart
              data={tcoRoi.data}
              valueFormatter={(value) => formatValue(value, 'eur')}
            />
          ) : (
            <p className="text-sm text-slate-500">
              No TCO & ROI data available.
            </p>
          )}
        </AsyncSection>
      </section>

      <section aria-label="Process ROI">
        <div className="mb-4">
          <SectionHeading
            stat={
              processRoiStats ? (
                <>
                  Median payback:{' '}
                  <span className="font-bold text-ink">
                    {formatValue(processRoiStats.medianPaybackMonths, 'months')}
                  </span>
                  {' · '}
                  Avg. cost per automation:{' '}
                  <span className="font-bold text-ink">
                    {formatValue(processRoiStats.avgCapexEur, 'eur')}
                  </span>
                </>
              ) : undefined
            }
          >
            Process ROI
          </SectionHeading>
        </div>
        {filters.data && (
          <div className="mb-4">
            <CompanyFilter
              companies={filters.data.companies}
              value={company}
              onChange={setCompany}
            />
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
