import { apiFetch, parseResponse } from './client'

export type Role = 'user' | 'editor' | 'admin'

export interface Me {
  email: string | null
  preferred_username: string | null
  name: string | null
  role: Role
}

export async function fetchMe(): Promise<Me> {
  return parseResponse<Me>(await apiFetch('/api/v1/me'))
}
