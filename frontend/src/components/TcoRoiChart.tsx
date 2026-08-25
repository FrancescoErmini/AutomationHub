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

import type { TcoRoiPoint } from '../api/executive'

const CAPEX_COLOR = '#1d4ed8'
const OPEX_COLOR = '#60a5fa'
const SAVINGS_COLOR = '#047857'
const NET_BENEFIT_COLOR = '#d97706'

interface TcoRoiChartProps {
  data: TcoRoiPoint[]
  valueFormatter: (value: number) => string
  height?: number
}

const OPEX_SUBTYPE_LABELS: Record<string, string> = {
  AMS: 'AMS support',
  CR: 'Change requests',
  LICENSES: 'Licences',
  INFRA: 'Infrastructure',
  DEVELOPMENT: 'Development',
  OTHER: 'Other',
}
const OPEX_SUBTYPE_ORDER = ['AMS', 'CR', 'LICENSES', 'INFRA', 'DEVELOPMENT', 'OTHER']

export function TcoRoiChart({ data, valueFormatter, height = 360 }: TcoRoiChartProps) {
  const opexSubtypes = OPEX_SUBTYPE_ORDER.filter((subtype) =>
    data.some((point) => (point.opex_breakdown[subtype] ?? 0) !== 0),
  )

  return (
    <div>
      <div style={{ height }}>
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart data={data} margin={{ top: 8, right: 16, bottom: 0, left: 0 }}>
            <CartesianGrid stroke="#e1e0d9" vertical={false} />
            <XAxis dataKey="year" tick={{ fill: '#898781', fontSize: 12 }} stroke="#c3c2b7" />
            <YAxis
              tick={{ fill: '#898781', fontSize: 12 }}
              stroke="#c3c2b7"
              width={72}
              tickFormatter={valueFormatter}
            />
            <Tooltip
              formatter={(value) => valueFormatter(Number(value))}
              contentStyle={{ borderRadius: 8, borderColor: '#e1e0d9', fontSize: 13 }}
            />
            <Legend wrapperStyle={{ fontSize: 12 }} />
            <Bar
              dataKey="capex_eur"
              name="CAPEX"
              stackId="cost"
              fill={CAPEX_COLOR}
              stroke="#fcfcfb"
              strokeWidth={2}
            />
            <Bar
              dataKey="opex_eur"
              name="OPEX"
              stackId="cost"
              fill={OPEX_COLOR}
              stroke="#fcfcfb"
              strokeWidth={2}
            />
            <Line
              type="monotone"
              dataKey="savings_eur"
              name="Savings (FTE)"
              stroke={SAVINGS_COLOR}
              strokeWidth={2}
              dot={{ r: 3 }}
              activeDot={{ r: 5 }}
            />
            <Line
              type="monotone"
              dataKey="net_benefit_eur"
              name="Net benefit"
              stroke={NET_BENEFIT_COLOR}
              strokeWidth={2}
              dot={{ r: 3 }}
              activeDot={{ r: 5 }}
            />
          </ComposedChart>
        </ResponsiveContainer>
      </div>

      <div className="mt-4 overflow-x-auto rounded-2xl border border-slate-200">
        <table className="w-full text-sm">
          <caption className="sr-only">TCO &amp; ROI by year: CAPEX, OPEX, savings, and net benefit</caption>
          <thead>
            <tr className="border-b border-slate-200 bg-slate-50 text-xs font-semibold uppercase tracking-wide text-slate-500">
              <th scope="col" className="px-4 py-3 text-left">
                Metric
              </th>
              {data.map((point) => (
                <th key={point.year} scope="col" className="px-4 py-3 text-right">
                  {point.year}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            <tr className="border-b border-slate-100">
              <th
                scope="row"
                className="flex items-center gap-2 px-4 py-3 text-left font-medium text-ink"
              >
                <span
                  aria-hidden="true"
                  className="inline-block h-2.5 w-2.5 rounded-full"
                  style={{ backgroundColor: CAPEX_COLOR }}
                />
                CAPEX
              </th>
              {data.map((point) => (
                <td key={point.year} className="px-4 py-3 text-right tabular-nums">
                  {valueFormatter(point.capex_eur)}
                </td>
              ))}
            </tr>

            <tr className="border-b border-slate-100">
              <th
                scope="row"
                className="flex items-center gap-2 px-4 py-3 text-left font-medium text-ink"
              >
                <span
                  aria-hidden="true"
                  className="inline-block h-2.5 w-2.5 rounded-full"
                  style={{ backgroundColor: OPEX_COLOR }}
                />
                OPEX
              </th>
              {data.map((point) => (
                <td key={point.year} className="px-4 py-3 text-right tabular-nums">
                  {valueFormatter(point.opex_eur)}
                </td>
              ))}
            </tr>

            {opexSubtypes.map((subtype) => (
              <tr key={subtype} className="border-b border-slate-100 bg-slate-50/50">
                <th scope="row" className="px-4 py-2 pl-9 text-left text-xs font-normal text-slate-500">
                  {OPEX_SUBTYPE_LABELS[subtype] ?? subtype}
                </th>
                {data.map((point) => (
                  <td key={point.year} className="px-4 py-2 text-right text-xs tabular-nums text-slate-500">
                    {valueFormatter(point.opex_breakdown[subtype] ?? 0)}
                  </td>
                ))}
              </tr>
            ))}

            <tr className="border-b border-slate-100">
              <th
                scope="row"
                className="flex items-center gap-2 px-4 py-3 text-left font-medium text-ink"
              >
                <span
                  aria-hidden="true"
                  className="inline-block h-2.5 w-2.5 rounded-full"
                  style={{ backgroundColor: SAVINGS_COLOR }}
                />
                Savings (FTE)
              </th>
              {data.map((point) => (
                <td key={point.year} className="px-4 py-3 text-right tabular-nums">
                  {valueFormatter(point.savings_eur)}
                </td>
              ))}
            </tr>

            <tr className="last:border-0">
              <th
                scope="row"
                className="flex items-center gap-2 px-4 py-3 text-left font-medium text-ink"
              >
                <span
                  aria-hidden="true"
                  className="inline-block h-2.5 w-2.5 rounded-full"
                  style={{ backgroundColor: NET_BENEFIT_COLOR }}
                />
                Net benefit
              </th>
              {data.map((point) => (
                <td key={point.year} className="px-4 py-3 text-right tabular-nums">
                  {valueFormatter(point.net_benefit_eur)}
                </td>
              ))}
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  )
}
