import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'

import { ProcessRoiTable } from './ProcessRoiTable'
import type { ProcessRoiRow } from '../api/executive'

const ROWS: ProcessRoiRow[] = [
  {
    process: 'RPA - Bad Process',
    company: 'Menarini',
    go_live_date: '2022-01-01',
    capex_eur: 10000,
    fte_hours_month_actual: 2.5,
    annual_saving_eur: 500,
    payback_months: 240,
    cumulative_saving_since_go_live_eur: 2000,
    expected_roi_pct: -50,
    actual_roi_pct: -80,
  },
  {
    process: 'RPA - Good Process',
    company: 'Codifi',
    go_live_date: '2020-01-01',
    capex_eur: 5000,
    fte_hours_month_actual: 40,
    annual_saving_eur: 8000,
    payback_months: 7.5,
    cumulative_saving_since_go_live_eur: 48000,
    expected_roi_pct: 300,
    actual_roi_pct: 860,
  },
]

describe('ProcessRoiTable', () => {
  it('does not render a company column', () => {
    render(<ProcessRoiTable rows={ROWS} />)

    expect(screen.queryByRole('columnheader', { name: 'Company' })).not.toBeInTheDocument()
  })

  it('sorts by actual ROI descending by default, best process first', () => {
    render(<ProcessRoiTable rows={ROWS} />)

    const dataRows = screen.getAllByRole('row').slice(1) // drop header row
    expect(within(dataRows[0]).getByText('RPA - Good Process')).toBeInTheDocument()
    expect(within(dataRows[1]).getByText('RPA - Bad Process')).toBeInTheDocument()
  })

  it('colors a negative actual ROI distinctly from a positive one, with a text cue', async () => {
    render(<ProcessRoiTable rows={ROWS} />)

    expect(screen.getByText('▲ +860.0%')).toBeInTheDocument()
    expect(screen.getByText('▼ -80.0%')).toBeInTheDocument()
  })

  it('filters to only negative-ROI processes when the status filter is applied', async () => {
    const user = userEvent.setup()
    render(<ProcessRoiTable rows={ROWS} />)

    await user.selectOptions(screen.getByLabelText('ROI status'), 'negative')

    expect(screen.queryByText('RPA - Good Process')).not.toBeInTheDocument()
    expect(screen.getByText('RPA - Bad Process')).toBeInTheDocument()
  })
})
