let getToken: () => string | undefined = () => undefined
let onUnauthorized: () => void = () => {}

export function configureApiAuth(opts: {
  getToken: () => string | undefined
  onUnauthorized: () => void
}): void {
  getToken = opts.getToken
  onUnauthorized = opts.onUnauthorized
}

export async function apiFetch(
  path: string,
  init: RequestInit = {},
): Promise<Response> {
  const token = getToken()
  const headers = new Headers(init.headers)
  if (token) headers.set('Authorization', `Bearer ${token}`)
  const response = await fetch(path, { ...init, headers })
  if (response.status === 401) onUnauthorized()
  return response
}

export async function parseResponse<T>(response: Response): Promise<T> {
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

export async function getJson<T>(
  path: string,
  params?: Record<string, string | number | undefined>,
): Promise<T> {
  const search = new URLSearchParams()
  for (const [key, value] of Object.entries(params ?? {})) {
    if (value !== undefined) search.set(key, String(value))
  }
  const query = search.toString()
  return parseResponse<T>(await apiFetch(query ? `${path}?${query}` : path))
}
