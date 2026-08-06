import { cleanup, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'

import {
  metric,
  mockFetchRoutes,
  renderWithQueryClient,
} from '../test/mockFetch'
import { ServicePerformancePage } from './ServicePerformancePage'

afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
})

function mockRoutes() {
  return mockFetchRoutes({
    '/api/v1/service-performance/kpis': {
      sla_compliance_pct: metric('sla_compliance_pct', 52.01, 'pct'),
      sla_breach_pct: metric('sla_breach_pct', 47.99, 'pct'),
      sla_breach_tickets: metric('sla_breach_tickets', 322, 'count'),
      sla_p90_resolution_days: metric('sla_p90_resolution_days', 26, 'days'),
      backlog_over_15_days: metric('backlog_over_15_days', 38, 'count'),
      dq_root_cause_not_classified_pct: metric(
        'dq_root_cause_not_classified_pct',
        66.71,
        'pct',
      ),
      dq_tickets_without_process_mapping_pct: metric(
        'dq_tickets_without_process_mapping_pct',
        0,
        'pct',
      ),
      dq_tickets_without_company_pct: metric(
        'dq_tickets_without_company_pct',
        0,
        'pct',
      ),
    },
    '/api/v1/service-performance/sla-trend': [{ period: '2024-01', value: 5 }],
    '/api/v1/service-performance/resolution': {
      by_root_cause: [{ label: 'Evasione SR', avg_days: 1.2 }],
      by_process: [{ label: 'RPA - Test Alpha', avg_days: 0.5 }],
      by_company: [{ label: 'Menarini', avg_days: 0.7 }],
    },
    '/api/v1/service-performance/data-quality': [
      metric('dq_root_cause_not_classified_pct', 66.71, 'pct'),
      metric('dq_tickets_without_process_mapping_pct', 0, 'pct'),
      metric('dq_tickets_without_company_pct', 0, 'pct'),
    ],
  })
}

describe('ServicePerformancePage', () => {
  it('renders SLA and data quality KPI cards', async () => {
    mockRoutes()
    renderWithQueryClient(<ServicePerformancePage />)

    expect(await screen.findByText('SLA compliance')).toBeInTheDocument()
    expect(await screen.findByText('52.0%')).toBeInTheDocument()
  })

  it('renders resolution analyses and the data quality summary', async () => {
    mockRoutes()
    renderWithQueryClient(<ServicePerformancePage />)

    expect(
      await screen.findByText('Avg resolution by root cause'),
    ).toBeInTheDocument()
    expect(await screen.findByText('Data quality summary')).toBeInTheDocument()
  })
})
