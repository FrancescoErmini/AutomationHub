import { useMemo } from 'react'
import {
  CartesianGrid,
  Cell,
  ReferenceLine,
  ResponsiveContainer,
  Scatter,
  ScatterChart,
  Tooltip,
  XAxis,
  YAxis,
  ZAxis,
} from 'recharts'

import type { Idea } from '../api/ideas'
import { formatValue } from '../api/metrics'
import { chart } from '../lib/chartColors'
import {
  CLASSIFICATION_COLORS,
  CLASSIFICATION_FALLBACK_COLOR,
} from '../lib/ideaCharts'
import { DEFAULT_ROI_THRESHOLD_EUR } from '../lib/ideaScoring'

const FEASIBILITY_X: Record<string, number> = { Low: 1, Medium: 2, High: 3 }
const X_LABELS: Record<number, string> = { 1: 'Low', 2: 'Medium', 3: 'High' }

interface IdeaFeasibilityMatrixProps {
  ideas: Idea[]
  height?: number
}

interface Point {
  x: number
  y: number
  z: number
  title: string
  feasibility: string
  classification: string
  color: string
}

export function IdeaFeasibilityMatrix({
  ideas,
  height = 300,
}: IdeaFeasibilityMatrixProps) {
  const points = useMemo<Point[]>(
    () =>
      ideas.map((idea) => {
        const roi = Number(idea.gross_roi_eur) || 0
        return {
          x: FEASIBILITY_X[idea.feasibility_band] ?? 2,
          y: roi,
          z: Math.max(roi, 1),
          title: idea.title,
          feasibility: idea.feasibility_band,
          classification: idea.final_classification,
          color:
            CLASSIFICATION_COLORS[idea.final_classification] ??
            CLASSIFICATION_FALLBACK_COLOR,
        }
      }),
    [ideas],
  )

  return (
    <div>
      <div style={{ height }}>
        <ResponsiveContainer width="100%" height="100%">
          <ScatterChart margin={{ top: 8, right: 16, bottom: 4, left: 8 }}>
            <CartesianGrid stroke={chart.grid} />
            <XAxis
              type="number"
              dataKey="x"
              name="Feasibility"
              domain={[0.5, 3.5]}
              ticks={[1, 2, 3]}
              tickFormatter={(value: number) => X_LABELS[value] ?? ''}
              tick={{ fill: chart.tick, fontSize: 12 }}
              stroke={chart.axis}
            />
            <YAxis
              type="number"
              dataKey="y"
              name="Gross ROI"
              width={72}
              tickFormatter={(value: number) => formatValue(value, 'eur')}
              tick={{ fill: chart.tick, fontSize: 12 }}
              stroke={chart.axis}
            />
            <ZAxis type="number" dataKey="z" range={[60, 520]} />
            <ReferenceLine
              y={DEFAULT_ROI_THRESHOLD_EUR}
              stroke={chart.tick}
              strokeDasharray="4 4"
              label={{
                value: `ROI threshold ${formatValue(
                  DEFAULT_ROI_THRESHOLD_EUR,
                  'eur',
                )}`,
                position: 'insideTopRight',
                fill: chart.tick,
                fontSize: 11,
              }}
            />
            <Tooltip
              cursor={{ strokeDasharray: '3 3' }}
              contentStyle={{
                borderRadius: 8,
                borderColor: chart.tooltipBorder,
                fontSize: 13,
              }}
              content={({ active, payload }) => {
                if (!active || !payload?.length) return null
                const p = payload[0].payload as Point
                return (
                  <div className="rounded-lg border border-slate-300 bg-white p-3 text-sm shadow-card">
                    <p className="font-semibold text-ink">{p.title}</p>
                    <p className="mt-1 text-slate-600">
                      {p.feasibility} feasibility · {formatValue(p.y, 'eur')}{' '}
                      ROI
                    </p>
                    <p className="text-slate-500">{p.classification}</p>
                  </div>
                )
              }}
            />
            <Scatter data={points} fillOpacity={0.7}>
              {points.map((point, index) => (
                <Cell key={index} fill={point.color} />
              ))}
            </Scatter>
          </ScatterChart>
        </ResponsiveContainer>
      </div>

      <ul className="mt-4 flex flex-wrap gap-x-4 gap-y-1.5">
        {Object.entries(CLASSIFICATION_COLORS).map(([name, color]) => (
          <li
            key={name}
            className="flex items-center gap-2 text-xs text-slate-600"
          >
            <span
              aria-hidden="true"
              className="inline-block h-2.5 w-2.5 rounded-full"
              style={{ backgroundColor: color }}
            />
            {name}
          </li>
        ))}
      </ul>
      <p className="mt-2 text-xs text-slate-500">
        Bubble size scales with gross ROI. Feasibility band comes from the
        assessment wizard.
      </p>
    </div>
  )
}
