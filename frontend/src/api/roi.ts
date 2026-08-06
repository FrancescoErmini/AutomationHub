import { getJson } from './client'
import type { MetricMap, MetricValue } from './metrics'

export interface RoiProcessRow {
  process: string
  company: string | null
  capex_eur: number
  annual_saving_eur: number
  payback_months: number | null
  roi_1_5y_pct: number | null
  process_tco_available: boolean
}

export interface RoiCompanyRow {
  company: string
  annual_saving_eur: number
  capex_eur: number
  roi_1_5y_pct: number | null
  payback_months: number | null
}

export async function fetchRoiKpis(): Promise<MetricMap> {
  return getJson<MetricMap>('/api/v1/roi/kpis')
}

export async function fetchRoiProcesses(): Promise<RoiProcessRow[]> {
  return getJson<RoiProcessRow[]>('/api/v1/roi/processes')
}

export async function fetchRoiCompanies(): Promise<RoiCompanyRow[]> {
  return getJson<RoiCompanyRow[]>('/api/v1/roi/companies')
}

export async function fetchRoiQuickWins(
  limit?: number,
): Promise<RoiProcessRow[]> {
  return getJson<RoiProcessRow[]>('/api/v1/roi/quick-wins', { limit })
}

export async function fetchRoiCostStack(): Promise<MetricValue[]> {
  return getJson<MetricValue[]>('/api/v1/roi/cost-stack')
}
