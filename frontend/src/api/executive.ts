import { getJson } from './client'
import type { MetricMap, MetricValue } from './metrics'

export interface TrendPoint {
  period: string
  value: number
  [key: string]: string | number
}

export interface ExecutiveTrends {
  saving_by_month: TrendPoint[]
  tickets_by_month: TrendPoint[]
}

export interface CompanySummaryRow {
  company: string
  annual_saving_eur: number
  capex_eur: number
  total_tickets: number
  roi_1_5y_pct: number | null
}

export async function fetchExecutiveKpis(company?: string): Promise<MetricMap> {
  return getJson<MetricMap>('/api/v1/executive/kpis', { company })
}

export async function fetchExecutiveTrends(): Promise<ExecutiveTrends> {
  return getJson<ExecutiveTrends>('/api/v1/executive/trends')
}

export async function fetchExecutiveCompanySummary(): Promise<
  CompanySummaryRow[]
> {
  return getJson<CompanySummaryRow[]>('/api/v1/executive/company-summary')
}

export async function fetchExecutiveCostBreakdown(): Promise<MetricValue[]> {
  return getJson<MetricValue[]>('/api/v1/executive/cost-breakdown')
}
