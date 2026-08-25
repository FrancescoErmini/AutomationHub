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
  return `${sign}${value.toFixed(0)}% vs anno precedente`
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
        {value === null ? 'N/D' : formatValue(value, unit)}
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
          <h1 className="dash-h1">Operation Dashboard</h1>
          <p className="dash-sub">
            Costi di esercizio della piattaforma RPA e qualità servizio AMS:
            licenze Blue Prism, supporto AMS (1L), ticket di supporto
            specialistico (2L), infrastruttura e change request. Anno di
            riferimento {CURRENT_YEAR}, dati da PostgreSQL.
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
                label={`Costo running totale ${CURRENT_YEAR}`}
                value={metricNumber(kpis.data, 'kpi_total_running_cost_eur')}
                unit="eur"
                subtitle={[
                  metricNumber(kpis.data, 'kpi_process_count') !== null
                    ? `su ${metricNumber(kpis.data, 'kpi_process_count')} processi`
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
                label="Costo running medio / processo"
                value={metricNumber(kpis.data, 'kpi_avg_cost_per_process_eur')}
                unit="eur"
                subtitle="licenza + AMS + 2L + infra"
              />
              <KpiCard
                label="Licenze Blue Prism"
                value={metricNumber(kpis.data, 'kpi_license_cost_eur')}
                unit="eur"
                subtitle={
                  metricNumber(kpis.data, 'kpi_licensed_vm_count') !== null
                    ? `${metricNumber(kpis.data, 'kpi_licensed_vm_count')} macchine (VM) licenziate`
                    : null
                }
              />
              <KpiCard
                label="Infrastruttura"
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
                label="Ticket 2L"
                value={metricNumber(kpis.data, 'kpi_ticket_2l_cost_eur')}
                unit="eur"
                spot
                subtitle={[
                  formatDelta(
                    metricNumber(kpis.data, 'kpi_ticket_2l_cost_delta_pct'),
                  ),
                  metricNumber(kpis.data, 'kpi_ticket_2l_count') !== null
                    ? `${metricNumber(kpis.data, 'kpi_ticket_2l_count')} ticket gestiti`
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
                    ? `${metricNumber(kpis.data, 'kpi_change_request_count')} RFC AMS gestite`
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
              Andamento costo running totale
            </h2>
            <p className="note">
              Somma licenze + infrastruttura + AMS 1L + ticket 2L (tariffa
              flat) + change request per anno. L&apos;ultimo anno è una stima
              lineare basata sulla crescita del numero di processi in AMS.
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
                          (p.estimate ? ` (${p.year}, stima*)` : ''),
                      )
                      .join(' → ')}
                  </p>
                </>
              ) : (
                <p className="kpi-delta">Dati insufficienti per il trend.</p>
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
                  Licenze Blue Prism
                </h2>
                <p className="note">
                  Canone annuale per macchina virtuale licenziata, sommato per
                  anno.
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
                    Occupazione macchine per fascia oraria
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
                                title={`${cell.count} processi`}
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
                        Nessun dato di schedulazione disponibile.
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
                  Infrastruttura
                </h2>
                <p className="note">Opex annuo di VM e database.</p>
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
                      Dati opex indicativi (€0) — in attesa di conferma dal team
                      infrastruttura.
                    </div>
                  )}
                  <div className="sub-block">
                    <p className="stat-line">
                      <span>Numero VM</span>
                      <span
                        className="v"
                        style={{ color: 'var(--color-accent-2-700)' }}
                      >
                        {infrastructure.data?.vm_count ?? '—'}
                      </span>
                    </p>
                    <p className="stat-line" style={{ borderBottom: 'none' }}>
                      <span>Numero database</span>
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
              AMS 1L: canone annuale a baseline processi. AMS 2L: costo
              effettivo per ticket (variabile, distinto dalla tariffa flat usata
              nel KPI di testata).
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
                        {point.year} — {point.process_count} proc.
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
                        {point.year} — {point.ticket_count} ticket
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
              Qualità operativa — SLA e stato KPI
            </h2>
            <p className="note">
              Indicatori di salute del programma RPA per l&apos;anno{' '}
              {CURRENT_YEAR}, con soglie Verde / Giallo / Rosso.
            </p>
            <div className="range-row">
              <span className="kpi-label" style={{ margin: 0 }}>
                Periodo
              </span>
              <div
                className="seg"
                role="radiogroup"
                aria-label="Intervallo temporale"
              >
                <label className="seg-opt">
                  <input
                    type="radio"
                    name="simple-ops-range"
                    defaultChecked
                    readOnly
                  />
                  Anno corrente
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
                        : 'N/D'}
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
              Composizione delle richieste gestite da 1L e 2L: causa radice (top
              4 + Altro) e quota Service Request vs Incident, anno{' '}
              {CURRENT_YEAR}.
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
                            Nessun ticket per l&apos;anno selezionato.
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
            <h2>Scomposizione costo per processo</h2>
            <p className="note">
              Licenza (quota per VM) + infrastruttura (quota per VM) + AMS 1L
              (quota uniforme / processo) + 2L (costo effettivo), anno{' '}
              {CURRENT_YEAR}.
            </p>
            <div className="legend">
              <span>
                <i className="seg-license" />
                Licenza (quota)
              </span>
              <span>
                <i className="seg-infra" />
                Infrastruttura (quota)
              </span>
              <span>
                <i className="seg-ams" />
                AMS 1L
              </span>
              <span>
                <i className="seg-2l" />
                Ticket 2L
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
                    ← Precedente
                  </button>
                  <span className="pager-status">
                    Pagina {processPage + 1} di {totalPages}
                  </span>
                  <button
                    type="button"
                    className="btn"
                    disabled={processPage >= totalPages - 1}
                    onClick={() =>
                      setProcessPage((p) => Math.min(totalPages - 1, p + 1))
                    }
                  >
                    Successiva →
                  </button>
                </div>
              )}
            </AsyncSection>
          </section>

          <footer className="dnote">
            Dati da PostgreSQL (schema core). Infrastruttura in attesa di
            conferma opex; heatmap occupazione degenere finché le fasce orarie
            reali non sono valorizzate per processo.
          </footer>
        </div>
      </div>
    </div>
  )
}
