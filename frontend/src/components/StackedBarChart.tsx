import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'

interface Series {
  key: string
  label: string
  color: string
}

interface StackedBarChartProps {
  data: Array<Record<string, string | number>>
  xKey: string
  series: Series[]
  height?: number
  valueFormatter?: (value: number) => string
}

export function StackedBarChart({
  data,
  xKey,
  series,
  height = 300,
  valueFormatter,
}: StackedBarChartProps) {
  return (
    <div style={{ height }}>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 8, right: 16, bottom: 0, left: 0 }}>
          <CartesianGrid stroke="#e1e0d9" vertical={false} />
          <XAxis
            dataKey={xKey}
            tick={{ fill: '#898781', fontSize: 12 }}
            stroke="#c3c2b7"
          />
          <YAxis
            tick={{ fill: '#898781', fontSize: 12 }}
            stroke="#c3c2b7"
            width={64}
            tickFormatter={valueFormatter}
          />
          <Tooltip
            formatter={(value) =>
              valueFormatter ? valueFormatter(Number(value)) : String(value)
            }
            contentStyle={{ borderRadius: 8, borderColor: '#e1e0d9', fontSize: 13 }}
          />
          <Legend wrapperStyle={{ fontSize: 12 }} />
          {series.map((item) => (
            <Bar
              key={item.key}
              dataKey={item.key}
              name={item.label}
              stackId="tco"
              fill={item.color}
              stroke="#fcfcfb"
              strokeWidth={2}
            />
          ))}
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}
