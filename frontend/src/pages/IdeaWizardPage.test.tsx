import {
  cleanup,
  fireEvent,
  screen,
  waitFor,
  within,
} from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { renderWithQueryClient } from '../test/mockFetch'
import { IdeaWizardPage } from './IdeaWizardPage'

afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
})

const CATEGORY = {
  id: 1,
  pcf_id: 10002,
  hierarchy_id: '1.0',
  name: 'Develop Vision and Strategy',
}
const PROCESS_GROUP = {
  id: 1,
  pcf_id: 17040,
  hierarchy_id: '1.1',
  name: 'Define the business concept',
  category_id: 1,
}
const PROCESS = {
  id: 1,
  pcf_id: 10017,
  hierarchy_id: '1.1.1',
  name: 'Assess the external environment',
  process_group_id: 1,
}

interface CapturedCall {
  path: string
  method: string
  body: Record<string, unknown> | undefined
}

function mockRoutes(): CapturedCall[] {
  const calls: CapturedCall[] = []
  vi.spyOn(globalThis, 'fetch').mockImplementation(async (input, init) => {
    const url = typeof input === 'string' ? input : input.toString()
    const path = url.split('?')[0]
    const method = init?.method ?? 'GET'
    const body = init?.body ? JSON.parse(init.body as string) : undefined
    calls.push({ path, method, body })

    if (path === '/api/v1/apqc/categories') {
      return new Response(JSON.stringify([CATEGORY]), { status: 200 })
    }
    if (path === '/api/v1/apqc/process-groups') {
      return new Response(JSON.stringify([PROCESS_GROUP]), { status: 200 })
    }
    if (path === '/api/v1/apqc/processes') {
      return new Response(JSON.stringify([PROCESS]), { status: 200 })
    }
    if (path === '/api/v1/ideas' && method === 'POST') {
      return new Response(JSON.stringify({ id: 1 }), { status: 201 })
    }
    return new Response(
      JSON.stringify({ error: { message: `No mock for ${path}` } }),
      {
        status: 404,
      },
    )
  })
  return calls
}

function renderWizard() {
  return renderWithQueryClient(
    <MemoryRouter initialEntries={['/ideas/new']}>
      <Routes>
        <Route path="/ideas/new" element={<IdeaWizardPage />} />
        <Route path="/ideas" element={<div>Idea Pipeline Page</div>} />
      </Routes>
    </MemoryRouter>,
  )
}

function nextButton() {
  return screen.getByRole('button', { name: 'Next' })
}

async function selectCascade(
  label: string,
  optionName: string,
  optionId: number,
) {
  const select = await screen.findByLabelText(label)
  await within(select).findByText(optionName)
  fireEvent.change(select, { target: { value: String(optionId) } })
}

