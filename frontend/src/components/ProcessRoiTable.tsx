import { useMemo, useState } from 'react'

import { formatValue } from '../api/metrics'
import type { ProcessRoiRow } from '../api/executive'

type SortKey = 'actual_roi_pct' | 'payback_months' | 'annual_saving_eur' | 'go_live_date'
type StatusFilter = 'all' | 'positive' | 'negative'

interface ProcessRoiTableProps {
  rows: ProcessRoiRow[]
}

function RoiCell({ pct }: { pct: number | null }) {
  if (pct === null) return <span className="text-slate-400">Not available</span>
  const positive = pct >= 0
  return (
    <span className={positive ? 'text-[#0ca30c]' : 'text-[#d03b3b]'}>
      {positive ? '▲' : '▼'} {positive ? '+' : ''}
      {pct.toFixed(1)}%
    </span>
  )
}

export function ProcessRoiTable({ rows }: ProcessRoiTableProps) {
  const [sortKey, setSortKey] = useState<SortKey>('actual_roi_pct')
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all')

  const visibleRows = useMemo(() => {
    let filtered = rows
    if (statusFilter === 'positive') {
      filtered = filtered.filter((row) => (row.actual_roi_pct ?? -Infinity) >= 0)
    } else if (statusFilter === 'negative') {
      filtered = filtered.filter((row) => (row.actual_roi_pct ?? Infinity) < 0)
    }

    return [...filtered].sort((a, b) => {
      if (sortKey === 'go_live_date') {
        return (b.go_live_date ?? '').localeCompare(a.go_live_date ?? '')
      }
      const av = a[sortKey]
      const bv = b[sortKey]
      if (av === null) return 1
      if (bv === null) return -1
      return (bv as number) - (av as number)
    })
  }, [rows, sortKey, statusFilter])

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-4">
        <label className="flex items-center gap-2 text-sm font-semibold text-slate-600">
          Sort by
          <select
            value={sortKey}
            onChange={(event) => setSortKey(event.target.value as SortKey)}
            className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm"
          >
            <option value="actual_roi_pct">Actual ROI</option>
            <option value="payback_months">Payback</option>
            <option value="annual_saving_eur">Annual saving</option>
            <option value="go_live_date">Go-live date</option>
          </select>
        </label>
        <label className="flex items-center gap-2 text-sm font-semibold text-slate-600">
          ROI status
          <select
            value={statusFilter}
            onChange={(event) => setStatusFilter(event.target.value as StatusFilter)}
            className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm"
          >
            <option value="all">All</option>
            <option value="positive">Positive</option>
            <option value="negative">Negative</option>
          </select>
        </label>
      </div>

      <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white shadow-sm">
        <table className="w-full text-sm">
          <caption className="sr-only">
            Per-process ROI: go-live date, CAPEX, annual saving, payback, expected vs. actual ROI
          </caption>
          <thead>
            <tr className="border-b border-slate-200 bg-slate-50 text-xs font-semibold uppercase tracking-wide text-slate-500">
              <th scope="col" className="px-4 py-3 text-left">
                Process
              </th>
              <th scope="col" className="px-4 py-3 text-left">
                Go-live
              </th>
              <th scope="col" className="px-4 py-3 text-right">
                CAPEX
              </th>
              <th scope="col" className="px-4 py-3 text-right">
                Annual saving
              </th>
              <th scope="col" className="px-4 py-3 text-right">
                Payback
              </th>
              <th scope="col" className="px-4 py-3 text-right">
                Cumulative saving since go-live
              </th>
              <th scope="col" className="px-4 py-3 text-right">
                Expected ROI
              </th>
              <th scope="col" className="px-4 py-3 text-right">
                Actual ROI
              </th>
            </tr>
          </thead>
          <tbody>
            {visibleRows.map((row) => (
              <tr key={row.process} className="border-b border-slate-100 last:border-0">
                <td className="px-4 py-3">{row.process}</td>
                <td className="px-4 py-3">{row.go_live_date ?? 'Not live'}</td>
                <td className="px-4 py-3 text-right tabular-nums">
                  {formatValue(row.capex_eur, 'eur')}
                </td>
                <td className="px-4 py-3 text-right tabular-nums">
                  {formatValue(row.annual_saving_eur, 'eur')}
                </td>
                <td className="px-4 py-3 text-right tabular-nums">
                  {row.payback_months === null
                    ? 'Not available'
                    : formatValue(row.payback_months, 'months')}
                </td>
                <td className="px-4 py-3 text-right tabular-nums">
                  {formatValue(row.cumulative_saving_since_go_live_eur, 'eur')}
                </td>
                <td className="px-4 py-3 text-right tabular-nums">
                  <RoiCell pct={row.expected_roi_pct} />
                </td>
                <td className="px-4 py-3 text-right tabular-nums">
                  <RoiCell pct={row.actual_roi_pct} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
