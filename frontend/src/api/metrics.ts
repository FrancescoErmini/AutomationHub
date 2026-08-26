export interface MetricValue {
  metric_name: string
  value: number | string | null
  unit: string
  available: boolean
  status: string
  period: string | null
  filters: Record<string, unknown>
  warnings: string[]
  calculated_at: string
}

export type MetricMap = Record<string, MetricValue>

const NOT_AVAILABLE = 'Not available'

export function formatMetric(metric: MetricValue | undefined): string {
  if (!metric || !metric.available || metric.value === null)
    return NOT_AVAILABLE
  return formatValue(metric.value, metric.unit)
}

export function formatValue(value: number | string, unit: string): string {
  if (typeof value === 'string') return value
  switch (unit) {
    case 'eur':
      return new Intl.NumberFormat('en-IE', {
        style: 'currency',
        currency: 'EUR',
        maximumFractionDigits: 0,
      }).format(value)
    case 'pct':
      return `${value.toFixed(1)}%`
    case 'ratio':
      return value.toFixed(2)
    case 'days':
      return `${value.toFixed(1)} days`
    case 'months':
      return `${value.toFixed(1)} mo`
    case 'count':
      return new Intl.NumberFormat('en-IE').format(value)
    case 'fte':
      return `${value.toFixed(1)} FTE`
    default:
      return String(value)
  }
}
