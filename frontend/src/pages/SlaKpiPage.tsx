import { useQuery } from '@tanstack/react-query'

import { formatValue } from '../api/metrics'
import {
  fetchBacklogAging,
  fetchRootCausePareto,
  fetchSupportLevelTrend,
} from '../api/operations'
import { fetchResolution } from '../api/servicePerformance'
import { fetchQualityBreakdown, fetchSlaKpis } from '../api/simpleOps'
import type { QualityDonut } from '../api/simpleOps'
import { AsyncSection } from '../components/AsyncSection'
import { RankBarChart } from '../components/RankBarChart'
import { TrendChart } from '../components/TrendChart'
import './SimpleOpsPage.css'

const CURRENT_YEAR = new Date().getFullYear()

const DONUT_COLORS = [
  'var(--color-accent-700)',
  'var(--color-accent-500)',
  'var(--color-accent-300)',
  'var(--color-neutral-400)',
  'var(--color-neutral-300)',
]

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

export function SlaKpiPage() {
  const slaKpis = useQuery({
    queryKey: ['simple-ops', 'sla-kpis'],
    queryFn: () => fetchSlaKpis(),
  })
  const qualityBreakdown = useQuery({
    queryKey: ['simple-ops', 'quality-breakdown'],
    queryFn: () => fetchQualityBreakdown(),
  })
  const supportLevelTrend = useQuery({
    queryKey: ['operations', 'support-level-trend'],
    queryFn: fetchSupportLevelTrend,
  })
  const rootCausePareto = useQuery({
    queryKey: ['operations', 'root-cause-pareto'],
    queryFn: fetchRootCausePareto,
  })
  const resolution = useQuery({
    queryKey: ['service-performance', 'resolution'],
    queryFn: fetchResolution,
  })
  const backlogAging = useQuery({
    queryKey: ['operations', 'backlog-aging'],
    queryFn: () => fetchBacklogAging(),
  })

  const backlogRows = backlogAging.data
    ? [
        { label: '0-3 days', value: backlogAging.data.backlog_0_3_days },
        { label: '4-7 days', value: backlogAging.data.backlog_4_7_days },
        { label: '8-15 days', value: backlogAging.data.backlog_8_15_days },
        { label: 'Over 15 days', value: backlogAging.data.backlog_over_15_days },
      ]
    : []

  return (
    <div className="simple-ops-page">
      <div className="opt-wrap">
        <div className="sheet">
          <h1 className="dash-h1">SLA / KPI</h1>
          <p className="dash-sub">
            Service-level and quality health of the RPA program.
          </p>

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
              <div className="seg" role="radiogroup" aria-label="Time range">
                <label className="seg-opt">
                  <input
                    type="radio"
                    name="sla-kpi-range"
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
            <h2>
              <span
                className="h2-dot"
                style={{ background: 'var(--color-accent-700)' }}
              />
              Ticket volume &amp; shift-left trend
            </h2>
            <p className="note">
              1L vs 2L ticket volume by month, across all available years —
              the clearest read on whether the desk is absorbing more work
              and whether 1L is taking a growing share of it.
            </p>
            <AsyncSection
              isPending={supportLevelTrend.isPending}
              isError={supportLevelTrend.isError}
              error={supportLevelTrend.error}
              loadingLabel="Loading ticket volume trend…"
            >
              {supportLevelTrend.data && supportLevelTrend.data.length > 0 ? (
                <TrendChart
                  data={supportLevelTrend.data}
                  xKey="period"
                  series={[
                    { key: 'l1', label: 'L1' },
                    { key: 'l2', label: 'L2' },
                  ]}
                  valueFormatter={(value) => formatValue(value, 'count')}
                />
              ) : (
                <p className="note">No ticket volume data available.</p>
              )}
            </AsyncSection>
          </section>

          <section className="blk">
            <h2>
              <span
                className="h2-dot"
                style={{ background: 'var(--color-accent-700)' }}
              />
              Where quality is lost — root causes &amp; resolution speed
            </h2>
            <p className="note">
              What breaks most often (all years), and how long each root
              cause takes to resolve on average — the two views together
              show where to focus improvement effort.
            </p>
            <AsyncSection
              isPending={rootCausePareto.isPending || resolution.isPending}
              isError={rootCausePareto.isError || resolution.isError}
              error={rootCausePareto.error ?? resolution.error}
              loadingLabel="Loading root cause analysis…"
            >
              <div className="two-col">
                <div>
                  <p className="l1l2-head">Root cause pareto</p>
                  <RankBarChart
                    data={(rootCausePareto.data ?? []).map((row) => ({
                      label: row.root_cause,
                      value: row.count,
                    }))}
                    valueFormatter={(value) => formatValue(value, 'count')}
                    color="#0f7b6c"
                  />
                </div>
                <div>
                  <p className="l1l2-head">Avg resolution time by root cause</p>
                  <RankBarChart
                    data={(resolution.data?.by_root_cause ?? []).map((row) => ({
                      label: row.label,
                      value: row.avg_days,
                    }))}
                    valueFormatter={(value) => formatValue(value, 'days')}
                    color="#b5762e"
                  />
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
              Backlog aging — open tickets right now
            </h2>
            <p className="note">
              Age distribution of the current open backlog. Ties directly
              into the Open Backlog Aging KPI above — this is what's
              actually sitting past the 14-day target.
            </p>
            <AsyncSection
              isPending={backlogAging.isPending}
              isError={backlogAging.isError}
              error={backlogAging.error}
              loadingLabel="Loading backlog aging…"
            >
              <RankBarChart
                data={backlogRows}
                valueFormatter={(value) => formatValue(value, 'count')}
                color="#0a5a50"
              />
            </AsyncSection>
          </section>
        </div>
      </div>
    </div>
  )
}