describe('IdeaWizardPage', () => {
  it('keeps Next disabled until Step 1 required fields are filled', () => {
    mockRoutes()
    renderWizard()

    expect(nextButton()).toBeDisabled()

    fireEvent.change(screen.getByLabelText('Idea title'), {
      target: { value: 'Automate invoice matching' },
    })
    expect(nextButton()).not.toBeDisabled()
  })

  it('preserves Step 1 answers when navigating back from Step 2', async () => {
    mockRoutes()
    renderWizard()

    fireEvent.change(screen.getByLabelText('Idea title'), {
      target: { value: 'My idea' },
    })
    fireEvent.click(nextButton())

    await screen.findByRole('heading', { name: 'Process Mapping' })
    fireEvent.click(screen.getByRole('button', { name: 'Back' }))

    await screen.findByRole('heading', { name: 'Basic Info' })
    expect(screen.getByLabelText('Idea title')).toHaveValue('My idea')
  })

  it('walks through all 8 steps and submits the expected payload', async () => {
    const calls = mockRoutes()
    renderWizard()

    // Step 1
    fireEvent.change(screen.getByLabelText('Idea title'), {
      target: { value: 'Automate invoice matching' },
    })
    fireEvent.click(nextButton())

    // Step 2
    await screen.findByRole('heading', { name: 'Process Mapping' })
    await selectCascade('L1 — Category', CATEGORY.name, CATEGORY.id)
    await selectCascade(
      'L2 — Process Group',
      PROCESS_GROUP.name,
      PROCESS_GROUP.id,
    )
    await selectCascade('L3 — Process', PROCESS.name, PROCESS.id)
    await waitFor(() => expect(nextButton()).not.toBeDisabled())
    fireEvent.click(nextButton())

    // Step 3
    await screen.findByRole('heading', {
      name: 'Process Overview & Business Goals',
    })
    fireEvent.change(screen.getByLabelText('Primary goal'), {
      target: { value: 'Cost Reduction' },
    })
    fireEvent.change(
      screen.getByLabelText('Process stability (next 6 months)'),
      {
        target: { value: 'No Change' },
      },
    )
    fireEvent.change(
      screen.getByLabelText('System stability (next 6 months)'),
      {
        target: { value: 'No Change' },
      },
    )
    fireEvent.click(nextButton())

    // Step 4
    await screen.findByRole('heading', { name: 'Volumetry & Human Effort' })
    fireEvent.change(screen.getByLabelText('Task frequency'), {
      target: { value: 'Daily' },
    })
    fireEvent.change(screen.getByLabelText('Transaction volume per cycle'), {
      target: { value: '100' },
    })
    fireEvent.change(screen.getByLabelText('Headcount in FTEs'), {
      target: { value: '2' },
    })
    fireEvent.change(screen.getByLabelText('Avg. time per task (minutes)'), {
      target: { value: '10' },
    })
    fireEvent.change(screen.getByLabelText('Error rate (%)'), {
      target: { value: '5' },
    })
    fireEvent.change(screen.getByLabelText('Avg. rework time (minutes)'), {
      target: { value: '15' },
    })
    fireEvent.change(screen.getByLabelText('Audit rate (%)'), {
      target: { value: '2' },
    })
    fireEvent.change(
      screen.getByLabelText('Avg. loaded FTE cost per year (EUR)'),
      {
        target: { value: '40000' },
      },
    )
    fireEvent.click(nextButton())

    // Step 5
    await screen.findByRole('heading', { name: 'Complexity & Standardisation' })
    fireEvent.change(screen.getByLabelText('Number of steps'), {
      target: { value: '6-15' },
    })
    fireEvent.change(screen.getByLabelText('Decision logic'), {
      target: { value: '100% Rule-Based' },
    })
    fireEvent.change(screen.getByLabelText('Process variations'), {
      target: { value: '1 Standard Path' },
    })
    fireEvent.click(nextButton())

    // Step 6
    await screen.findByRole('heading', { name: 'Systems & Environment' })
    fireEvent.change(screen.getByLabelText('Primary input format'), {
      target: { value: 'Structured Digital (Excel/DB/API)' },
    })
    fireEvent.change(screen.getByLabelText('Number of systems'), {
      target: { value: '1' },
    })
    fireEvent.change(screen.getByLabelText('System interface'), {
      target: { value: 'API Available' },
    })
    fireEvent.click(nextButton())

    // Step 7
    await screen.findByRole('heading', { name: 'AI Assessment' })
    fireEvent.change(screen.getByLabelText('Unstructured data'), {
      target: { value: 'No (Tabular/Structured)' },
    })
    fireEvent.change(screen.getByLabelText('Cognitive reasoning required'), {
      target: { value: 'No (Strict If/Then)' },
    })
    fireEvent.change(screen.getByLabelText('Computer vision / OCR'), {
      target: { value: 'No' },
    })
    fireEvent.change(screen.getByLabelText('AI output risk tolerance'), {
      target: { value: 'Strict 0% Tolerance' },
    })
    fireEvent.click(nextButton())

    // Step 8
    await screen.findByRole('heading', { name: 'Review & Submit' })
    fireEvent.click(screen.getByRole('button', { name: 'Submit idea' }))

    await screen.findByText('Idea Pipeline Page')

    const submitCall = calls.find(
      (call) => call.path === '/api/v1/ideas' && call.method === 'POST',
    )
    expect(submitCall?.body).toMatchObject({
      title: 'Automate invoice matching',
      apqc_process_id: PROCESS.id,
      primary_goal: 'Cost Reduction',
      task_frequency: 'Daily',
      transaction_volume: 100,
      avg_loaded_fte_cost_eur: 40000,
      unstructured_data: 'No (Tabular/Structured)',
    })
  })
})
