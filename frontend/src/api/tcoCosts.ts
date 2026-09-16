import { apiFetch, getJson, parseResponse } from './client'

export type TcoCostType = 'CAPEX' | 'OPEX'

export interface TcoCostRow {
  id: number
  cost_date: string
  cost_eur: number
  cost_type: TcoCostType
  subtype: string | null
  description: string | null
  created_at: string
}

export interface TcoCostOptions {
  subtypes: string[]
}

export interface TcoCostUpdate {
  cost_date: string
  cost_eur: number
  cost_type: TcoCostType
  subtype: string | null
  description: string | null
}

export async function fetchTcoCosts(): Promise<TcoCostRow[]> {
  return getJson<TcoCostRow[]>('/api/v1/tco-costs')
}

export async function fetchTcoCostOptions(): Promise<TcoCostOptions> {
  return getJson<TcoCostOptions>('/api/v1/tco-costs/options')
}

export async function createTcoCost(payload: TcoCostUpdate): Promise<TcoCostRow> {
  return parseResponse<TcoCostRow>(
    await apiFetch('/api/v1/tco-costs', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    }),
  )
}

export async function updateTcoCost(
  id: number,
  payload: TcoCostUpdate,
): Promise<TcoCostRow> {
  return parseResponse<TcoCostRow>(
    await apiFetch(`/api/v1/tco-costs/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    }),
  )
}

export async function deleteTcoCost(id: number): Promise<void> {
  const response = await apiFetch(`/api/v1/tco-costs/${id}`, { method: 'DELETE' })
  if (!response.ok) await parseResponse(response)
}

export interface TcoCostImportRowReport {
  line: number
  description: string | null
  action: 'inserted' | 'skipped'
  errors: string[]
}

export interface TcoCostImportReport {
  committed: boolean
  total_rows: number
  inserted: number
  updated: number
  skipped: number
  rows: TcoCostImportRowReport[]
}

export async function importTcoCostsCsv(
  file: File,
  commit: boolean,
): Promise<TcoCostImportReport> {
  const body = new FormData()
  body.append('file', file)
  body.append('commit', String(commit))
  // No explicit Content-Type: the browser sets the multipart boundary.
  return parseResponse<TcoCostImportReport>(
    await apiFetch('/api/v1/tco-costs/import', { method: 'POST', body }),
  )
}
