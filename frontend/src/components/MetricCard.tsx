import { formatMetric } from '../api/metrics'
import type { MetricValue } from '../api/metrics'

interface MetricCardProps {
  label: string
  metric: MetricValue | undefined
}

export function MetricCard({ label, metric }: MetricCardProps) {
  const available = Boolean(metric?.available) && metric?.value !== null

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <p className="text-sm font-semibold text-slate-500">{label}</p>
      <p
        className={`mt-2 text-2xl font-bold tracking-tight ${available ? 'text-ink' : 'text-slate-400'}`}
      >
        {formatMetric(metric)}
      </p>
      {metric && metric.warnings.length > 0 && (
        <p className="mt-2 text-xs text-amber-700">{metric.warnings[0]}</p>
      )}
    </div>
  )
}
