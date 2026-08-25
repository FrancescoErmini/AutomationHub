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
  fetchQualityBreakdown,
  fetchRunningCostTrend,
  fetchSimpleOpsKpis,
  fetchSlaKpis,
} from '../api/simpleOps'
import type { QualityDonut, RunningCostTrendPoint } from '../api/simpleOps'
import { AsyncSection } from '../components/AsyncSection'
import './SimpleOpsPage.css'

const CURRENT_YEAR = new Date().getFullYear()
const PROCESS_PAGE_SIZE = 10

const DONUT_COLORS = [
  'var(--color-accent-700)',
  'var(--color-accent-500)',
  'var(--color-accent-300)',
  'var(--color-neutral-400)',
  'var(--color-neutral-300)',
]

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

interface TrendPointXY extends RunningCostTrendPoint {
  x: number
  y: number
}

function layoutTrend(points: RunningCostTrendPoint[]): TrendPointXY[] {
  const left = 40
  const right = 460
  const top = 20
  const bottom = 120
  const values = points.map((p) => p.total_eur)
  const min = Math.min(...values)
  const max = Math.max(...values)
  const span = max - min || 1
  return points.map((point, i) => ({
    ...point,
    x:
      points.length === 1
        ? left
        : left + (i * (right - left)) / (points.length - 1),
    y: bottom - ((point.total_eur - min) / span) * (bottom - top),
  }))
}

function donutRootCauseGradient(donut: QualityDonut): string {
  let acc = 0
  const stops = donut.root_causes.map((row, i) => {
    const start = acc
    acc += row.pct
    return `${DONUT_COLORS[i % DONUT_COLORS.length]} ${start}% ${acc}%`
  })
  return `conic-gradient(${stops.join(', ')})`
}

