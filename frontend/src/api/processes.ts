import { apiFetch, getJson, parseResponse } from './client'

export interface ProcessStakeholderRow {
  id: number
  role: string
  person_id: number
  person_email: string
  person_name: string | null
}

export interface ProcessRow {
  id: number
  canonical_name: string
  description: string | null
  documentation_url: string | null
  department_id: number | null
  department_name: string | null
  company_id: number | null
  company_name: string | null
  ams_year_id: number | null
  ams_year_code: string | null
  process_type_id: number | null
  process_type_name: string | null
  status: string | null
  go_live_date: string | null
  in_pipeline: boolean
  stakeholders: ProcessStakeholderRow[]
}

export interface ProcessRefOption {
  id: number
  label: string
}

export interface ProcessOptions {
  companies: ProcessRefOption[]
  departments: ProcessRefOption[]
  ams_years: ProcessRefOption[]
  process_types: ProcessRefOption[]
  roles: string[]
}

export interface ProcessUpdate {
  canonical_name: string
  description: string | null
  documentation_url: string | null
  department_id: number | null
  company_id: number | null
  ams_year_id: number | null
  process_type_id: number | null
  status: string | null
  go_live_date: string | null
  in_pipeline: boolean
}

export async function fetchProcesses(): Promise<ProcessRow[]> {
  return getJson<ProcessRow[]>('/api/v1/processes')
}

export async function fetchProcessOptions(): Promise<ProcessOptions> {
  return getJson<ProcessOptions>('/api/v1/processes/options')
}

export async function createProcess(payload: ProcessUpdate): Promise<ProcessRow> {
  return parseResponse<ProcessRow>(
    await apiFetch('/api/v1/processes', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    }),
  )
}

export async function updateProcess(
  id: number,
  payload: ProcessUpdate,
): Promise<ProcessRow> {
  return parseResponse<ProcessRow>(
    await apiFetch(`/api/v1/processes/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    }),
  )
}

export async function deleteProcess(id: number): Promise<void> {
  const response = await apiFetch(`/api/v1/processes/${id}`, { method: 'DELETE' })
  if (!response.ok) await parseResponse(response)
}

export interface StakeholderCreate {
  role: string
  email: string
  name: string | null
}

export async function addProcessStakeholder(
  processId: number,
  payload: StakeholderCreate,
): Promise<ProcessStakeholderRow> {
  return parseResponse<ProcessStakeholderRow>(
    await apiFetch(`/api/v1/processes/${processId}/stakeholders`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    }),
  )
}

export async function removeProcessStakeholder(
  processId: number,
  stakeholderId: number,
): Promise<void> {
  const response = await apiFetch(
    `/api/v1/processes/${processId}/stakeholders/${stakeholderId}`,
    { method: 'DELETE' },
  )
  if (!response.ok) await parseResponse(response)
}
