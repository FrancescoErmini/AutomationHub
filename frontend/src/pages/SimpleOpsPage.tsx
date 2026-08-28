import { Fragment, useState } from 'react'
import { useQuery } from '@tanstack/react-query'

import { formatValue } from '../api/metrics'
import type { MetricMap } from '../api/metrics'
import {
  fetchAmsTrend,
  fetchCostBreakdownByProcess,
  fetchInfrastructure,
  fetchLicenseCostTrend,
  fetchOccupancyHeatmap,
  fetchRunningCostTrend,
  fetchSimpleOpsKpis,
} from '../api/simpleOps'
import { AsyncSection } from '../components/AsyncSection'
import { RunningCostTrendChart } from '../components/RunningCostTrendChart'
import './SimpleOpsPage.css'

const CURRENT_YEAR = new Date().getFullYear()
const PROCESS_PAGE_SIZE = 10

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
    <div className={`kpi${hero ? ' kpi-hero' : ''}`}>
      <p className="kpi-label">{label}</p>
      <p className="kpi-num">
        {value === null ? 'N/A' : formatValue(value, unit)}
      </p>
      {subtitle && (
        <p className={`kpi-delta${spot ? ' spot' : ''}`}>{subtitle}</p>
      )}
    </div>
  )
}

export function SimpleOpsPage() {
  const [processPage, setProcessPage] = useState(0)

  const kpis = useQuery({
    queryKey: ['simple-ops', 'kpis'],
    queryFn: () => fetchSimpleOpsKpis(),
  })
  const runningCostTrend = useQuery({
    queryKey: ['simple-ops', 'running-cost-trend'],
    queryFn: fetchRunningCostTrend,
  })
  const licenseCostTrend = useQuery({
    queryKey: ['simple-ops', 'license-cost-trend'],
    queryFn: fetchLicenseCostTrend,
  })
  const infrastructure = useQuery({
    queryKey: ['simple-ops', 'infrastructure'],
    queryFn: fetchInfrastructure,
  })
  const heatmap = useQuery({
    queryKey: ['simple-ops', 'heatmap'],
    queryFn: fetchOccupancyHeatmap,
  })
  const amsTrend = useQuery({
    queryKey: ['simple-ops', 'ams-trend'],
    queryFn: fetchAmsTrend,
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

  const maxLicense = Math.max(
    1,
    ...(licenseCostTrend.data ?? []).map((p) => p.cost_eur),
  )
  const maxInfra = Math.max(
    1,
    ...(infrastructure.data?.trend ?? []).map((p) => p.cost_eur),
  )
  const maxAms1l = Math.max(
    1,
    ...(amsTrend.data?.l1 ?? []).map((p) => p.cost_eur),
  )
  const maxAms2l = Math.max(
    1,
    ...(amsTrend.data?.l2 ?? []).map((p) => p.cost_eur),
  )
  const maxHeatCount = Math.max(
    1,
    ...(heatmap.data ?? []).flatMap((row) => row.cells.map((c) => c.count)),
  )

  return (
    <div className="simple-ops-page">
      <div className="opt-wrap">
        <div className="sheet">
          <h1 className="dash-h1">Operations Dashboard</h1>
          <p className="dash-sub">
            A comprehensive view of your RPA maintenance and execution costs.
          </p>

          <AsyncSection
            isPending={kpis.isPending}
            isError={kpis.isError}
            error={kpis.error}
            loadingLabel="Loading KPIs…"
          >
            <div className="kpi-row">
              <KpiCard
                hero
                label={`Total running cost ${CURRENT_YEAR}`}
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
                hero
                label="Average running cost / process"
                value={metricNumber(kpis.data, 'kpi_avg_cost_per_process_eur')}
                unit="eur"
                subtitle="licence + AMS + 2L + infra"
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
            <h2>
              <span
                className="h2-dot"
                style={{ background: 'var(--color-neutral-700)' }}
              />
              Total running cost trend
            </h2>
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
            <div className="dual-col">
              <div>
                <h2>
                  <span
                    className="h2-dot"
                    style={{ background: 'var(--color-accent-500)' }}
                  />
                  Blue Prism licences
                </h2>
                <p className="note">
                  Annual fee per licensed virtual machine, summed by year.
                </p>
                <AsyncSection
                  isPending={licenseCostTrend.isPending}
                  isError={licenseCostTrend.isError}
                  error={licenseCostTrend.error}
                  loadingLabel="Loading license trend…"
                >
                  {(licenseCostTrend.data ?? []).map((point) => (
                    <div className="bar-row" key={point.year}>
                      <div className="lbl">{point.year}</div>
                      <div className="bar-track">
                        <div
                          className="bar-fill"
                          style={{
                            width: `${(point.cost_eur / maxLicense) * 100}%`,
                            background:
                              point.cost_eur === maxLicense
                                ? 'var(--color-accent-700)'
                                : undefined,
                          }}
                        />
                      </div>
                      <div className="bar-val">
                        {formatValue(point.cost_eur, 'eur')}
                      </div>
                    </div>
                  ))}
                </AsyncSection>
                <div className="sub-block">
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
                                      ? `color-mix(in srgb, var(--color-accent) ${Math.max(
                                          5,
                                          Math.round(
                                            (cell.count / maxHeatCount) * 95,
                                          ),
                                        )}%, #fff)`
                                      : 'var(--color-neutral-200)',
                                }}
                              />
                            ))}
                          </Fragment>
                        ))}
                      </div>
                    ) : (
                      <p className="kpi-delta">
                        No scheduling data available.
                      </p>
                    )}
                  </AsyncSection>
                </div>
              </div>
              <div>
                <h2>
                  <span
                    className="h2-dot"
                    style={{ background: 'var(--color-accent-2-500)' }}
                  />
                  Infrastructure
                </h2>
                <p className="note">Annual opex for VMs and databases.</p>
                <AsyncSection
                  isPending={infrastructure.isPending}
                  isError={infrastructure.isError}
                  error={infrastructure.error}
                  loadingLabel="Loading infrastructure…"
                >
                  {(infrastructure.data?.trend ?? []).map((point) => (
                    <div className="bar-row" key={point.year}>
                      <div className="lbl">{point.year}</div>
                      <div className="bar-track">
                        <div
                          className="bar-fill"
                          style={{
                            width: `${(point.cost_eur / maxInfra) * 100}%`,
                            background: 'var(--color-accent-2-500)',
                          }}
                        />
                      </div>
                      <div className="bar-val">
                        {formatValue(point.cost_eur, 'eur')}
                      </div>
                    </div>
                  ))}
                  {infrastructure.data?.tbd && (
                    <div
                      className="tbd"
                      style={{ borderColor: 'var(--color-accent-2-300)' }}
                    >
                      Indicative opex data (€0) — awaiting confirmation from
                      the infrastructure team.
                    </div>
                  )}
                  <div className="sub-block">
                    <p className="stat-line">
                      <span>VM count</span>
                      <span
                        className="v"
                        style={{ color: 'var(--color-accent-2-700)' }}
                      >
                        {infrastructure.data?.vm_count ?? '—'}
                      </span>
                    </p>
                    <p className="stat-line" style={{ borderBottom: 'none' }}>
                      <span>Database count</span>
                      <span
                        className="v"
                        style={{ color: 'var(--color-accent-2-700)' }}
                      >
                        {infrastructure.data?.db_count ?? '—'}
                      </span>
                    </p>
                  </div>
                </AsyncSection>
              </div>
            </div>
          </section>

          <section className="blk">
            <h2>
              <span
                className="h2-dot"
                style={{ background: 'var(--color-accent-700)' }}
              />
              AMS 1L &amp; AMS 2L
            </h2>
            <p className="note">
              AMS 1L: annual fee based on the baseline process count. AMS 2L:
              actual cost per ticket (variable, distinct from the flat rate
              used in the header KPI).
            </p>
            <AsyncSection
              isPending={amsTrend.isPending}
              isError={amsTrend.isError}
              error={amsTrend.error}
              loadingLabel="Loading AMS trend…"
            >
              <div className="two-col">
                <div className="l1l2-col">
                  <p className="l1l2-head">AMS 1L</p>
                  {(amsTrend.data?.l1 ?? []).map((point) => (
                    <div className="bar-row" key={point.year}>
                      <div className="lbl">
                        {point.year} — {point.process_count} procs.
                      </div>
                      <div className="bar-track">
                        <div
                          className="bar-fill"
                          style={{
                            width: `${(point.cost_eur / maxAms1l) * 100}%`,
                          }}
                        />
                      </div>
                      <div className="bar-val">
                        {formatValue(point.cost_eur, 'eur')}
                      </div>
                    </div>
                  ))}
                </div>
                <div className="l1l2-col">
                  <p className="l1l2-head">AMS 2L</p>
                  {(amsTrend.data?.l2 ?? []).map((point) => (
                    <div className="bar-row" key={point.year}>
                      <div className="lbl">
                        {point.year} — {point.ticket_count} tickets
                      </div>
                      <div className="bar-track">
                        <div
                          className="bar-fill"
                          style={{
                            width: `${(point.cost_eur / maxAms2l) * 100}%`,
                            background: 'var(--color-accent-700)',
                          }}
                        />
                      </div>
                      <div className="bar-val">
                        {formatValue(point.cost_eur, 'eur')}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </AsyncSection>
          </section>

          <section className="blk">
            <h2>Cost breakdown by process</h2>
            <p className="note">
              Licence (per-VM share) + infrastructure (per-VM share) + AMS 1L
              (even share / process) + 2L (actual cost), {CURRENT_YEAR}.
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
              {pageRows.map((row) => (
                <div className="stack-row" key={row.process}>
                  <div className="lbl">
                    <span>{row.process}</span>
                    <span className="v">
                      {formatValue(row.total_eur, 'eur')}
                    </span>
                  </div>
                  <div className="stack-bar">
                    <div
                      className="seg-license"
                      style={{
                        width: `${(row.license_eur / maxProcessTotal) * 100}%`,
                      }}
                    />
                    <div
                      className="seg-infra"
                      style={{
                        width: `${(row.infrastructure_eur / maxProcessTotal) * 100}%`,
                      }}
                    />
                    <div
                      className="seg-ams"
                      style={{
                        width: `${(row.ams_1l_eur / maxProcessTotal) * 100}%`,
                      }}
                    />
                    <div
                      className="seg-2l"
                      style={{
                        width: `${(row.l2_eur / maxProcessTotal) * 100}%`,
                      }}
                    />
                  </div>
                </div>
              ))}
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

          <footer className="dnote">
            
          </footer>
        </div>
      </div>
    </div>
  )
}
