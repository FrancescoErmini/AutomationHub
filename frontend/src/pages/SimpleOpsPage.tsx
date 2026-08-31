import { Fragment, useState } from 'react'
import { useQuery } from '@tanstack/react-query'

import { formatValue } from '../api/metrics'
import type { MetricMap } from '../api/metrics'
import {
  fetchCostBreakdownByProcess,
  fetchInfrastructure,
  fetchOccupancyHeatmap,
  fetchRunningCostTrend,
  fetchSimpleOpsKpis,
} from '../api/simpleOps'
import type { ProcessCostRow } from '../api/simpleOps'
import { AsyncSection } from '../components/AsyncSection'
import { RunningCostTrendChart } from '../components/RunningCostTrendChart'
import { KpiStat, PageHeader, SectionHeading } from '../components/ui'
import './SimpleOpsPage.css'

const CURRENT_YEAR = new Date().getFullYear()
const PROCESS_PAGE_SIZE = 10

const PROCESS_SEGMENTS = [
  { key: 'license', label: 'Licence (share)', field: 'license_eur' },
  { key: 'infra', label: 'Infrastructure (share)', field: 'infrastructure_eur' },
  { key: 'ams', label: 'AMS 1L', field: 'ams_1l_eur' },
  { key: '2l', label: '2L tickets', field: 'l2_eur' },
] as const satisfies ReadonlyArray<{
  key: string
  label: string
  field: keyof ProcessCostRow
}>

interface HoveredSegment {
  process: string
  key: string
}

function metricNumber(map: MetricMap | undefined, key: string): number | null {
  const metric = map?.[key]
  if (!metric || !metric.available || typeof metric.value !== 'number')
    return null
  return metric.value
}

function formatDelta(value: number | null): string | null {
  if (value === null) return null
  const sign = value >= 0 ? '+' : ''
  return `${sign}${value.toFixed(0)}% vs last year`
}

interface KpiCardProps {
  label: string
  value: number | null
  unit: 'eur' | 'count'
  subtitle?: string | null
  spot?: boolean
  hero?: boolean
}

function KpiCard({ label, value, unit, subtitle, spot, hero }: KpiCardProps) {
  return (
    <KpiStat
      label={label}
      value={value === null ? 'N/A' : formatValue(value, unit)}
      delta={subtitle ?? undefined}
      deltaTone={spot ? 'muted' : 'auto'}
      hero={hero}
    />
  )
}

