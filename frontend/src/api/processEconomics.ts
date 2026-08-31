import { apiFetch, getJson, parseResponse } from './client'

export interface ProcessEconomicsRow {
  id: number
  process_id: number
  process_name: string
  capex_eur: number
  roi_expected_yr: number | null
  fte_hours_month_actual: number
  extra_annual_saving_eur: number
  note: string | null
}

export interface ProcessOption {
  id: number
  canonical_name: string
  has_economics: boolean
}

export interface ProcessEconomicsCreate {
  process_id: number
  capex_eur: number
  roi_expected_yr: number | null
  fte_hours_month_actual: number
  extra_annual_saving_eur: number
  note: string | null
}

export type ProcessEconomicsUpdate = Omit<ProcessEconomicsCreate, 'process_id'>

export async function fetchProcessEconomics(): Promise<ProcessEconomicsRow[]> {
  return getJson<ProcessEconomicsRow[]>('/api/v1/process-economics')
}

export async function fetchProcessOptions(): Promise<ProcessOption[]> {
  return getJson<ProcessOption[]>('/api/v1/process-economics/process-options')
}

export async function createProcessEconomics(
  payload: ProcessEconomicsCreate,
): Promise<ProcessEconomicsRow> {
  return parseResponse<ProcessEconomicsRow>(
    await apiFetch('/api/v1/process-economics', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    }),
  )
}

export async function updateProcessEconomics(
  id: number,
  payload: ProcessEconomicsUpdate,
): Promise<ProcessEconomicsRow> {
  return parseResponse<ProcessEconomicsRow>(
    await apiFetch(`/api/v1/process-economics/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    }),
  )
}

export async function deleteProcessEconomics(id: number): Promise<void> {
  const response = await apiFetch(`/api/v1/process-economics/${id}`, {
    method: 'DELETE',
  })
  if (!response.ok) {
    await parseResponse(response)
  }
}
