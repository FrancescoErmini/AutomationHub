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
      kpi_total_saved_to_date_eur: metric('kpi_total_saved_to_date_eur', 12768, 'eur'),
      kpi_total_spend_to_date_eur: metric('kpi_total_spend_to_date_eur', 158700.5, 'eur'),
      kpi_net_position_eur: metric('kpi_net_position_eur', -145932.5, 'eur'),
      kpi_roi_multiple: metric('kpi_roi_multiple', 0.08, 'ratio'),
      kpi_payback_year: metric('kpi_payback_year', 2025, 'year'),
      kpi_fte_freed: metric('kpi_fte_freed', 5.4, 'fte'),
    },
    '/api/v1/executive/tco-roi': [
      {
        year: 2024,
        capex_eur: 0,
        opex_eur: 58500,
        opex_breakdown: { AMS: 45500, LICENSES: 13000 },
        savings_eur: 12768,
        net_benefit_eur: -45732,
      },
    ],
    '/api/v1/executive/processes': [
      {
        process: 'RPA - Test Alpha',
        company: 'Menarini',
        go_live_date: '2021-06-01',
        capex_eur: 12500,
        annual_saving_eur: 12768,
        payback_months: 11.75,
        cumulative_saving_since_go_live_eur: 63840,
        expected_roi_pct: 410.7,
        actual_roi_pct: 410.7,
      },
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

  it('renders the TCO & ROI chart', async () => {
    mockRoutes()
    renderWithQueryClient(<ExecutivePage />)

    expect(
      await screen.findByRole('heading', {
        name: 'RPA Total Cost of Ownership (TCO) & ROI Analysis',
      }),
    ).toBeInTheDocument()
  })

  it('renders the single process ROI table, not the old quick-wins/company-summary tables', async () => {
    mockRoutes()
    renderWithQueryClient(<ExecutivePage />)

    expect(await screen.findByRole('heading', { name: 'Process ROI' })).toBeInTheDocument()
    expect(screen.queryByText('Quick wins (fastest payback)')).not.toBeInTheDocument()
    expect(screen.queryByText('Company ROI summary')).not.toBeInTheDocument()
  })

  it('shows an unavailable metric as text, not a fabricated zero', async () => {
    mockFetchRoutes({
      '/api/v1/metadata/filters': { companies: ['Menarini', 'Codifi'] },
      '/api/v1/executive/kpis': {
        kpi_annual_saving_eur: metric('kpi_annual_saving_eur', 17715.6, 'eur'),
        kpi_total_saved_to_date_eur: metric('kpi_total_saved_to_date_eur', 12768, 'eur'),
        kpi_total_spend_to_date_eur: metric('kpi_total_spend_to_date_eur', null, 'eur', false),
        kpi_net_position_eur: metric('kpi_net_position_eur', null, 'eur', false),
        kpi_roi_multiple: metric('kpi_roi_multiple', null, 'ratio', false),
        kpi_payback_year: metric('kpi_payback_year', null, 'year', false),
        kpi_fte_freed: metric('kpi_fte_freed', 5.4, 'fte'),
      },
      '/api/v1/executive/tco-roi': [],
      '/api/v1/executive/processes': [],
    })
    renderWithQueryClient(<ExecutivePage />)

    expect(await screen.findAllByText('Not available')).not.toHaveLength(0)
    expect(screen.queryByText('€0')).not.toBeInTheDocument()
  })
})
