import { cleanup, screen, within } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'

import {
  metric,
  mockFetchRoutes,
  renderWithQueryClient,
} from '../test/mockFetch'
import { RoiPage } from './RoiPage'

afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
})

function mockRoutes() {
  return mockFetchRoutes({
    '/api/v1/roi/kpis': {
      roi_annual_saving_eur: metric('roi_annual_saving_eur', 418854.24, 'eur'),
      roi_tco_3y_eur: metric('roi_tco_3y_eur', 1294422.8, 'eur'),
      roi_1_5y_pct: metric('roi_1_5y_pct', -30.05, 'pct'),
      roi_3y_full_cost_pct: metric('roi_3y_full_cost_pct', -2.93, 'pct'),
      roi_5y_pct: metric('roi_5y_pct', 133.16, 'pct'),
      roi_net_benefit_3y_eur: metric(
        'roi_net_benefit_3y_eur',
        -37860.08,
        'eur',
      ),
      roi_payback_months: metric('roi_payback_months', 25.7, 'months'),
      roi_status: metric('roi_status', 'at_risk', 'label'),
    },
    '/api/v1/roi/processes': [
      {
        process: 'RPA - Test Alpha',
        company: 'Menarini',
        capex_eur: 12500,
        annual_saving_eur: 12768,
        payback_months: 11.75,
        roi_1_5y_pct: 53.2,
        process_tco_available: false,
      },
    ],
    '/api/v1/roi/companies': [
      {
        company: 'Menarini',
        annual_saving_eur: 12768,
        capex_eur: 12500,
        roi_1_5y_pct: 53.2,
        payback_months: 11.75,
      },
    ],
    '/api/v1/roi/quick-wins': [
      {
        process: 'RPA - Test Alpha',
        company: 'Menarini',
        capex_eur: 12500,
        annual_saving_eur: 12768,
        payback_months: 11.75,
        roi_1_5y_pct: 53.2,
        process_tco_available: false,
      },
    ],
    '/api/v1/roi/cost-stack': [
      metric('roi_cost_stack_capex_eur', 20700.5, 'eur'),
      metric('roi_cost_stack_ams_1l_cost_eur', 105000, 'eur'),
      metric('roi_cost_stack_ams_2l_cost_eur', 1000, 'eur'),
      metric('roi_cost_stack_license_cost_eur', 13000, 'eur'),
    ],
  })
}

describe('RoiPage', () => {
  it('renders ROI KPI cards including the ROI status label', async () => {
    mockRoutes()
    renderWithQueryClient(<RoiPage />)

    const kpiSection = await screen.findByRole('region', { name: 'ROI KPIs' })
    expect(within(kpiSection).getByText('Annual saving')).toBeInTheDocument()
    expect(within(kpiSection).getByText('ROI status')).toBeInTheDocument()
    expect(within(kpiSection).getByText('at_risk')).toBeInTheDocument()
  })

  it('renders the process ROI summary and quick wins tables', async () => {
    mockRoutes()
    renderWithQueryClient(<RoiPage />)

    expect(
      await screen.findByText('Quick wins (fastest payback)'),
    ).toBeInTheDocument()
    expect(await screen.findByText('Process ROI summary')).toBeInTheDocument()
    expect(
      (await screen.findAllByText('RPA - Test Alpha')).length,
    ).toBeGreaterThan(0)
  })
})
