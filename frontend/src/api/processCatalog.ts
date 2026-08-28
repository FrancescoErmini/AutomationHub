import { getJson } from './client'

export interface ProcessCatalogItem {
  title: string
  department: string
  description: string | null
  status: string | null
  is_live: boolean
  company: string | null
  go_live_date: string | null
  applications: string[]
}

export async function fetchProcessCatalog(): Promise<ProcessCatalogItem[]> {
  return getJson<ProcessCatalogItem[]>('/api/v1/process-catalog')
}
