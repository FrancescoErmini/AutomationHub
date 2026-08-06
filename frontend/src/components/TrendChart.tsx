import {
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'

// Validated categorical palette (dataviz skill), slots 1-2: blue, orange.
const SERIES_COLORS = ['#2a78d6', '#eb6834']

interface Series {
  key: string
  label: string
}

interface TrendChartProps {
  data: Array<Record<string, string | number>>
  xKey: string
  series: Series[]
  height?: number
  valueFormatter?: (value: number) => string
}

export function TrendChart({
  data,
  xKey,
  series,
  height = 260,
  valueFormatter,
}: TrendChartProps) {
  return (
    <div style={{ height }}>
      <ResponsiveContainer width="100%" height="100%">
        <LineChart
          data={data}
          margin={{ top: 8, right: 16, bottom: 0, left: 0 }}
        >
          <CartesianGrid stroke="#e1e0d9" vertical={false} />
          <XAxis
            dataKey={xKey}
            tick={{ fill: '#898781', fontSize: 12 }}
            stroke="#c3c2b7"
          />
          <YAxis
            tick={{ fill: '#898781', fontSize: 12 }}
            stroke="#c3c2b7"
            width={56}
            tickFormatter={valueFormatter}
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
          {series.length > 1 && <Legend wrapperStyle={{ fontSize: 12 }} />}
          {series.map((item, index) => (
            <Line
              key={item.key}
              type="monotone"
              dataKey={item.key}
              name={item.label}
              stroke={SERIES_COLORS[index % SERIES_COLORS.length]}
              strokeWidth={2}
              dot={{ r: 3 }}
              activeDot={{ r: 5 }}
            />
          ))}
        </LineChart>
      </ResponsiveContainer>
    </div>
  )
}
