import { getJson } from './client'

export interface ApqcCategory {
  id: number
  pcf_id: number
  hierarchy_id: string
  name: string
}

export interface ApqcProcessGroup {
  id: number
  pcf_id: number
  hierarchy_id: string
  name: string
  category_id: number
}

export interface ApqcProcess {
  id: number
  pcf_id: number
  hierarchy_id: string
  name: string
  process_group_id: number
}

export async function fetchApqcCategories(): Promise<ApqcCategory[]> {
  return getJson<ApqcCategory[]>('/api/v1/apqc/categories')
}

export async function fetchApqcProcessGroups(
  categoryId: number,
): Promise<ApqcProcessGroup[]> {
  return getJson<ApqcProcessGroup[]>('/api/v1/apqc/process-groups', {
    category_id: categoryId,
  })
}

export async function fetchApqcProcesses(
  processGroupId: number,
): Promise<ApqcProcess[]> {
  return getJson<ApqcProcess[]>('/api/v1/apqc/processes', {
    process_group_id: processGroupId,
  })
}
