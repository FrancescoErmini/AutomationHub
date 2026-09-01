import { getJson } from './client'
import type { MetricMap } from './metrics'

export interface RunningCostTrendPoint {
  year: number
  license_eur: number
  infrastructure_eur: number
  ams_1l_eur: number
  ticket_2l_eur: number
  change_request_eur: number
  total_eur: number
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

export interface SlaCommitmentRow {
  ticket_type: string
  provider_priority: string
  einstein_label: string
  reaction_hours: number
  repair_hours: number
}

export interface SlaResolvedTarget {
  ticket_type: string
  band: string
  reaction_hours: number
  repair_hours: number
  target_days: number
}

export interface SlaAttainmentGroup {
  key: string
  closed: number
  within_target: number
  breached: number
  attainment_pct: number | null
}

export interface SlaAttainmentMonth {
  period: string
  closed: number
  within_target: number
  attainment_pct: number | null
}

export interface SlaAttainmentOpenTicket {
  ticket_id: string
  ticket_type: string
  band: string
  process: string | null
  age_days: number
  target_days: number
}

export interface SlaAttainment {
  headline_pct: number | null
  status: 'green' | 'amber' | 'red' | 'unavailable'
  closed: number
  within_target: number
  breached: number
  open_over_target_count: number
  observed_priorities: string[]
  observed_bands: string[]
  targets: SlaResolvedTarget[]
  by_type: SlaAttainmentGroup[]
  by_band: SlaAttainmentGroup[]
  by_month: SlaAttainmentMonth[]
  open_over_target: SlaAttainmentOpenTicket[]
  caveat: string
}

export interface ProcessCostRow {
  process: string
  license_eur: number
  infrastructure_eur: number
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

export async function fetchSlaCommitments(): Promise<SlaCommitmentRow[]> {
  return getJson<SlaCommitmentRow[]>('/api/v1/simple-ops/sla-commitments')
}

export async function fetchSlaAttainment(
  year?: number,
): Promise<SlaAttainment> {
  return getJson<SlaAttainment>('/api/v1/simple-ops/sla-attainment', { year })
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
