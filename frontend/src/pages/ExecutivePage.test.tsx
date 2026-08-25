import { cleanup, screen, within } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { metric, mockFetchRoutes, renderWithQueryClient } from '../test/mockFetch'
import { ExecutivePage } from './ExecutivePage'

afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
})

function mockRoutes() {
  return mockFetchRoutes({
    '/api/v1/metadata/filters': { companies: ['Menarini', 'Codifi'] },
    '/api/v1/executive/kpis': {
      kpi_annual_saving_eur: metric('kpi_annual_saving_eur', 17715.6, 'eur'),
      kpi_total_capex_eur: metric('kpi_total_capex_eur', 20700.5, 'eur'),
      kpi_total_saved_to_date_eur: metric('kpi_total_saved_to_date_eur', 12768, 'eur'),
      kpi_total_spend_to_date_eur: metric('kpi_total_spend_to_date_eur', 158700.5, 'eur'),
      kpi_net_position_eur: metric('kpi_net_position_eur', -145932.5, 'eur'),
      kpi_total_tickets: metric('kpi_total_tickets', 709, 'count'),
    },
    '/api/v1/executive/trends': {
      saving_by_month: [{ period: '2021-06', value: 12768 }],
      tickets_by_month: [{ period: '2024-01', value: 5 }],
    },
    '/api/v1/executive/tco-trend': [
      {
        year: 2024,
        capex_eur: 0,
        license_eur: 13000,
        infrastructure_eur: 0,
        ams_eur: 45500,
        total_eur: 58500,
      },
    ],
    '/api/v1/executive/savings-payback': [
      { year: 2024, cumulative_spend_eur: 58500, cumulative_saving_eur: 12768 },
    ],
  })
}

describe('ExecutivePage', () => {
  it('renders the spend-vs-save KPI header, not the old ROI cards', async () => {
    mockRoutes()
    renderWithQueryClient(<ExecutivePage />)

    const kpiSection = await screen.findByRole('region', { name: 'Executive KPIs' })
    expect(within(kpiSection).getByText('Total spent to date')).toBeInTheDocument()
    expect(within(kpiSection).getByText('Total saved to date')).toBeInTheDocument()
    expect(within(kpiSection).getByText('Net position')).toBeInTheDocument()
    expect(within(kpiSection).queryByText('ROI 1.5Y OK %')).not.toBeInTheDocument()
    expect(within(kpiSection).queryByText('ROI 3Y')).not.toBeInTheDocument()
  })

  it('renders the TCO decomposition and payback charts', async () => {
    mockRoutes()
    renderWithQueryClient(<ExecutivePage />)

    expect(
      await screen.findByRole('heading', { name: 'TCO by component, by year' }),
    ).toBeInTheDocument()
    expect(
      screen.getByRole('heading', { name: 'Cumulative savings vs. cumulative spend' }),
    ).toBeInTheDocument()
  })

  it('shows an unavailable metric as text, not a fabricated zero', async () => {
    mockFetchRoutes({
      '/api/v1/metadata/filters': { companies: ['Menarini', 'Codifi'] },
      '/api/v1/executive/kpis': {
        kpi_annual_saving_eur: metric('kpi_annual_saving_eur', 17715.6, 'eur'),
        kpi_total_capex_eur: metric('kpi_total_capex_eur', 20700.5, 'eur'),
        kpi_total_saved_to_date_eur: metric('kpi_total_saved_to_date_eur', 12768, 'eur'),
        kpi_total_spend_to_date_eur: metric('kpi_total_spend_to_date_eur', null, 'eur', false),
        kpi_net_position_eur: metric('kpi_net_position_eur', null, 'eur', false),
        kpi_total_tickets: metric('kpi_total_tickets', 6, 'count'),
      },
      '/api/v1/executive/trends': { saving_by_month: [], tickets_by_month: [] },
      '/api/v1/executive/tco-trend': [],
      '/api/v1/executive/savings-payback': [],
    })
    renderWithQueryClient(<ExecutivePage />)

    expect(await screen.findAllByText('Not available')).not.toHaveLength(0)
    expect(screen.queryByText('€0')).not.toBeInTheDocument()
  })
})
