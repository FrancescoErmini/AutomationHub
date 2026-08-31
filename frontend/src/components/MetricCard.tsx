import { formatMetric } from '../api/metrics'
import type { MetricValue } from '../api/metrics'

interface MetricCardProps {
  label: string
  metric: MetricValue | undefined
  /** Color the value green/red by its sign (e.g. a net-position metric). */
  signColor?: boolean
}

export function MetricCard({ label, metric, signColor }: MetricCardProps) {
  const available = Boolean(metric?.available) && metric?.value !== null
  const numericValue = typeof metric?.value === 'number' ? metric.value : null

  const valueClass =
    available && signColor && numericValue !== null
      ? numericValue >= 0
        ? 'text-positive'
        : 'text-negative'
      : available
        ? 'text-ink'
        : 'text-slate-400'

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-card">
      <p className="text-[10px] font-semibold uppercase tracking-[0.1em] text-accent">
        {label}
      </p>
      <p
        className={`mt-2 text-2xl font-bold tracking-tight [font-feature-settings:'pnum'_1] ${valueClass}`}
      >
        {formatMetric(metric)}
      </p>
      {metric && metric.warnings.length > 0 && (
        <p className="mt-2 text-xs text-slate-500">{metric.warnings[0]}</p>
      )}
    </div>
  )
}
