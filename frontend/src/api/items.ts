export interface Item {
  id: number
  name: string
  description: string | null
  created_at: string
}

export interface CreateItem {
  name: string
  description?: string
}

async function parseResponse<T>(response: Response): Promise<T> {
  if (!response.ok) {
    const body = (await response.json().catch(() => null)) as {
      error?: { message?: string }
      detail?: string
    } | null
    throw new Error(
      body?.error?.message ??
        body?.detail ??
        `Request failed (${response.status})`,
    )
  }
  return (await response.json()) as T
}

export async function fetchItems(): Promise<Item[]> {
  return parseResponse<Item[]>(await fetch('/api/v1/items'))
}

export async function createItem(payload: CreateItem): Promise<Item> {
  return parseResponse<Item>(
    await fetch('/api/v1/items', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    }),
  )
}
