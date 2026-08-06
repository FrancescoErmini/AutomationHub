import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render } from '@testing-library/react'
import type { ReactElement } from 'react'
import { vi } from 'vitest'
import type { MetricValue } from '../api/metrics'

export function renderWithQueryClient(ui: ReactElement) {
  return render(
    <QueryClientProvider
      client={
        new QueryClient({ defaultOptions: { queries: { retry: false } } })
      }
    >
      {ui}
    </QueryClientProvider>,
  )
}

export function mockFetchRoutes(routes: Record<string, unknown>) {
  return vi.spyOn(globalThis, 'fetch').mockImplementation(async (input) => {
    const url = typeof input === 'string' ? input : input.toString()
    const path = url.split('?')[0]
    if (path in routes) {
      return new Response(JSON.stringify(routes[path]), { status: 200 })
    }
    return new Response(
      JSON.stringify({ error: { message: `No mock for ${path}` } }),
      {
        status: 404,
      },
    )
  })
}

export function metric(
  name: string,
  value: number | string | null,
  unit = 'eur',
  available = true,
): MetricValue {
  return {
    metric_name: name,
    value,
    unit,
    available,
    status: available ? 'ok' : 'unavailable',
    period: null,
    filters: {},
    warnings: [],
    calculated_at: '2024-01-01T00:00:00Z',
  }
}
