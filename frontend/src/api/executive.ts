import { getJson } from './client'
import type { MetricMap } from './metrics'

export interface TrendPoint {
  period: string
  value: number
  [key: string]: string | number
}

export interface ExecutiveTrends {
  saving_by_month: TrendPoint[]
  tickets_by_month: TrendPoint[]
}

export async function fetchExecutiveKpis(company?: string): Promise<MetricMap> {
  return getJson<MetricMap>('/api/v1/executive/kpis', { company })
}

export async function fetchExecutiveTrends(): Promise<ExecutiveTrends> {
  return getJson<ExecutiveTrends>('/api/v1/executive/trends')
}

export interface TcoTrendPoint {
  year: number
  capex_eur: number
  license_eur: number
  infrastructure_eur: number
  ams_eur: number
  total_eur: number
}

export interface SavingsPaybackPoint {
  year: number
  cumulative_spend_eur: number
  cumulative_saving_eur: number
}

export async function fetchExecutiveTcoTrend(): Promise<TcoTrendPoint[]> {
  return getJson<TcoTrendPoint[]>('/api/v1/executive/tco-trend')
}

export async function fetchExecutiveSavingsPayback(): Promise<SavingsPaybackPoint[]> {
  return getJson<SavingsPaybackPoint[]>('/api/v1/executive/savings-payback')
}
