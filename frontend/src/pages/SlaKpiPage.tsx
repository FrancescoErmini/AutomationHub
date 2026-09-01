import { useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Line, LineChart, ResponsiveContainer } from 'recharts'

import { formatValue } from '../api/metrics'
import type { MetricMap } from '../api/metrics'
import {
  fetchBacklogAging,
  fetchOperationsKpis,
  fetchRootCausePareto,
  fetchSupportLevelTrend,
} from '../api/operations'
import {
  fetchResolution,
  fetchServicePerformanceKpis,
} from '../api/servicePerformance'
import {
  fetchQualityBreakdown,
  fetchSlaAttainment,
  fetchSlaCommitments,
  fetchSlaKpis,
} from '../api/simpleOps'
import type { SlaCommitmentRow } from '../api/simpleOps'
import { AsyncSection } from '../components/AsyncSection'
import { RankBarChart } from '../components/RankBarChart'
import { TrendChart } from '../components/TrendChart'
import { PageHeader, SectionHeading } from '../components/ui'
import { chart, chartSeries } from '../lib/chartColors'
import './SimpleOpsPage.css'

const CURRENT_YEAR = new Date().getFullYear()
const DOT = 'var(--color-accent-700)'
const ATTAINMENT_TARGET_PCT = 95

const STATUS_PILL: Record<string, { cls: string; label: string }> = {
  green: { cls: 'sp-green', label: 'On target' },
  amber: { cls: 'sp-amber', label: 'At risk' },
  red: { cls: 'sp-red', label: 'Breached' },
  unavailable: { cls: 'sp-neutral', label: 'No data' },
}

function StatusPill({ status }: { status: string }) {
  const s = STATUS_PILL[status] ?? STATUS_PILL.unavailable
  return (
    <span className={`status-pill ${s.cls}`}>
      <span className="dot" aria-hidden />
      {s.label}
    </span>
  )
}

function Sparkline({ values }: { values: number[] }) {
  const data = values.map((v, i) => ({ i, v }))
  return (
    <div className="spark">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data}>
          <Line
            type="monotone"
            dataKey="v"
            stroke={chart.capex}
            strokeWidth={2}
            dot={false}
            isAnimationActive={false}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  )
}

function metricNumber(map: MetricMap | undefined, key: string): number | null {
  const metric = map?.[key]
  if (!metric || !metric.available || typeof metric.value !== 'number')
    return null
  return metric.value
}

interface ExcRow {
  metric: string
  current: string
  target: string
  status: 'amber' | 'red'
}

const OPEN_TICKETS_PAGE_SIZE = 10

