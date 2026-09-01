import {
  Bar,
  BarChart,
  CartesianGrid,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'

import { chart, chartSeries } from '../lib/chartColors'

interface RankBarChartProps {
  data: { label: string; value: number }[]
  height?: number
  valueFormatter?: (value: number) => string
  color?: string
  /** Optional vertical target line on the value axis (e.g. an SLA threshold). */
  referenceValue?: number
  referenceLabel?: string
}

export function RankBarChart({
  data,
  height,
  valueFormatter,
  color = chartSeries[0],
  referenceValue,
  referenceLabel,
}: RankBarChartProps) {
  const computedHeight = height ?? Math.max(160, data.length * 36)

  return (
    <div style={{ height: computedHeight }}>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart
          data={data}
          layout="vertical"
          margin={{ top: 4, right: 24, bottom: 4, left: 8 }}
        >
          <CartesianGrid stroke={chart.grid} horizontal={false} />
          <XAxis
            type="number"
            tick={{ fill: chart.tick, fontSize: 12 }}
            stroke={chart.axis}
            tickFormatter={valueFormatter}
          />
          <YAxis
            type="category"
            dataKey="label"
            width={180}
            tick={{ fill: chart.neutral, fontSize: 12 }}
            stroke={chart.axis}
          />
          <Tooltip
            formatter={(value) =>
              valueFormatter ? valueFormatter(Number(value)) : String(value)
            }
            contentStyle={{
              borderRadius: 8,
              borderColor: chart.tooltipBorder,
              fontSize: 13,
            }}
          />
          {referenceValue !== undefined && (
            <ReferenceLine
              x={referenceValue}
              stroke={chart.negative}
              strokeDasharray="4 4"
              label={
                referenceLabel
                  ? {
                      value: referenceLabel,
                      position: 'top',
                      fill: chart.negative,
                      fontSize: 11,
                    }
                  : undefined
              }
            />
          )}
          <Bar
            dataKey="value"
            fill={color}
            radius={[0, 4, 4, 0]}
            maxBarSize={22}
          />
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}
