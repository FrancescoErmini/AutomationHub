import { getJson } from './client'

export interface PersonRow {
  id: number
  email: string
  name: string | null
}

export async function fetchPeople(q: string): Promise<PersonRow[]> {
  return getJson<PersonRow[]>('/api/v1/people', { q: q || undefined })
}
