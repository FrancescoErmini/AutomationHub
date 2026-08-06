import { getJson } from './client'

export interface FilterOptions {
  companies: string[]
}

export async function fetchFilters(): Promise<FilterOptions> {
  return getJson<FilterOptions>('/api/v1/metadata/filters')
}
