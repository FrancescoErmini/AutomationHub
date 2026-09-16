import { apiFetch, getJson, parseResponse } from './client'

export interface AmsYearRow {
  id: number
  code: string
  ordinal: number
  year: number | null
}

export interface AmsYearUpdate {
  code: string
  ordinal: number
  year: number | null
}

export async function fetchAmsYears(): Promise<AmsYearRow[]> {
  return getJson<AmsYearRow[]>('/api/v1/ams-years')
}

export async function createAmsYear(payload: AmsYearUpdate): Promise<AmsYearRow> {
  return parseResponse<AmsYearRow>(
    await apiFetch('/api/v1/ams-years', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    }),
  )
}

export async function updateAmsYear(
  id: number,
  payload: AmsYearUpdate,
): Promise<AmsYearRow> {
  return parseResponse<AmsYearRow>(
    await apiFetch(`/api/v1/ams-years/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    }),
  )
}

export async function deleteAmsYear(id: number): Promise<void> {
  const response = await apiFetch(`/api/v1/ams-years/${id}`, { method: 'DELETE' })
  if (!response.ok) await parseResponse(response)
}