function donutTypeGradient(donut: QualityDonut, incidentColor: string): string {
  return `conic-gradient(${incidentColor} 0% ${donut.incident_pct}%, var(--color-neutral-200) ${donut.incident_pct}% 100%)`
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
  const slaKpis = useQuery({
    queryKey: ['simple-ops', 'sla-kpis'],
    queryFn: () => fetchSlaKpis(),
  })
  const qualityBreakdown = useQuery({
    queryKey: ['simple-ops', 'quality-breakdown'],
    queryFn: () => fetchQualityBreakdown(),
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

  const trendLayout = runningCostTrend.data
    ? layoutTrend(runningCostTrend.data)
    : []
  const realPoints = trendLayout.filter((p) => !p.estimate)
  const estimatePoint = trendLayout.find((p) => p.estimate)
  const lastRealPoint = realPoints[realPoints.length - 1]

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
          <span className="dash-kicker">RPA Program · Running Cost</span>
          <h1 className="dash-h1">Operations Dashboard</h1>
          <p className="dash-sub">
            Running costs for the RPA platform and AMS service quality: Blue
            Prism licences, AMS support (1L), specialist support tickets
            (2L), infrastructure, and change requests. Reference year{' '}
            {CURRENT_YEAR}, data from PostgreSQL.
          </p>
          <hr className="rh" />

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
              rate) + change requests per year. The final year is a linear
              estimate based on AMS process-count growth.
            </p>
            <AsyncSection
              isPending={runningCostTrend.isPending}
              isError={runningCostTrend.isError}
              error={runningCostTrend.error}
              loadingLabel="Loading trend…"
            >
              {trendLayout.length > 1 ? (
                <>
                  <svg
                    className="line-chart"
                    viewBox="0 0 500 150"
                    preserveAspectRatio="none"
                  >
                    <line
                      x1="30"
                      y1="20"
                      x2="470"
                      y2="20"
                      stroke="var(--color-neutral-200)"
                    />
                    <line
                      x1="30"
                      y1="70"
                      x2="470"
                      y2="70"
                      stroke="var(--color-neutral-200)"
                    />
                    <line
                      x1="30"
                      y1="120"
                      x2="470"
                      y2="120"
                      stroke="var(--color-neutral-300)"
                    />
                    <polyline
                      points={realPoints.map((p) => `${p.x},${p.y}`).join(' ')}
                      fill="none"
                      stroke="var(--color-neutral-700)"
                      strokeWidth="2.5"
                    />
                    {estimatePoint && lastRealPoint && (
                      <line
                        x1={lastRealPoint.x}
                        y1={lastRealPoint.y}
                        x2={estimatePoint.x}
                        y2={estimatePoint.y}
                        stroke="var(--color-accent-700)"
                        strokeWidth="2.5"
                        strokeDasharray="6 5"
                      />
                    )}
                    {realPoints.map((p) => (
                      <circle
                        key={p.year}
                        cx={p.x}
                        cy={p.y}
                        r="4"
                        fill="var(--color-neutral-600)"
                      />
                    ))}
                    {estimatePoint && (
                      <circle
                        cx={estimatePoint.x}
                        cy={estimatePoint.y}
                        r="5"
                        fill="#fff"
                        stroke="var(--color-accent-700)"
                        strokeWidth="2"
                      />
                    )}
                    {trendLayout.map((p) => (
                      <text
                        key={p.year}
                        x={p.x}
                        y="138"
                        fontSize="11"
                        fill={
                          p.estimate
                            ? 'var(--color-accent-700)'
                            : 'var(--color-text)'
                        }
                        fontFamily="var(--font-heading)"
                        textAnchor="middle"
                      >
                        {p.year}
                        {p.estimate ? '*' : ''}
                      </text>
                    ))}
                  </svg>
                  <p className="kpi-delta">
                    {trendLayout
                      .map(
                        (p) =>
                          formatValue(p.total_eur, 'eur') +
                          (p.estimate ? ` (${p.year}, estimate*)` : ''),
                      )
                      .join(' → ')}
                  </p>
                </>
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
            <h2>
              <span
                className="h2-dot"
                style={{ background: 'var(--color-accent-700)' }}
              />
              Operational quality — SLA and KPI status
            </h2>
            <p className="note">
              Health indicators for the RPA program for {CURRENT_YEAR}, with
              Green / Amber / Red thresholds.
            </p>
            <div className="range-row">
              <span className="kpi-label" style={{ margin: 0 }}>
                Period
              </span>
              <div
                className="seg"
                role="radiogroup"
                aria-label="Time range"
              >
                <label className="seg-opt">
                  <input
                    type="radio"
                    name="simple-ops-range"
                    defaultChecked
                    readOnly
                  />
                  Current year
                </label>
              </div>
            </div>
            <AsyncSection
              isPending={slaKpis.isPending}
              isError={slaKpis.isError}
              error={slaKpis.error}
              loadingLabel="Loading SLA KPIs…"
            >
              <div className="kpi-card-grid">
                {(slaKpis.data ?? []).map((card) => (
                  <div className="card" key={card.key}>
                    <div className="card-kicker">{card.label}</div>
                    <div
                      className="card-title"
                      style={{
                        color:
                          card.status === 'green'
                            ? 'var(--status-green)'
                            : card.status === 'red'
                              ? 'var(--status-red)'
                              : 'var(--status-amber)',
                      }}
                    >
                      {card.available
                        ? formatValue(card.value as number, card.unit)
                        : 'N/A'}
                    </div>
                    <div className="card-meta">
                      <span
                        className={`thr-dot t${card.status === 'green' ? 'g' : card.status === 'red' ? 'r' : 'a'}`}
                      />
                      {card.target_label}
                    </div>
                  </div>
                ))}
              </div>
            </AsyncSection>
          </section>

          <section className="blk">
            <h2>
              <span
                className="h2-dot"
                style={{ background: 'var(--color-accent-700)' }}
              />
              Root cause &amp; Service Request vs Incident — 1L / 2L
            </h2>
            <p className="note">
              Breakdown of requests handled by 1L and 2L: root cause (top 4 +
              Other) and Service Request vs. Incident share, {CURRENT_YEAR}.
            </p>
            <AsyncSection
              isPending={qualityBreakdown.isPending}
              isError={qualityBreakdown.isError}
              error={qualityBreakdown.error}
              loadingLabel="Loading quality breakdown…"
            >
              {qualityBreakdown.data && (
                <div className="two-col">
                  {(['l1', 'l2'] as const).map((level) => {
                    const donut = qualityBreakdown.data![level]
                    const incidentColor =
                      level === 'l1'
                        ? 'var(--color-accent-500)'
                        : 'var(--color-accent-700)'
                    return (
                      <div className="l1l2-col" key={level}>
                        <p className="l1l2-head">{level.toUpperCase()}</p>
                        {donut.total_tickets === 0 ? (
                          <p className="kpi-delta">
                            No tickets for the selected year.
                          </p>
                        ) : (
                          <div className="donut-row">
                            <div className="donut-block">
                              <p className="dtitle">Root cause</p>
                              <div
                                className="donut"
                                style={{
                                  background: donutRootCauseGradient(donut),
                                }}
                              >
                                <div className="donut-label">
                                  <span className="n">
                                    {donut.root_causes[0]
                                      ? `${donut.root_causes[0].pct.toFixed(0)}%`
                                      : '—'}
                                  </span>
                                  <span className="l">
                                    {donut.root_causes[0]?.label ?? ''}
                                  </span>
                                </div>
                              </div>
                              <div className="mini-legend">
                                {donut.root_causes.map((row, i) => (
                                  <p className="ml-row" key={row.label}>
                                    <span
                                      className="sw"
                                      style={{
                                        background:
                                          DONUT_COLORS[i % DONUT_COLORS.length],
                                      }}
                                    />
                                    {row.label}
                                    <span className="ml-val">
                                      {row.pct.toFixed(0)}%
                                    </span>
                                  </p>
                                ))}
                              </div>
                            </div>
                            <div className="donut-block">
                              <p className="dtitle">
                                Service Request vs Incident
                              </p>
                              <div
                                className="donut"
                                style={{
                                  background: donutTypeGradient(
                                    donut,
                                    incidentColor,
                                  ),
                                }}
                              >
                                <div className="donut-label">
                                  <span className="n">
                                    {donut.incident_pct.toFixed(0)}%
                                  </span>
                                  <span className="l">incident</span>
                                </div>
                              </div>
                              <div className="mini-legend">
                                <p className="ml-row">
                                  <span
                                    className="sw"
                                    style={{
                                      background: 'var(--color-neutral-200)',
                                    }}
                                  />
                                  Service Request
                                  <span className="ml-val">
                                    {donut.service_request_pct.toFixed(0)}%
                                  </span>
                                </p>
                                <p className="ml-row">
                                  <span
                                    className="sw"
                                    style={{ background: incidentColor }}
                                  />
                                  Incident
                                  <span className="ml-val">
                                    {donut.incident_pct.toFixed(0)}%
                                  </span>
                                </p>
                              </div>
                            </div>
                          </div>
                        )}
                      </div>
                    )
                  })}
                </div>
              )}
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
            Data from PostgreSQL (core schema). Infrastructure opex is
            awaiting confirmation; the occupancy heatmap is degenerate until
            real time slots are populated per process.
          </footer>
        </div>
      </div>
    </div>
  )
}
