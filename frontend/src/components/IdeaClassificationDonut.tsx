import { useMemo } from 'react'
import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from 'recharts'

import type { Idea } from '../api/ideas'
import { formatValue } from '../api/metrics'
import {
  CLASSIFICATION_COLORS,
  CLASSIFICATION_FALLBACK_COLOR,
  CLASSIFICATION_ORDER,
} from '../lib/ideaCharts'

interface IdeaClassificationDonutProps {
  ideas: Idea[]
  height?: number
}

interface Slice {
  name: string
  count: number
  roi: number
  color: string
}

export function IdeaClassificationDonut({
  ideas,
  height = 260,
}: IdeaClassificationDonutProps) {
  const slices = useMemo<Slice[]>(() => {
    const byClass = new Map<string, { count: number; roi: number }>()
    for (const idea of ideas) {
      const key = idea.final_classification
      const entry = byClass.get(key) ?? { count: 0, roi: 0 }
      entry.count += 1
      entry.roi += Number(idea.gross_roi_eur) || 0
      byClass.set(key, entry)
    }
    return [...byClass.entries()]
      .map(([name, { count, roi }]) => ({
        name,
        count,
        roi,
        color: CLASSIFICATION_COLORS[name] ?? CLASSIFICATION_FALLBACK_COLOR,
      }))
      .sort(
        (a, b) =>
          CLASSIFICATION_ORDER.indexOf(a.name) -
          CLASSIFICATION_ORDER.indexOf(b.name),
      )
  }, [ideas])

  const total = ideas.length

  return (
    <div>
      <div style={{ height }} className="relative">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={slices}
              dataKey="count"
              nameKey="name"
              innerRadius="62%"
              outerRadius="92%"
              paddingAngle={slices.length > 1 ? 2 : 0}
              stroke="#FFFFFF"
              strokeWidth={2}
            >
              {slices.map((slice) => (
                <Cell key={slice.name} fill={slice.color} />
              ))}
            </Pie>
            <Tooltip
              content={({ active, payload }) => {
                if (!active || !payload?.length) return null
                const slice = payload[0].payload as Slice
                return (
                  <div className="rounded-lg border border-slate-300 bg-white p-3 text-sm shadow-card">
                    <p className="font-semibold text-ink">{slice.name}</p>
                    <p className="mt-1 text-slate-600">
                      {slice.count} {slice.count === 1 ? 'idea' : 'ideas'} ·{' '}
                      {formatValue(slice.roi, 'eur')}
                    </p>
                  </div>
                )
              }}
            />
          </PieChart>
        </ResponsiveContainer>
        <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-2xl font-bold text-ink">{total}</span>
          <span className="text-xs text-slate-500">
            {total === 1 ? 'idea' : 'ideas'}
          </span>
        </div>
      </div>

      <ul className="mt-4 space-y-1.5">
        {slices.map((slice) => (
          <li
            key={slice.name}
            className="flex items-center justify-between gap-3 text-sm"
          >
            <span className="flex items-center gap-2 text-slate-600">
              <span
                aria-hidden="true"
                className="inline-block h-2.5 w-2.5 shrink-0 rounded-full"
                style={{ backgroundColor: slice.color }}
              />
              {slice.name}
            </span>
            <span className="shrink-0 tabular-nums text-slate-500">
              {slice.count} · {formatValue(slice.roi, 'eur')}
            </span>
          </li>
        ))}
      </ul>
    </div>
  )
}
