import {
  Bar,
  CartesianGrid,
  ComposedChart,
  Legend,
  Line,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'

import { formatValue } from '../api/metrics'
import type { RunningCostTrendPoint } from '../api/simpleOps'

const SEGMENTS: {
  key: keyof RunningCostTrendPoint
  name: string
  color: string
}[] = [
  {
    key: 'license_eur',
    name: 'Licences',
    color: 'var(--ah-chart-opex-licensing)',
  },
  {
    key: 'infrastructure_eur',
    name: 'Infrastructure',
    color: 'var(--ah-chart-opex-infra)',
  },
  {
    key: 'ams_1l_eur',
    name: 'AMS 1L',
    color: 'var(--ah-chart-opex-personnel)',
  },
  { key: 'ticket_2l_eur', name: '2L tickets', color: 'var(--ah-chart-capex)' },
  {
    key: 'change_request_eur',
    name: 'Change requests',
    color: 'var(--ah-ink-3)',
  },
]

interface RunningCostTrendChartProps {
  data: RunningCostTrendPoint[]
  height?: number
}

export function RunningCostTrendChart({
  data,
  height = 320,
}: RunningCostTrendChartProps) {
  return (
    <div>
      <div style={{ height }}>
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart
            data={data}
            margin={{ top: 8, right: 16, bottom: 0, left: 0 }}
          >
            <CartesianGrid stroke="var(--ah-chart-grid)" vertical={false} />
            <XAxis
              dataKey="year"
              tick={{ fill: 'var(--ah-ink-2)', fontSize: 12 }}
              stroke="var(--ah-chart-axis)"
            />
            <YAxis
              tick={{ fill: 'var(--ah-ink-2)', fontSize: 12 }}
              stroke="var(--ah-chart-axis)"
              width={72}
              tickFormatter={(value) => formatValue(value, 'eur')}
            />
            <Tooltip
              formatter={(value) => formatValue(Number(value), 'eur')}
              contentStyle={{
                borderRadius: 8,
                borderColor: 'var(--ah-border-strong)',
                fontSize: 13,
              }}
            />
            <Legend wrapperStyle={{ fontSize: 12 }} />
            {SEGMENTS.map((segment) => (
              <Bar
                key={segment.key}
                dataKey={segment.key}
                name={segment.name}
                stackId="cost"
                fill={segment.color}
              />
            ))}
            <Line
              type="monotone"
              dataKey="total_eur"
              name="Total"
              stroke="var(--ah-ink)"
              strokeWidth={2}
              dot={{ r: 3 }}
              activeDot={{ r: 5 }}
            />
          </ComposedChart>
        </ResponsiveContainer>
      </div>

      <div className="rct-table-wrap">
        <table className="rct-table">
          <caption className="sr-only">
            Total running cost by year: licences, infrastructure, AMS 1L, 2L
            tickets and change requests
          </caption>
          <thead>
            <tr>
              <th scope="col">Component</th>
              {data.map((point) => (
                <th key={point.year} scope="col">
                  {point.year}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {SEGMENTS.map((segment) => (
              <tr key={segment.key}>
                <th scope="row">
                  <span
                    className="rct-swatch"
                    style={{ background: segment.color }}
                  />
                  {segment.name}
                </th>
                {data.map((point) => (
                  <td key={point.year}>
                    {formatValue(point[segment.key] as number, 'eur')}
                  </td>
                ))}
              </tr>
            ))}
            <tr className="rct-total-row">
              <th scope="row">Total</th>
              {data.map((point) => (
                <td key={point.year}>{formatValue(point.total_eur, 'eur')}</td>
              ))}
            </tr>
          </tbody>
        </table>
      </div>
      <p className="rct-footnote">
        * Costs here are allocated per calendar year (licences, VMs, tickets),
        so they better reflect that year's actual usage — but are less accurate
        for financial reporting than the net-cash-flow view on the Executive
        page, since some purchases (multi-year licences, ticket bundles) don't
        land in the year they're used.
      </p>
    </div>
  )
}
