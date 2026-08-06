import { cleanup, screen, within } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'

import {
  metric,
  mockFetchRoutes,
  renderWithQueryClient,
} from '../test/mockFetch'
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
      kpi_roi_1_5y_ok_pct: metric('kpi_roi_1_5y_ok_pct', 28.4, 'pct'),
      kpi_roi_3y_full_cost_pct: metric(
        'kpi_roi_3y_full_cost_pct',
        -61.96,
        'pct',
      ),
      kpi_net_benefit_3y_eur: metric('kpi_net_benefit_3y_eur', -86553.7, 'eur'),
      kpi_run_cost_3y_eur: metric('kpi_run_cost_3y_eur', 119000, 'eur'),
      kpi_total_tickets: metric('kpi_total_tickets', 709, 'count'),
    },
    '/api/v1/executive/trends': {
      saving_by_month: [{ period: '2021-06', value: 12768 }],
      tickets_by_month: [{ period: '2024-01', value: 5 }],
    },
    '/api/v1/executive/company-summary': [
      {
        company: 'Menarini',
        annual_saving_eur: 12768,
        capex_eur: 12500,
        total_tickets: 400,
        roi_1_5y_pct: 53.2,
      },
    ],
    '/api/v1/executive/cost-breakdown': [
      metric('cost_breakdown_capex_eur', 20700.5, 'eur'),
      metric('cost_breakdown_ams_1l_cost_eur', 105000, 'eur'),
      metric('cost_breakdown_ams_2l_cost_eur', 1000, 'eur'),
      metric('cost_breakdown_license_cost_eur', 13000, 'eur'),
    ],
  })
}

describe('ExecutivePage', () => {
  it('renders KPI cards with formatted values from the API', async () => {
    mockRoutes()
    renderWithQueryClient(<ExecutivePage />)

    const kpiSection = await screen.findByRole('region', {
      name: 'Executive KPIs',
    })
    expect(within(kpiSection).getByText('Annual saving')).toBeInTheDocument()
    expect(within(kpiSection).getByText('€17,716')).toBeInTheDocument()
    expect(within(kpiSection).getByText('709')).toBeInTheDocument()
  })

  it('renders the company summary table', async () => {
    mockRoutes()
    renderWithQueryClient(<ExecutivePage />)

    const table = await screen.findByRole('table')
    expect(within(table).getByText('Menarini')).toBeInTheDocument()
    expect(within(table).getByText('€12,768')).toBeInTheDocument()
  })

  it('shows an unavailable metric as text, not a fabricated zero', async () => {
    mockFetchRoutes({
      '/api/v1/metadata/filters': { companies: ['Menarini', 'Codifi'] },
      '/api/v1/executive/kpis': {
        kpi_annual_saving_eur: metric('kpi_annual_saving_eur', 17715.6, 'eur'),
        kpi_roi_1_5y_ok_pct: metric('kpi_roi_1_5y_ok_pct', 28.4, 'pct'),
        kpi_roi_3y_full_cost_pct: metric(
          'kpi_roi_3y_full_cost_pct',
          null,
          'pct',
          false,
        ),
        kpi_net_benefit_3y_eur: metric(
          'kpi_net_benefit_3y_eur',
          null,
          'eur',
          false,
        ),
        kpi_run_cost_3y_eur: metric('kpi_run_cost_3y_eur', null, 'eur', false),
        kpi_total_tickets: metric('kpi_total_tickets', 6, 'count'),
      },
      '/api/v1/executive/trends': { saving_by_month: [], tickets_by_month: [] },
      '/api/v1/executive/company-summary': [],
      '/api/v1/executive/cost-breakdown': [],
    })
    renderWithQueryClient(<ExecutivePage />)

    expect(await screen.findAllByText('Not available')).not.toHaveLength(0)
    expect(screen.queryByText('€0')).not.toBeInTheDocument()
  })
})
