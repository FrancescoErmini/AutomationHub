import { cleanup, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { mockFetchRoutes, renderWithQueryClient } from '../test/mockFetch'
import { CatalogPage } from './CatalogPage'

afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
})

function mockCatalog(items: unknown[]) {
  return mockFetchRoutes({ '/api/v1/process-catalog': items })
}

describe('CatalogPage', () => {
  it('renders live automations by default', async () => {
    mockCatalog([
      {
        title: 'RPA - Invoice Matching',
        department: 'Finance',
        description: 'Matches invoices to purchase orders.',
        status: 'In production',
        is_live: true,
      },
      {
        title: 'RPA - Expense Auditing',
        department: 'Finance',
        description: 'Flags out-of-policy expense reports.',
        status: 'In development',
        is_live: false,
      },
    ])
    renderWithQueryClient(<CatalogPage />)

    expect(
      await screen.findByText('RPA - Invoice Matching'),
    ).toBeInTheDocument()
    expect(screen.queryByText('RPA - Expense Auditing')).not.toBeInTheDocument()
  })

  it('switches to the pipeline view on toggle', async () => {
    mockCatalog([
      {
        title: 'RPA - Invoice Matching',
        department: 'Finance',
        description: 'Matches invoices to purchase orders.',
        status: 'In production',
        is_live: true,
      },
      {
        title: 'RPA - Expense Auditing',
        department: 'Finance',
        description: 'Flags out-of-policy expense reports.',
        status: 'In development',
        is_live: false,
      },
    ])
    renderWithQueryClient(<CatalogPage />)
    await screen.findByText('RPA - Invoice Matching')

    await userEvent.click(
      screen.getByRole('radio', { name: 'In the pipeline' }),
    )

    expect(
      await screen.findByText('RPA - Expense Auditing'),
    ).toBeInTheDocument()
    expect(screen.queryByText('RPA - Invoice Matching')).not.toBeInTheDocument()
  })

  it('shows an empty state when the pipeline view has no items', async () => {
    mockCatalog([
      {
        title: 'RPA - Invoice Matching',
        department: 'Finance',
        description: 'Matches invoices to purchase orders.',
        status: 'In production',
        is_live: true,
      },
    ])
    renderWithQueryClient(<CatalogPage />)
    await screen.findByText('RPA - Invoice Matching')

    await userEvent.click(
      screen.getByRole('radio', { name: 'In the pipeline' }),
    )

    expect(
      await screen.findByText('Nothing in the pipeline yet.'),
    ).toBeInTheDocument()
  })
})
