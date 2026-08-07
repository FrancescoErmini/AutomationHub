import { cleanup, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'

import {
  metric,
  mockFetchRoutes,
  renderWithQueryClient,
} from '../test/mockFetch'
import { SimpleOpsPage } from './SimpleOpsPage'

afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
})

function mockRoutes() {
  return mockFetchRoutes({
    '/api/v1/simple-ops/kpis': {
      kpi_total_running_cost_eur: metric(
        'kpi_total_running_cost_eur',
        157350.4,
        'eur',
      ),
      kpi_process_count: metric('kpi_process_count', 68, 'count'),
      kpi_license_cost_eur: metric('kpi_license_cost_eur', 67050.4, 'eur'),
      kpi_licensed_vm_count: metric('kpi_licensed_vm_count', 7, 'count'),
      kpi_ams_1l_cost_eur: metric('kpi_ams_1l_cost_eur', 72000, 'eur'),
      kpi_ticket_2l_cost_eur: metric('kpi_ticket_2l_cost_eur', 4000, 'eur'),
      kpi_ticket_2l_count: metric('kpi_ticket_2l_count', 8, 'count'),
      kpi_change_request_cost_eur: metric(
        'kpi_change_request_cost_eur',
        14300,
        'eur',
      ),
      kpi_change_request_count: metric('kpi_change_request_count', 2, 'count'),
      kpi_avg_cost_per_process_eur: metric(
        'kpi_avg_cost_per_process_eur',
        2314,
        'eur',
      ),
      kpi_total_running_cost_delta_pct: metric(
        'kpi_total_running_cost_delta_pct',
        -14.6,
        'pct',
      ),
      kpi_license_cost_delta_pct: metric(
        'kpi_license_cost_delta_pct',
        0,
        'pct',
      ),
      kpi_ams_1l_cost_delta_pct: metric('kpi_ams_1l_cost_delta_pct', 20, 'pct'),
      kpi_ticket_2l_cost_delta_pct: metric(
        'kpi_ticket_2l_cost_delta_pct',
        -50,
        'pct',
      ),
      kpi_change_request_cost_delta_pct: metric(
        'kpi_change_request_cost_delta_pct',
        null,
        'pct',
        false,
      ),
    },
    '/api/v1/simple-ops/running-cost-trend': [
      { year: 2024, total_eur: 126059.4, estimate: false },
      { year: 2025, total_eur: 184250.4, estimate: false },
      { year: 2026, total_eur: 157350.4, estimate: false },
      { year: 2027, total_eur: 172000, estimate: true },
    ],
    '/api/v1/simple-ops/license-cost-trend': [
      { year: 2024, cost_eur: 53509.4 },
      { year: 2025, cost_eur: 67050.4 },
      { year: 2026, cost_eur: 67050.4 },
    ],
    '/api/v1/simple-ops/infrastructure': {
      trend: [
        { year: 2024, cost_eur: 0 },
        { year: 2025, cost_eur: 0 },
        { year: 2026, cost_eur: 0 },
      ],
      tbd: true,
      vm_count: 7,
      db_count: 68,
    },
    '/api/v1/simple-ops/occupancy-heatmap': [
      {
        vm: 'MCDWINRPAP21',
        cells: [
          { slot: 'night', label: '00-04', count: 0, intensity: 0 },
          { slot: 'early_morning', label: '04-08', count: 0, intensity: 0 },
          { slot: 'morning', label: '08-12', count: 51, intensity: 100 },
          { slot: 'afternoon', label: '12-16', count: 0, intensity: 0 },
          { slot: 'evening', label: '16-20', count: 0, intensity: 0 },
          { slot: 'late_evening', label: '20-24', count: 0, intensity: 0 },
        ],
      },
    ],
    '/api/v1/simple-ops/ams-trend': {
      l1: [{ year: 2026, cost_eur: 72000, process_count: 67 }],
      l2: [{ year: 2026, cost_eur: 5500, ticket_count: 9 }],
    },
    '/api/v1/simple-ops/sla-kpis': [
      {
        key: 'rpa_internal_root_cause_pct',
        label: 'RPA Internal Root Causes',
        value: 8.2,
        unit: 'pct',
        target_label: 'Target < 25%',
        status: 'green',
        available: true,
      },
    ],
    '/api/v1/simple-ops/quality-breakdown': {
      l1: {
        root_causes: [{ label: 'Evasione SR', count: 43, pct: 25.1 }],
        total_tickets: 171,
        service_request_pct: 18.7,
        incident_pct: 81.3,
      },
      l2: {
        root_causes: [{ label: 'unclassified', count: 3, pct: 37.5 }],
        total_tickets: 8,
        service_request_pct: 0,
        incident_pct: 100,
      },
    },
    '/api/v1/simple-ops/cost-breakdown-by-process': [
      {
        process: 'RPA - Sauron',
        license_eur: 9924.2,
        ams_1l_eur: 1058.82,
        l2_eur: 0,
        total_eur: 10983.02,
      },
    ],
  })
}

describe('SimpleOpsPage', () => {
  it('renders the header KPI cards', async () => {
    mockRoutes()
    renderWithQueryClient(<SimpleOpsPage />)

    expect(await screen.findByText('Operation Dashboard')).toBeInTheDocument()
    expect(await screen.findByText('AMS 1L')).toBeInTheDocument()
    expect(await screen.findByText('Change Request')).toBeInTheDocument()
  })

  it('renders the running cost trend and cost breakdown sections', async () => {
    mockRoutes()
    renderWithQueryClient(<SimpleOpsPage />)

    expect(
      await screen.findByText('Andamento costo running totale'),
    ).toBeInTheDocument()
    expect(
      await screen.findByText('Scomposizione costo per processo'),
    ).toBeInTheDocument()
    expect(await screen.findByText('RPA - Sauron')).toBeInTheDocument()
  })
})
