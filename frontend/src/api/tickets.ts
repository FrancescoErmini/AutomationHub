import { apiFetch, getJson, parseResponse } from './client'

export interface TicketRow {
  id: number
  ticket_id: string
  ticket_type: string
  priority_id: number | null
  priority_value: string | null
  process_id: number | null
  process_name: string | null
  requestor: string | null
  start_date: string | null
  end_date: string | null
  root_cause_id: number | null
  root_cause_name: string | null
  is_1l: boolean
  support_level_id: number | null
  support_level_code: string | null
  company_id: number | null
  company_name: string | null
  ams_year_id: number | null
  ams_year_code: string | null
  note: string | null
  created_at: string
  is_open: boolean
}

export interface TicketRefOption {
  id: number
  label: string
}

export interface TicketOptions {
  priorities: TicketRefOption[]
  processes: TicketRefOption[]
  root_causes: TicketRefOption[]
  support_levels: TicketRefOption[]
  companies: TicketRefOption[]
  ams_years: TicketRefOption[]
  ticket_types: string[]
}

export interface TicketUpdate {
  ticket_id: string
  ticket_type: string
  priority_id: number | null
  process_id: number | null
  requestor: string | null
  start_date: string | null
  end_date: string | null
  root_cause_id: number | null
  is_1l: boolean
  support_level_id: number | null
  company_id: number | null
  ams_year_id: number | null
  note: string | null
}

export async function fetchTickets(params: {
  scope: 'default' | 'all'
  q: string
}): Promise<TicketRow[]> {
  return getJson<TicketRow[]>('/api/v1/tickets', {
    scope: params.scope,
    q: params.q || undefined,
  })
}

export async function fetchTicketOptions(): Promise<TicketOptions> {
  return getJson<TicketOptions>('/api/v1/tickets/options')
}

export async function updateTicket(
  id: number,
  payload: TicketUpdate,
): Promise<TicketRow> {
  return parseResponse<TicketRow>(
    await apiFetch(`/api/v1/tickets/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    }),
  )
}
