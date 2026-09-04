import type { TicketOptions, TicketRow, TicketUpdate } from '../../api/tickets'

export const PROCESS_DATALIST_ID = 'ticket-process-options'

export const inputClass =
  'w-full min-w-[7rem] rounded-lg border border-slate-300 px-2 py-1 text-sm focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/30'

export interface TicketFormState {
  ticket_id: string
  ticket_type: string
  priority_id: string
  process_label: string
  requestor: string
  start_date: string
  end_date: string
  root_cause_id: string
  is_1l: 'true' | 'false'
  company_id: string
  ams_year_id: string
  note: string
  /** hex string, or '' for no colour */
  ticket_color: string
}

export const EMPTY_TICKET_FORM: TicketFormState = {
  ticket_id: '',
  ticket_type: '',
  priority_id: '',
  process_label: '',
  requestor: '',
  start_date: '',
  end_date: '',
  root_cause_id: '',
  is_1l: 'true',
  company_id: '',
  ams_year_id: '',
  note: '',
  ticket_color: '',
}

export function rowToForm(row: TicketRow): TicketFormState {
  return {
    ticket_id: row.ticket_id,
    ticket_type: row.ticket_type,
    priority_id: row.priority_id === null ? '' : String(row.priority_id),
    process_label: row.process_name ?? '',
    requestor: row.requestor ?? '',
    start_date: row.start_date ?? '',
    end_date: row.end_date ?? '',
    root_cause_id: row.root_cause_id === null ? '' : String(row.root_cause_id),
    is_1l: row.is_1l ? 'true' : 'false',
    company_id: row.company_id === null ? '' : String(row.company_id),
    ams_year_id: row.ams_year_id === null ? '' : String(row.ams_year_id),
    note: row.note ?? '',
    ticket_color: row.ticket_color ?? '',
  }
}

const numOrNull = (value: string): number | null =>
  value === '' ? null : Number(value)

/** Resolve a typed process label to its id. `undefined` = a non-empty label
 *  that matches nothing (caller should block save). */
export function resolveProcessId(
  options: TicketOptions,
  label: string,
): number | null | undefined {
  const typed = label.trim()
  if (typed === '') return null
  return options.processes.find((option) => option.label === typed)?.id
}

/** support_level_id is never edited directly -- it mirrors the 1L / 2L toggle so
 *  the full-replace PATCH/POST body always carries the right value. */
export function deriveSupportLevelId(
  options: TicketOptions,
  is1l: boolean,
  fallback: number | null,
): number | null {
  return (
    options.support_levels.find((o) => o.label === (is1l ? '1L' : '2L'))?.id ??
    fallback ??
    null
  )
}

export function formToPayload(
  form: TicketFormState,
  processId: number | null,
  supportLevelId: number | null,
): TicketUpdate {
  return {
    ticket_id: form.ticket_id.trim(),
    ticket_type: form.ticket_type.trim(),
    priority_id: numOrNull(form.priority_id),
    process_id: processId,
    requestor: form.requestor.trim() || null,
    start_date: form.start_date || null,
    end_date: form.end_date || null,
    root_cause_id: numOrNull(form.root_cause_id),
    is_1l: form.is_1l === 'true',
    support_level_id: supportLevelId,
    company_id: numOrNull(form.company_id),
    ams_year_id: numOrNull(form.ams_year_id),
    note: form.note.trim() || null,
    ticket_color: form.ticket_color || null,
  }
}