export function SlaKpiPage() {
  const [pickedYear, setPickedYear] = useState<number | null>(null)
  const [openTicketsPage, setOpenTicketsPage] = useState(0)

  const supportLevelTrend = useQuery({
    queryKey: ['operations', 'support-level-trend'],
    queryFn: fetchSupportLevelTrend,
  })

  const years = useMemo(() => {
    const set = new Set<number>()
    for (const point of supportLevelTrend.data ?? []) {
      const y = Number(String(point.period).slice(0, 4))
      if (!Number.isNaN(y)) set.add(y)
    }
    const arr = [...set].sort((a, b) => b - a)
    return arr.length ? arr : [CURRENT_YEAR]
  }, [supportLevelTrend.data])

  const year =
    pickedYear ?? (years.includes(CURRENT_YEAR) ? CURRENT_YEAR : years[0])

  const slaKpis = useQuery({
    queryKey: ['simple-ops', 'sla-kpis', year],
    queryFn: () => fetchSlaKpis(year),
  })
  const attainment = useQuery({
    queryKey: ['simple-ops', 'sla-attainment', year],
    queryFn: () => fetchSlaAttainment(year),
  })
  const commitments = useQuery({
    queryKey: ['simple-ops', 'sla-commitments'],
    queryFn: fetchSlaCommitments,
  })
  const qualityBreakdown = useQuery({
    queryKey: ['simple-ops', 'quality-breakdown', year],
    queryFn: () => fetchQualityBreakdown(year),
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
  const spKpis = useQuery({
    queryKey: ['service-performance', 'kpis'],
    queryFn: () => fetchServicePerformanceKpis(),
  })
  const opsKpis = useQuery({
    queryKey: ['operations', 'kpis'],
    queryFn: () => fetchOperationsKpis(),
  })

  const att = attainment.data
  const p90 = metricNumber(spKpis.data, 'sla_p90_resolution_days')
  const costPerTicket = metricNumber(opsKpis.data, 'ops_cost_per_ticket')

  const sparkValues =
    att && att.by_month.length >= 2
      ? att.by_month.map((m) => m.attainment_pct ?? 0)
      : []

  const excRows: ExcRow[] = []
  for (const card of slaKpis.data ?? []) {
    if (card.status === 'amber' || card.status === 'red') {
      excRows.push({
        metric: card.label,
        current:
          card.available && card.value !== null
            ? formatValue(card.value as number, card.unit)
            : 'N/A',
        target: card.target_label,
        status: card.status,
      })
    }
  }
  if (
    att &&
    att.headline_pct !== null &&
    (att.status === 'amber' || att.status === 'red')
  ) {
    excRows.push({
      metric: 'Resolution SLA attainment (proxy)',
      current: `${att.headline_pct.toFixed(1)}%`,
      target: `≥ ${ATTAINMENT_TARGET_PCT}%`,
      status: att.status,
    })
  }
  if (att && att.open_over_target_count > 0) {
    excRows.push({
      metric: 'Open tickets past resolution target',
      current: String(att.open_over_target_count),
      target: '0',
      status: 'red',
    })
  }

  const backlogRows = backlogAging.data
    ? [
        { label: '0-3 days', value: backlogAging.data.backlog_0_3_days },
        { label: '4-7 days', value: backlogAging.data.backlog_4_7_days },
        { label: '8-15 days', value: backlogAging.data.backlog_8_15_days },
        {
          label: 'Over 15 days',
          value: backlogAging.data.backlog_over_15_days,
        },
      ]
    : []

  const attainmentTrend =
    att?.by_month
      .filter((m) => m.attainment_pct !== null)
      .map((m) => ({
        period: m.period,
        attainment: m.attainment_pct as number,
      })) ?? []

  const openTickets = att?.open_over_target ?? []
  const openTicketsTotalPages = Math.max(
    1,
    Math.ceil(openTickets.length / OPEN_TICKETS_PAGE_SIZE),
  )
  const openTicketsSafePage = Math.min(
    openTicketsPage,
    openTicketsTotalPages - 1,
  )
  const openTicketsStart = openTicketsSafePage * OPEN_TICKETS_PAGE_SIZE
  const openTicketsPageRows = openTickets.slice(
    openTicketsStart,
    openTicketsStart + OPEN_TICKETS_PAGE_SIZE,
  )

  const commitmentRows = commitments.data
  const commitmentGroups = useMemo(() => {
    const groups = new Map<string, SlaCommitmentRow[]>()
    for (const row of commitmentRows ?? []) {
      const list = groups.get(row.ticket_type) ?? []
      list.push(row)
      groups.set(row.ticket_type, list)
    }
    return [...groups.entries()]
  }, [commitmentRows])

  return (
    <div className="simple-ops-page">
      <div className="opt-wrap">
        <div className="sheet">
          <PageHeader
            title="SLA / KPI"
            subtitle="Service-level and quality health of the RPA program."
          />

          <div className="sla-toolbar">
            <label className="field">
              Period
              <select
                className="year-select"
                value={year}
                onChange={(event) => {
                  setPickedYear(Number(event.target.value))
                  setOpenTicketsPage(0)
                }}
              >
                {years.map((y) => (
                  <option key={y} value={y}>
                    {y}
                  </option>
                ))}
              </select>
            </label>
            <p className="scope-note">
              KPI tiles, exceptions and SLA attainment are scoped to {year}.
              Volume, root-cause and resolution-speed trends span all available
              data; backlog aging is as of today.
            </p>
          </div>

          {/* ---- Headline ---------------------------------------------------- */}
          <AsyncSection
            isPending={attainment.isPending}
            isError={attainment.isError}
            error={attainment.error}
            loadingLabel="Loading SLA attainment…"
          >
            {att && (
              <div className="hero-grid">
                <div className="hero-stat is-hero">
                  <span className="hl">Resolution SLA attainment ({year})</span>
                  <span
                    className="hv"
                    style={{
                      color:
                        att.status === 'green'
                          ? 'var(--status-green)'
                          : att.status === 'red'
                            ? 'var(--status-red)'
                            : att.status === 'amber'
                              ? 'var(--status-amber)'
                              : 'var(--status-neutral)',
                    }}
                  >
                    {att.headline_pct !== null
                      ? `${att.headline_pct.toFixed(1)}%`
                      : 'No data'}
                  </span>
                  <StatusPill status={att.status} />
                  {sparkValues.length > 0 && <Sparkline values={sparkValues} />}
                  <span className="hsub">
                    {att.within_target}/{att.closed} closed tickets met their
                    priority-based repair target
                  </span>
                </div>

                <div className="hero-stat">
                  <span className="hl">SLA breaches ({year})</span>
                  <span className="hv">{att.breached}</span>
                  <span className="hsub">
                    closed tickets resolved past target
                  </span>
                </div>

                <div className="hero-stat">
                  <span className="hl">Open past target — now</span>
                  <span
                    className="hv"
                    style={{
                      color:
                        att.open_over_target_count > 0
                          ? 'var(--status-red)'
                          : 'var(--status-green)',
                    }}
                  >
                    {att.open_over_target_count}
                  </span>
                  <span className="hsub">
                    open tickets already older than their repair target
                  </span>
                </div>

                <div className="hero-stat">
                  <span className="hl">P90 resolution time</span>
                  <span className="hv">
                    {p90 !== null ? `${p90.toFixed(1)}d` : 'No data'}
                  </span>
                  <span className="hsub">
                    {costPerTicket !== null
                      ? `${formatValue(costPerTicket, 'eur')} run-cost per ticket`
                      : '90th percentile, all closed tickets'}
                  </span>
                </div>
              </div>
            )}
          </AsyncSection>

          {/* ---- Exceptions ------------------------------------------------- */}
          <section className="blk">
            <SectionHeading dotColor={DOT}>
              Exceptions — what needs attention
            </SectionHeading>
            <p className="note">
              Every tracked KPI currently outside its target, for {year}. This
              is the action list.
            </p>
            <AsyncSection
              isPending={slaKpis.isPending || attainment.isPending}
              isError={slaKpis.isError || attainment.isError}
              error={slaKpis.error ?? attainment.error}
              loadingLabel="Loading exceptions…"
            >
              {excRows.length === 0 ? (
                <p className="exc-empty">
                  <span
                    className="thr-dot tg"
                    style={{ width: 9, height: 9 }}
                  />
                  All tracked KPIs are within target for {year}.
                </p>
              ) : (
                <div className="rct-table-wrap">
                  <table className="rct-table">
                    <thead>
                      <tr>
                        <th scope="col">Metric</th>
                        <th scope="col">Current</th>
                        <th scope="col">Target</th>
                        <th scope="col">Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {excRows.map((row) => (
                        <tr key={row.metric}>
                          <th scope="row">{row.metric}</th>
                          <td>{row.current}</td>
                          <td>{row.target}</td>
                          <td>
                            <StatusPill status={row.status} />
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

              {openTickets.length > 0 && (
                <>
                  <p className="l1l2-head" style={{ textAlign: 'left' }}>
                    Oldest open tickets past target
                  </p>
                  <div className="rct-table-wrap">
                    <table className="rct-table">
                      <thead>
                        <tr>
                          <th scope="col">Ticket</th>
                          <th scope="col">Type</th>
                          <th scope="col">Priority</th>
                          <th scope="col">Process</th>
                          <th scope="col">Age</th>
                          <th scope="col">Target</th>
                        </tr>
                      </thead>
                      <tbody>
                        {openTicketsPageRows.map((ticket) => (
                          <tr key={ticket.ticket_id}>
                            <th scope="row">{ticket.ticket_id}</th>
                            <td>{ticket.ticket_type}</td>
                            <td>{ticket.band}</td>
                            <td>{ticket.process ?? '—'}</td>
                            <td>{ticket.age_days}d</td>
                            <td>{ticket.target_days}d</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  {openTicketsTotalPages > 1 && (
                    <div className="pager">
                      <button
                        type="button"
                        className="btn"
                        disabled={openTicketsSafePage === 0}
                        onClick={() =>
                          setOpenTicketsPage((p) => Math.max(0, p - 1))
                        }
                      >
                        ← Previous
                      </button>
                      <span className="pager-status">
                        {openTicketsStart + 1}–
                        {openTicketsStart + openTicketsPageRows.length} of{' '}
                        {openTickets.length}
                        {att && att.open_over_target_count > openTickets.length
                          ? ` (${att.open_over_target_count} past target in total)`
                          : ''}
                      </span>
                      <button
                        type="button"
                        className="btn"
                        disabled={
                          openTicketsSafePage >= openTicketsTotalPages - 1
                        }
                        onClick={() =>
                          setOpenTicketsPage((p) =>
                            Math.min(openTicketsTotalPages - 1, p + 1),
                          )
                        }
                      >
                        Next →
                      </button>
                    </div>
                  )}
                </>
              )}
            </AsyncSection>
          </section>

          {/* ---- KPI tiles ------------------------------------------------- */}
          <section className="blk">
            <SectionHeading dotColor={DOT}>
              Operational quality — KPI status
            </SectionHeading>
            <p className="note">
              Health indicators for the RPA program for {year}, with Green /
              Amber / Red thresholds.
            </p>
            <AsyncSection
              isPending={slaKpis.isPending}
              isError={slaKpis.isError}
              error={slaKpis.error}
              loadingLabel="Loading KPIs…"
            >
              <div className="kpi-card-grid">
                {(slaKpis.data ?? []).map((card) => {
                  const unavailable =
                    !card.available ||
                    card.value === null ||
                    card.status === 'unavailable'
                  return (
                    <div
                      className={`card kpi-tile${unavailable ? ' is-unavailable' : ''}`}
                      key={card.key}
                    >
                      <div className="card-kicker">{card.label}</div>
                      <div
                        className="card-title"
                        style={{
                          color: unavailable
                            ? undefined
                            : card.status === 'green'
                              ? 'var(--status-green)'
                              : card.status === 'red'
                                ? 'var(--status-red)'
                                : 'var(--status-amber)',
                        }}
                      >
                        {unavailable
                          ? 'No data'
                          : formatValue(card.value as number, card.unit)}
                      </div>
                      <StatusPill
                        status={unavailable ? 'unavailable' : card.status}
                      />
                      <div className="card-meta">{card.target_label}</div>
                    </div>
                  )
                })}
              </div>
            </AsyncSection>
          </section>

          {/* ---- Contractual SLA ----------------------------------------- */}
          <section className="blk">
            <SectionHeading dotColor={DOT}>
              Contractual SLA — AMS 1L
            </SectionHeading>
            {att && (
              <p className="caveat">
                <span>
                  <b>What this dashboard can measure.</b> {att.caveat}
                </span>
              </p>
            )}
            <AsyncSection
              isPending={commitments.isPending}
              isError={commitments.isError}
              error={commitments.error}
              loadingLabel="Loading SLA commitments…"
            >
              <div className="rct-table-wrap">
                <table className="sla-matrix">
                  <thead>
                    <tr>
                      <th>Ticket type</th>
                      <th>Einstein priority</th>
                      <th>Provider priority</th>
                      <th>Reaction target</th>
                      <th>Repair target</th>
                    </tr>
                  </thead>
                  <tbody>
                    {commitmentGroups.map(([ticketType, rows]) =>
                      (rows ?? []).map((row, index) => (
                        <tr key={`${ticketType}-${row.provider_priority}`}>
                          <td className="grp">
                            {index === 0 ? ticketType : ''}
                          </td>
                          <td>{row.einstein_label}</td>
                          <td>{row.provider_priority}</td>
                          <td>{row.reaction_hours} h</td>
                          <td>{row.repair_hours} h</td>
                        </tr>
                      )),
                    )}
                  </tbody>
                </table>
              </div>
              {att && (
                <p className="note" style={{ marginTop: 12 }}>
                  {att.observed_priorities.length > 0
                    ? `Tickets in ${year} carry Einstein priority ${att.observed_priorities.join(
                        ' / ',
                      )} (${att.observed_bands.join(' / ')}). `
                    : ''}
                  Measured here as repair within{' '}
                  {att.targets
                    .filter(
                      (t) =>
                        att.observed_bands.length === 0 ||
                        att.observed_bands.includes(t.band),
                    )
                    .map((t) => `${t.target_days} day(s) (${t.ticket_type})`)
                    .join(' · ')}
                  , at calendar-day granularity. Reaction-time targets are not
                  tracked.
                </p>
              )}
              {att && att.by_type.length > 0 && (
                <div className="rct-table-wrap" style={{ marginTop: 12 }}>
                  <table className="rct-table">
                    <thead>
                      <tr>
                        <th scope="col">Breakdown</th>
                        <th scope="col">Closed</th>
                        <th scope="col">Within target</th>
                        <th scope="col">Breached</th>
                        <th scope="col">Attainment</th>
                      </tr>
                    </thead>
                    <tbody>
                      {[...att.by_type, ...att.by_band].map((group, index) => (
                        <tr key={`${group.key}-${index}`}>
                          <th scope="row">
                            {index < att.by_type.length
                              ? group.key
                              : `${group.key} priority`}
                          </th>
                          <td>{group.closed}</td>
                          <td>{group.within_target}</td>
                          <td>{group.breached}</td>
                          <td>
                            {group.attainment_pct !== null
                              ? `${group.attainment_pct.toFixed(1)}%`
                              : '—'}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </AsyncSection>
          </section>

          {/* ---- Trends -------------------------------------------------- */}
          <section className="blk">
            <SectionHeading dotColor={DOT}>
              Ticket volume &amp; shift-left trend
            </SectionHeading>
            <p className="note">
              L1 vs L2 ticket volume by month, across all available years — the
              clearest read on whether the desk is absorbing more work and
              whether L1 is taking a growing share of it (target ≥ 80% L1).
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
            <SectionHeading dotColor={DOT}>
              Resolution SLA attainment by month ({year})
            </SectionHeading>
            <p className="note">
              Share of tickets opened each month that were resolved within the
              restore target. Target line at {ATTAINMENT_TARGET_PCT}%.
            </p>
            <AsyncSection
              isPending={attainment.isPending}
              isError={attainment.isError}
              error={attainment.error}
              loadingLabel="Loading attainment trend…"
            >
              {attainmentTrend.length > 0 ? (
                <TrendChart
                  data={attainmentTrend}
                  xKey="period"
                  series={[{ key: 'attainment', label: 'Attainment' }]}
                  valueFormatter={(value) => `${value.toFixed(0)}%`}
                  referenceValue={ATTAINMENT_TARGET_PCT}
                  referenceLabel={`Target ${ATTAINMENT_TARGET_PCT}%`}
                />
              ) : (
                <p className="note">No closed tickets with dates for {year}.</p>
              )}
            </AsyncSection>
          </section>

          {/* ---- Quality breakdown ------------------------------------- */}
          <section className="blk">
            <SectionHeading dotColor={DOT}>
              Root cause &amp; request type — L1 / L2
            </SectionHeading>
            <p className="note">
              Breakdown of requests handled by L1 and L2: root cause (top 4 +
              Other) and Service Request vs. Incident share, {year}.
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
                    return (
                      <div key={level}>
                        <p className="l1l2-head">{level.toUpperCase()}</p>
                        {donut.total_tickets === 0 ? (
                          <p className="note">No tickets for {year}.</p>
                        ) : (
                          <>
                            <RankBarChart
                              data={donut.root_causes.map((row) => ({
                                label: row.label,
                                value: row.pct,
                              }))}
                              valueFormatter={(value) => `${value.toFixed(0)}%`}
                              color={chartSeries[0]}
                            />
                            <div className="stat-pair">
                              <div className="sp-box">
                                <div className="n">
                                  {donut.service_request_pct.toFixed(0)}%
                                </div>
                                <div className="l">Service Request</div>
                              </div>
                              <div className="sp-box">
                                <div className="n">
                                  {donut.incident_pct.toFixed(0)}%
                                </div>
                                <div className="l">Incident</div>
                              </div>
                            </div>
                          </>
                        )}
                      </div>
                    )
                  })}
                </div>
              )}
            </AsyncSection>
          </section>

          <section className="blk">
            <SectionHeading dotColor={DOT}>
              Where quality is lost — root causes &amp; resolution speed
            </SectionHeading>
            <p className="note">
              What breaks most often (all years), and how long each root cause
              takes to resolve on average — the two views together show where to
              focus improvement effort.
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
                    color={chartSeries[0]}
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
                    color={chartSeries[1]}
                  />
                </div>
              </div>
            </AsyncSection>
          </section>

          <section className="blk">
            <SectionHeading dotColor={DOT}>
              Backlog aging — open tickets right now
            </SectionHeading>
            <p className="note">
              Age distribution of the current open backlog. The Open Backlog
              Aging KPI counts everything past 14 days — which falls inside the
              “8-15 days” band below.
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
                color={chart.neutral}
              />
            </AsyncSection>
          </section>
        </div>
      </div>
    </div>
  )
}