export function SimpleOpsPage() {
  const [processPage, setProcessPage] = useState(0)
  const [hoveredSegment, setHoveredSegment] = useState<HoveredSegment | null>(
    null,
  )

  const kpis = useQuery({
    queryKey: ['simple-ops', 'kpis'],
    queryFn: () => fetchSimpleOpsKpis(),
  })
  const runningCostTrend = useQuery({
    queryKey: ['simple-ops', 'running-cost-trend'],
    queryFn: fetchRunningCostTrend,
  })
  const infrastructure = useQuery({
    queryKey: ['simple-ops', 'infrastructure'],
    queryFn: fetchInfrastructure,
  })
  const heatmap = useQuery({
    queryKey: ['simple-ops', 'heatmap'],
    queryFn: fetchOccupancyHeatmap,
  })
  const costBreakdown = useQuery({
    queryKey: ['simple-ops', 'cost-breakdown-by-process'],
    queryFn: () => fetchCostBreakdownByProcess(),
  })

  const processRows = costBreakdown.data ?? []
  const totalPages = Math.max(
    1,
    Math.ceil(processRows.length / PROCESS_PAGE_SIZE),
  )
  const pageRows = processRows.slice(
    processPage * PROCESS_PAGE_SIZE,
    processPage * PROCESS_PAGE_SIZE + PROCESS_PAGE_SIZE,
  )
  const maxProcessTotal = Math.max(
    1,
    ...processRows.map((row) => row.total_eur),
  )

  const avgCostPerProcess = metricNumber(
    kpis.data,
    'kpi_avg_cost_per_process_eur',
  )

  const maxHeatCount = Math.max(
    1,
    ...(heatmap.data ?? []).flatMap((row) => row.cells.map((c) => c.count)),
  )

  return (
    <div className="simple-ops-page">
      <div className="opt-wrap">
        <div className="sheet">
          <PageHeader
            title="Operations Dashboard"
            subtitle={`A comprehensive view of your RPA maintenance and execution costs for ${CURRENT_YEAR}.`}
          />

          <AsyncSection
            isPending={kpis.isPending}
            isError={kpis.isError}
            error={kpis.error}
            loadingLabel="Loading KPIs…"
          >
            <div className="kpi-row">
              <KpiCard
                hero
                label={`Total running cost`}
                value={metricNumber(kpis.data, 'kpi_total_running_cost_eur')}
                unit="eur"
                subtitle={[
                  metricNumber(kpis.data, 'kpi_process_count') !== null
                    ? `across ${metricNumber(kpis.data, 'kpi_process_count')} processes`
                    : null,
                  formatDelta(
                    metricNumber(kpis.data, 'kpi_total_running_cost_delta_pct'),
                  ),
                ]
                  .filter(Boolean)
                  .join(' · ')}
              />
              <KpiCard
                label="Blue Prism licences"
                value={metricNumber(kpis.data, 'kpi_license_cost_eur')}
                unit="eur"
                subtitle={
                  metricNumber(kpis.data, 'kpi_licensed_vm_count') !== null
                    ? `${metricNumber(kpis.data, 'kpi_licensed_vm_count')} licensed VMs`
                    : null
                }
              />
              <KpiCard
                label="Infrastructure"
                value={metricNumber(kpis.data, 'kpi_infrastructure_cost_eur')}
                unit="eur"
                spot
                subtitle={formatDelta(
                  metricNumber(kpis.data, 'kpi_infrastructure_cost_delta_pct'),
                )}
              />
              <KpiCard
                label="AMS 1L"
                value={metricNumber(kpis.data, 'kpi_ams_1l_cost_eur')}
                unit="eur"
                spot
                subtitle={formatDelta(
                  metricNumber(kpis.data, 'kpi_ams_1l_cost_delta_pct'),
                )}
              />
              <KpiCard
                label="2L tickets"
                value={metricNumber(kpis.data, 'kpi_ticket_2l_cost_eur')}
                unit="eur"
                spot
                subtitle={[
                  formatDelta(
                    metricNumber(kpis.data, 'kpi_ticket_2l_cost_delta_pct'),
                  ),
                  metricNumber(kpis.data, 'kpi_ticket_2l_count') !== null
                    ? `${metricNumber(kpis.data, 'kpi_ticket_2l_count')} tickets handled`
                    : null,
                ]
                  .filter(Boolean)
                  .join(' · ')}
              />
              <KpiCard
                label="Change Request"
                value={metricNumber(kpis.data, 'kpi_change_request_cost_eur')}
                unit="eur"
                subtitle={
                  metricNumber(kpis.data, 'kpi_change_request_count') !== null
                    ? `${metricNumber(kpis.data, 'kpi_change_request_count')} AMS RFCs handled`
                    : null
                }
              />
            </div>
          </AsyncSection>

          <section className="blk">
            <SectionHeading dotColor="var(--ah-ink-3)">
              Total running cost trend
            </SectionHeading>
            <p className="note">
              Sum of licences + infrastructure + AMS 1L + 2L tickets (flat
              rate) + change requests per year, by component.
            </p>
            <AsyncSection
              isPending={runningCostTrend.isPending}
              isError={runningCostTrend.isError}
              error={runningCostTrend.error}
              loadingLabel="Loading trend…"
            >
              {(runningCostTrend.data ?? []).length > 0 ? (
                <RunningCostTrendChart data={runningCostTrend.data ?? []} />
              ) : (
                <p className="kpi-delta">Not enough data for the trend.</p>
              )}
            </AsyncSection>
          </section>

          <section className="blk">
            <SectionHeading
              stat={
                avgCostPerProcess !== null ? (
                  <>
                    Avg. cost per process:{' '}
                    <span className="font-bold text-ink [font-feature-settings:'pnum'_1]">
                      {formatValue(avgCostPerProcess, 'eur')}
                    </span>
                  </>
                ) : undefined
              }
            >
              Cost breakdown by process
            </SectionHeading>
            <p className="note">
              Licence (per-VM share) + infrastructure (per-VM share) + AMS 1L
              (even share / process) + 2L (actual cost), {CURRENT_YEAR}.
              Annual totals per component are in the running-cost table above.
            </p>
            <div className="legend">
              <span>
                <i className="seg-license" />
                Licence (share)
              </span>
              <span>
                <i className="seg-infra" />
                Infrastructure (share)
              </span>
              <span>
                <i className="seg-ams" />
                AMS 1L
              </span>
              <span>
                <i className="seg-2l" />
                2L tickets
              </span>
            </div>
            <AsyncSection
              isPending={costBreakdown.isPending}
              isError={costBreakdown.isError}
              error={costBreakdown.error}
              loadingLabel="Loading cost breakdown…"
            >
              {pageRows.map((row) => {
                let accPct = 0
                const segments = PROCESS_SEGMENTS.map((seg) => {
                  const value = row[seg.field] as number
                  const widthPct = (value / maxProcessTotal) * 100
                  const centerPct = accPct + widthPct / 2
                  accPct += widthPct
                  return { ...seg, value, widthPct, centerPct }
                })
                const active =
                  hoveredSegment?.process === row.process
                    ? segments.find((s) => s.key === hoveredSegment.key)
                    : undefined
                return (
                  <div className="stack-row" key={row.process}>
                    <div className="lbl">
                      <span>{row.process}</span>
                      <span className="v">
                        {formatValue(row.total_eur, 'eur')}
                      </span>
                    </div>
                    <div className="stack-bar">
                      {segments.map((seg) => (
                        <div
                          key={seg.key}
                          className={`seg-${seg.key}`}
                          style={{ width: `${seg.widthPct}%` }}
                          onMouseEnter={
                            seg.value > 0
                              ? () =>
                                  setHoveredSegment({
                                    process: row.process,
                                    key: seg.key,
                                  })
                              : undefined
                          }
                          onMouseLeave={
                            seg.value > 0
                              ? () => setHoveredSegment(null)
                              : undefined
                          }
                        />
                      ))}
                    </div>
                    {active && active.value > 0 && (
                      <div
                        className="stack-tip"
                        style={{ left: `${active.centerPct}%` }}
                      >
                        <strong>{active.label}</strong>
                        <span>{formatValue(active.value, 'eur')}</span>
                        <span className="stack-tip-pct">
                          {row.total_eur > 0
                            ? `${Math.round(
                                (active.value / row.total_eur) * 100,
                              )}% of process total`
                            : '—'}
                        </span>
                      </div>
                    )}
                  </div>
                )
              })}
              {processRows.length > PROCESS_PAGE_SIZE && (
                <div className="pager">
                  <button
                    type="button"
                    className="btn"
                    disabled={processPage === 0}
                    onClick={() => setProcessPage((p) => Math.max(0, p - 1))}
                  >
                    ← Previous
                  </button>
                  <span className="pager-status">
                    Page {processPage + 1} of {totalPages}
                  </span>
                  <button
                    type="button"
                    className="btn"
                    disabled={processPage >= totalPages - 1}
                    onClick={() =>
                      setProcessPage((p) => Math.min(totalPages - 1, p + 1))
                    }
                  >
                    Next →
                  </button>
                </div>
              )}
            </AsyncSection>
          </section>

          <section className="blk">
            <SectionHeading dotColor="var(--ah-chart-opex-infra)">
              Infrastructure &amp; machine utilisation
            </SectionHeading>
            <p className="note">
              Current VM and database fleet, and how process executions spread
              across machines and time slots. Annual infrastructure spend is in
              the running-cost table above.
            </p>
            <div className="dual-col">
              <div>
                <p className="kpi-label" style={{ marginBottom: 4 }}>
                  Machine occupancy by time slot
                </p>
                <AsyncSection
                  isPending={heatmap.isPending}
                  isError={heatmap.isError}
                  error={heatmap.error}
                  loadingLabel="Loading heatmap…"
                >
                  {(heatmap.data ?? []).length > 0 ? (
                    <div className="heat-grid">
                      <div />
                      {heatmap.data?.[0]?.cells.map((cell) => (
                        <div className="heat-head" key={cell.slot}>
                          {cell.label}
                        </div>
                      ))}
                      {(heatmap.data ?? []).map((row) => (
                        <Fragment key={row.vm}>
                          <div className="heat-row-label">{row.vm}</div>
                          {row.cells.map((cell) => (
                            <div
                              className="heat-cell"
                              key={`${row.vm}-${cell.slot}`}
                              title={`${cell.count} processes`}
                              style={{
                                background:
                                  cell.count > 0
                                    ? `color-mix(in srgb, var(--ah-chart-capex) ${Math.max(
                                        5,
                                        Math.round(
                                          (cell.count / maxHeatCount) * 95,
                                        ),
                                      )}%, #fff)`
                                    : 'var(--ah-border)',
                              }}
                            />
                          ))}
                        </Fragment>
                      ))}
                    </div>
                  ) : (
                    <p className="kpi-delta">No scheduling data available.</p>
                  )}
                </AsyncSection>
              </div>
              <div>
                <AsyncSection
                  isPending={infrastructure.isPending}
                  isError={infrastructure.isError}
                  error={infrastructure.error}
                  loadingLabel="Loading infrastructure…"
                >
                  <p className="stat-line">
                    <span>VM count</span>
                    <span
                      className="v"
                      style={{ color: 'var(--ah-ink-2)' }}
                    >
                      {infrastructure.data?.vm_count ?? '—'}
                    </span>
                  </p>
                  <p className="stat-line" style={{ borderBottom: 'none' }}>
                    <span>Database count</span>
                    <span
                      className="v"
                      style={{ color: 'var(--ah-ink-2)' }}
                    >
                      {infrastructure.data?.db_count ?? '—'}
                    </span>
                  </p>
                  {infrastructure.data?.tbd && (
                    <div
                      className="tbd"
                      style={{ borderColor: 'var(--ah-border-strong)' }}
                    >
                      Indicative opex data (€0) — awaiting confirmation from
                      the infrastructure team.
                    </div>
                  )}
                </AsyncSection>
              </div>
            </div>
          </section>

          <footer className="dnote">

          </footer>
        </div>
      </div>
    </div>
  )
}
