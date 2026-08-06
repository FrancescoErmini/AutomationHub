import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'

interface RankBarChartProps {
  data: { label: string; value: number }[]
  height?: number
  valueFormatter?: (value: number) => string
  color?: string
}

export function RankBarChart({
  data,
  height,
  valueFormatter,
  color = '#2a78d6',
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
          <CartesianGrid stroke="#e1e0d9" horizontal={false} />
          <XAxis
            type="number"
            tick={{ fill: '#898781', fontSize: 12 }}
            stroke="#c3c2b7"
            tickFormatter={valueFormatter}
          />
          <YAxis
            type="category"
            dataKey="label"
            width={180}
            tick={{ fill: '#52514e', fontSize: 12 }}
            stroke="#c3c2b7"
          />
          <Tooltip
            formatter={(value) =>
              valueFormatter ? valueFormatter(Number(value)) : String(value)
            }
            contentStyle={{
              borderRadius: 8,
              borderColor: '#e1e0d9',
              fontSize: 13,
            }}
          />
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
