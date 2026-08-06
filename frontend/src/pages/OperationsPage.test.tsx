import { cleanup, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'

import {
  metric,
  mockFetchRoutes,
  renderWithQueryClient,
} from '../test/mockFetch'
import { OperationsPage } from './OperationsPage'

afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
})

function mockRoutes() {
  return mockFetchRoutes({
    '/api/v1/metadata/filters': { companies: ['Menarini', 'Codifi'] },
    '/api/v1/operations/kpis': {
      ops_total_tickets: metric('ops_total_tickets', 709, 'count'),
      ops_open_backlog: metric('ops_open_backlog', 38, 'count'),
      ops_closed_tickets: metric('ops_closed_tickets', 671, 'count'),
      ops_l1_tickets: metric('ops_l1_tickets', 642, 'count'),
      ops_l2_tickets: metric('ops_l2_tickets', 67, 'count'),
      ops_l1_ratio: metric('ops_l1_ratio', 0.9055, 'ratio'),
      ops_l2_ratio: metric('ops_l2_ratio', 0.0945, 'ratio'),
      ops_sla_proxy_le_3d_pct: metric('ops_sla_proxy_le_3d_pct', 52.0, 'pct'),
      ops_avg_resolution_days: metric('ops_avg_resolution_days', 10.6, 'days'),
      ops_median_resolution_days: metric(
        'ops_median_resolution_days',
        3,
        'days',
      ),
      ops_p90_resolution_days: metric('ops_p90_resolution_days', 26, 'days'),
      ops_cost_per_ticket: metric('ops_cost_per_ticket', 558.85, 'eur'),
      ops_l2_cost_per_ticket: metric('ops_l2_cost_per_ticket', 514.49, 'eur'),
    },
    '/api/v1/operations/support-level-trend': [
      { period: '2024-01', l1: 4, l2: 1 },
    ],
    '/api/v1/operations/root-cause-pareto': [
      { root_cause: 'Evasione SR', count: 69 },
    ],
    '/api/v1/operations/top-processes': [
      { process: 'RPA - Test Alpha', ticket_count: 40 },
    ],
    '/api/v1/operations/backlog-aging': {
      backlog_0_3_days: 0,
      backlog_4_7_days: 0,
      backlog_8_15_days: 0,
      backlog_over_15_days: 38,
    },
  })
}

describe('OperationsPage', () => {
  it('renders operations KPI cards', async () => {
    mockRoutes()
    renderWithQueryClient(<OperationsPage />)

    expect(await screen.findByText('Total tickets')).toBeInTheDocument()
    expect(await screen.findByText('709')).toBeInTheDocument()
  })

  it('renders the root cause pareto and top processes charts', async () => {
    mockRoutes()
    renderWithQueryClient(<OperationsPage />)

    expect(await screen.findByText('Root cause pareto')).toBeInTheDocument()
    expect(
      await screen.findByText('Top processes by ticket volume'),
    ).toBeInTheDocument()
  })
})
