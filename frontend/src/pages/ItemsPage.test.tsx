import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { cleanup, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { ItemsPage } from './ItemsPage'

function renderPage() {
  return render(
    <QueryClientProvider
      client={
        new QueryClient({ defaultOptions: { queries: { retry: false } } })
      }
    >
      <ItemsPage />
    </QueryClientProvider>,
  )
}

afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
})

describe('ItemsPage', () => {
  it('renders the empty state', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(JSON.stringify([]), { status: 200 }),
    )
    renderPage()
    expect(await screen.findByText('No items yet')).toBeInTheDocument()
  })

  it('creates and refreshes an item', async () => {
    const fetchMock = vi
      .spyOn(globalThis, 'fetch')
      .mockResolvedValueOnce(new Response(JSON.stringify([]), { status: 200 }))
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            id: 1,
            name: 'Test item',
            description: null,
            created_at: new Date().toISOString(),
          }),
          {
            status: 201,
          },
        ),
      )
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify([
            {
              id: 1,
              name: 'Test item',
              description: null,
              created_at: new Date().toISOString(),
            },
          ]),
          { status: 200 },
        ),
      )
    renderPage()
    await screen.findByText('No items yet')
    await userEvent.type(screen.getByLabelText('Name'), 'Test item')
    await userEvent.click(screen.getByRole('button', { name: 'Create item' }))

    expect(await screen.findByText('Test item')).toBeInTheDocument()
    expect(fetchMock).toHaveBeenCalledTimes(3)
  })
})
