import { getJson } from './client'
import type { MetricMap } from './metrics'

export interface RunningCostTrendPoint {
  year: number
  total_eur: number
  estimate: boolean
}

export interface LicenseCostTrendPoint {
  year: number
  cost_eur: number
}

export interface InfrastructureTrendPoint {
  year: number
  cost_eur: number
}

export interface Infrastructure {
  trend: InfrastructureTrendPoint[]
  tbd: boolean
  vm_count: number
  db_count: number
}

export interface HeatmapCell {
  slot: string
  label: string
  count: number
  intensity: number
}

export interface HeatmapRow {
  vm: string
  cells: HeatmapCell[]
}

export interface Ams1LTrendPoint {
  year: number
  cost_eur: number
  process_count: number
}

export interface Ams2LTrendPoint {
  year: number
  cost_eur: number
  ticket_count: number
}

export interface AmsTrend {
  l1: Ams1LTrendPoint[]
  l2: Ams2LTrendPoint[]
}

export interface SlaCard {
  key: string
  label: string
  value: number | null
  unit: string
  target_label: string
  status: 'green' | 'amber' | 'red' | 'unavailable'
  available: boolean
}

export interface RootCauseShare {
  label: string
  count: number
  pct: number
}

export interface QualityDonut {
  root_causes: RootCauseShare[]
  total_tickets: number
  service_request_pct: number
  incident_pct: number
}

export interface QualityBreakdown {
  l1: QualityDonut
  l2: QualityDonut
}

export interface ProcessCostRow {
  process: string
  license_eur: number
  ams_1l_eur: number
  l2_eur: number
  total_eur: number
}

export async function fetchSimpleOpsKpis(year?: number): Promise<MetricMap> {
  return getJson<MetricMap>('/api/v1/simple-ops/kpis', { year })
}

export async function fetchRunningCostTrend(): Promise<
  RunningCostTrendPoint[]
> {
  return getJson<RunningCostTrendPoint[]>(
    '/api/v1/simple-ops/running-cost-trend',
  )
}

export async function fetchLicenseCostTrend(): Promise<
  LicenseCostTrendPoint[]
> {
  return getJson<LicenseCostTrendPoint[]>(
    '/api/v1/simple-ops/license-cost-trend',
  )
}

export async function fetchInfrastructure(): Promise<Infrastructure> {
  return getJson<Infrastructure>('/api/v1/simple-ops/infrastructure')
}

export async function fetchOccupancyHeatmap(): Promise<HeatmapRow[]> {
  return getJson<HeatmapRow[]>('/api/v1/simple-ops/occupancy-heatmap')
}

export async function fetchAmsTrend(): Promise<AmsTrend> {
  return getJson<AmsTrend>('/api/v1/simple-ops/ams-trend')
}

export async function fetchSlaKpis(year?: number): Promise<SlaCard[]> {
  return getJson<SlaCard[]>('/api/v1/simple-ops/sla-kpis', { year })
}

export async function fetchQualityBreakdown(
  year?: number,
): Promise<QualityBreakdown> {
  return getJson<QualityBreakdown>('/api/v1/simple-ops/quality-breakdown', {
    year,
  })
}

export async function fetchCostBreakdownByProcess(
  year?: number,
): Promise<ProcessCostRow[]> {
  return getJson<ProcessCostRow[]>(
    '/api/v1/simple-ops/cost-breakdown-by-process',
    {
      year,
    },
  )
}
