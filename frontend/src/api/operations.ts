import { getJson } from './client'
import type { MetricMap } from './metrics'

export interface L1L2TrendPoint {
  period: string
  l1: number
  l2: number
  [key: string]: string | number
}

export interface RootCauseParetoRow {
  root_cause: string
  count: number
}

export interface TopProcessRow {
  process: string
  ticket_count: number
}

export interface BacklogAging {
  backlog_0_3_days: number
  backlog_4_7_days: number
  backlog_8_15_days: number
  backlog_over_15_days: number
}

export async function fetchOperationsKpis(
  company?: string,
): Promise<MetricMap> {
  return getJson<MetricMap>('/api/v1/operations/kpis', { company })
}

export async function fetchSupportLevelTrend(): Promise<L1L2TrendPoint[]> {
  return getJson<L1L2TrendPoint[]>('/api/v1/operations/support-level-trend')
}

export async function fetchRootCausePareto(): Promise<RootCauseParetoRow[]> {
  return getJson<RootCauseParetoRow[]>('/api/v1/operations/root-cause-pareto')
}

export async function fetchTopProcesses(
  limit?: number,
): Promise<TopProcessRow[]> {
  return getJson<TopProcessRow[]>('/api/v1/operations/top-processes', { limit })
}

export async function fetchBacklogAging(asOf?: string): Promise<BacklogAging> {
  return getJson<BacklogAging>('/api/v1/operations/backlog-aging', {
    as_of: asOf,
  })
}
