import {
  Area,
  CartesianGrid,
  ComposedChart,
  Legend,
  Line,
  ReferenceDot,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'

interface PaybackAreaChartProps {
  data: Array<Record<string, string | number>>
  xKey: string
  spendKey: string
  savingKey: string
  height?: number
  valueFormatter?: (value: number) => string
}

export function PaybackAreaChart({
  data,
  xKey,
  spendKey,
  savingKey,
  height = 320,
  valueFormatter,
}: PaybackAreaChartProps) {
  const paybackPoint = data.find((row) => Number(row[savingKey]) >= Number(row[spendKey]))

  return (
    <div>
      <div style={{ height }}>
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart data={data} margin={{ top: 24, right: 16, bottom: 0, left: 0 }}>
            <CartesianGrid stroke="#e1e0d9" vertical={false} />
            <XAxis dataKey={xKey} tick={{ fill: '#898781', fontSize: 12 }} stroke="#c3c2b7" />
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
            <Area
              type="monotone"
              dataKey={spendKey}
              name="Cumulative spend"
              fill="#2a78d6"
              fillOpacity={0.15}
              stroke="#2a78d6"
              strokeWidth={2}
            />
            <Line
              type="monotone"
              dataKey={savingKey}
              name="Cumulative saving"
              stroke="#eb6834"
              strokeWidth={2}
              dot={{ r: 3 }}
              activeDot={{ r: 5 }}
            />
            {paybackPoint && (
              <ReferenceDot
                x={paybackPoint[xKey] as string | number}
                y={Number(paybackPoint[savingKey])}
                r={6}
                fill="#0ca30c"
                stroke="#fff"
                strokeWidth={2}
                label={{
                  value: `Payback: ${paybackPoint[xKey]}`,
                  position: 'top',
                  fill: '#0ca30c',
                  fontSize: 12,
                  fontWeight: 600,
                }}
              />
            )}
          </ComposedChart>
        </ResponsiveContainer>
      </div>
      <p
        className="mt-2 text-sm font-medium"
        style={{ color: paybackPoint ? '#0ca30c' : '#64748b' }}
      >
        {paybackPoint
          ? `Payback reached in ${paybackPoint[xKey]} — cumulative savings overtook cumulative spend.`
          : 'Payback not yet reached — cumulative spend still exceeds cumulative savings.'}
      </p>
    </div>
  )
}
