import { getJson } from './client'
import type { MetricMap, MetricValue } from './metrics'
import type { TrendPoint } from './executive'

export interface AvgResolutionRow {
  label: string
  avg_days: number
}

export interface ResolutionBreakdown {
  by_root_cause: AvgResolutionRow[]
  by_process: AvgResolutionRow[]
  by_company: AvgResolutionRow[]
}

export async function fetchServicePerformanceKpis(
  asOf?: string,
): Promise<MetricMap> {
  return getJson<MetricMap>('/api/v1/service-performance/kpis', { as_of: asOf })
}

export async function fetchSlaTrend(): Promise<TrendPoint[]> {
  return getJson<TrendPoint[]>('/api/v1/service-performance/sla-trend')
}

export async function fetchResolution(): Promise<ResolutionBreakdown> {
  return getJson<ResolutionBreakdown>('/api/v1/service-performance/resolution')
}

export async function fetchDataQuality(): Promise<MetricValue[]> {
  return getJson<MetricValue[]>('/api/v1/service-performance/data-quality')
}
