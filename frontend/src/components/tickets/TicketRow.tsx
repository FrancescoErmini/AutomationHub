import { useEffect, useMemo, useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'

import {
  updateTicket,
  type TicketOptions,
  type TicketRow,
  type TicketUpdate,
} from '../../api/tickets'
import { StatusBadge } from '../ui'

const PROCESS_DATALIST_ID = 'ticket-process-options'
const bodyCell = 'whitespace-nowrap px-3 py-2 align-top text-slate-700'
const inputClass =
  'w-full min-w-[7rem] rounded-lg border border-slate-300 px-2 py-1 text-sm focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/30'
const ghostButton =
  'rounded-lg border border-slate-300 px-3 py-1 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50'
const primaryButton =
  'rounded-lg bg-brand px-3 py-1 text-sm font-semibold text-white transition hover:bg-brandHover disabled:cursor-not-allowed disabled:opacity-50'

interface RowForm {
  ticket_id: string
  ticket_type: string
  priority_id: string
  process_label: string
  requestor: string
  start_date: string
  end_date: string
  root_cause_id: string
  is_1l: 'true' | 'false'
  support_level_id: string
  company_id: string
  ams_year_id: string
  note: string
}

function rowToForm(row: TicketRow): RowForm {
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
    support_level_id:
      row.support_level_id === null ? '' : String(row.support_level_id),
    company_id: row.company_id === null ? '' : String(row.company_id),
    ams_year_id: row.ams_year_id === null ? '' : String(row.ams_year_id),
    note: row.note ?? '',
  }
}

const numOrNull = (value: string): number | null =>
  value === '' ? null : Number(value)

function formToPayload(form: RowForm, processId: number | null): TicketUpdate {
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
    support_level_id: numOrNull(form.support_level_id),
    company_id: numOrNull(form.company_id),
    ams_year_id: numOrNull(form.ams_year_id),
    note: form.note.trim() || null,
  }
}

function RefSelect({
  value,
  onChange,
  options,
  label,
}: {
  value: string
  onChange: (next: string) => void
  options: { id: number; label: string }[]
  label: string
}) {
  return (
    <select
      className={inputClass}
      value={value}
      onChange={(event) => onChange(event.target.value)}
      aria-label={label}
    >
      <option value="">—</option>
      {options.map((option) => (
        <option key={option.id} value={String(option.id)}>
          {option.label}
        </option>
      ))}
    </select>
  )
}

export function TicketEditableRow({
  row,
  options,
  isEditing,
  onRequestEdit,
  onDone,
  onDirtyChange,
}: {
  row: TicketRow
  options: TicketOptions
  isEditing: boolean
  onRequestEdit: () => void
  onDone: () => void
  onDirtyChange: (dirty: boolean) => void
}) {
  const queryClient = useQueryClient()
  const [form, setForm] = useState<RowForm>(() => rowToForm(row))

  useEffect(() => {
    if (isEditing) setForm(rowToForm(row))
  }, [isEditing, row])

  const pristine = useMemo(() => JSON.stringify(rowToForm(row)), [row])
  const dirty = JSON.stringify(form) !== pristine

  useEffect(() => {
    if (isEditing) onDirtyChange(dirty)
  }, [isEditing, dirty, onDirtyChange])

  const typedProcess = form.process_label.trim()
  const resolvedProcessId =
    typedProcess === ''
      ? null
      : (options.processes.find((option) => option.label === typedProcess)
          ?.id ?? undefined)
  const processUnmatched =
    typedProcess !== '' && resolvedProcessId === undefined

  const save = useMutation({
    mutationFn: (payload: TicketUpdate) => updateTicket(row.id, payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tickets'] })
      onDirtyChange(false)
      onDone()
    },
  })

  const patch = (part: Partial<RowForm>) =>
    setForm((current) => ({ ...current, ...part }))

  const canSave =
    form.ticket_id.trim() !== '' &&
    form.ticket_type.trim() !== '' &&
    !processUnmatched &&
    !save.isPending

  const submit = () => {
    if (!canSave) return
    save.mutate(formToPayload(form, resolvedProcessId ?? null))
  }

  const cancel = () => {
    save.reset()
    onDirtyChange(false)
    onDone()
  }

  const onKeyDown = (event: React.KeyboardEvent) => {
    if (event.key === 'Escape') cancel()
    if (event.key === 'Enter' && event.target instanceof HTMLInputElement)
      submit()
  }

  if (!isEditing) {
    return (
      <tr className="border-b border-slate-100 last:border-0">
        <td className={`${bodyCell} font-medium text-ink`}>{row.ticket_id}</td>
        <td className={bodyCell}>{row.ticket_type}</td>
        <td className={bodyCell}>{row.priority_value ?? '—'}</td>
        <td
          className={`${bodyCell} max-w-[220px] truncate`}
          title={row.process_name ?? ''}
        >
          {row.process_name ?? '—'}
        </td>
        <td className={bodyCell}>{row.requestor ?? '—'}</td>
        <td className={bodyCell}>{row.start_date ?? '—'}</td>
        <td className={bodyCell}>{row.end_date ?? '—'}</td>
        <td className={bodyCell}>
          <StatusBadge tone={row.is_open ? 'warning' : 'positive'}>
            {row.is_open ? 'Open' : 'Closed'}
          </StatusBadge>
        </td>
        <td className={bodyCell}>{row.root_cause_name ?? '—'}</td>
        <td className={bodyCell}>{row.is_1l ? '1L' : '2L'}</td>
        <td className={bodyCell}>{row.support_level_code ?? '—'}</td>
        <td className={bodyCell}>{row.company_name ?? '—'}</td>
        <td className={bodyCell}>{row.ams_year_code ?? '—'}</td>
        <td
          className={`${bodyCell} max-w-[260px] truncate`}
          title={row.note ?? ''}
        >
          {row.note ?? '—'}
        </td>
        <td className={bodyCell}>
          <button type="button" className={ghostButton} onClick={onRequestEdit}>
            Edit
          </button>
        </td>
      </tr>
    )
  }

  return (
    <>
      <tr
        className="border-b border-slate-100 bg-slate-50/60"
        onKeyDown={onKeyDown}
      >
        <td className={bodyCell}>
          <input
            className={inputClass}
            value={form.ticket_id}
            onChange={(event) => patch({ ticket_id: event.target.value })}
            aria-label="Ticket ID"
          />
        </td>
        <td className={bodyCell}>
          <input
            className={inputClass}
            list="ticket-type-options"
            value={form.ticket_type}
            onChange={(event) => patch({ ticket_type: event.target.value })}
            aria-label="Ticket type"
          />
          <datalist id="ticket-type-options">
            {options.ticket_types.map((type) => (
              <option key={type} value={type} />
            ))}
          </datalist>
        </td>
        <td className={bodyCell}>
          <RefSelect
            label="Priority"
            value={form.priority_id}
            onChange={(next) => patch({ priority_id: next })}
            options={options.priorities}
          />
        </td>
        <td className={bodyCell}>
          <input
            className={inputClass}
            list={PROCESS_DATALIST_ID}
            value={form.process_label}
            onChange={(event) => patch({ process_label: event.target.value })}
            aria-label="Process"
          />
          {processUnmatched && (
            <span className="mt-1 block text-xs text-negative">
              Pick a process from the list
            </span>
          )}
        </td>
        <td className={bodyCell}>
          <input
            className={inputClass}
            value={form.requestor}
            onChange={(event) => patch({ requestor: event.target.value })}
            aria-label="Requestor"
          />
        </td>
        <td className={bodyCell}>
          <input
            type="date"
            className={inputClass}
            value={form.start_date}
            onChange={(event) => patch({ start_date: event.target.value })}
            aria-label="Start date"
          />
        </td>
        <td className={bodyCell}>
          <input
            type="date"
            className={inputClass}
            value={form.end_date}
            onChange={(event) => patch({ end_date: event.target.value })}
            aria-label="End date"
          />
        </td>
        <td className={bodyCell}>
          <StatusBadge tone={form.end_date === '' ? 'warning' : 'positive'}>
            {form.end_date === '' ? 'Open' : 'Closed'}
          </StatusBadge>
        </td>
        <td className={bodyCell}>
          <RefSelect
            label="Root cause"
            value={form.root_cause_id}
            onChange={(next) => patch({ root_cause_id: next })}
            options={options.root_causes}
          />
        </td>
        <td className={bodyCell}>
          <select
            className={inputClass}
            value={form.is_1l}
            onChange={(event) =>
              patch({ is_1l: event.target.value as 'true' | 'false' })
            }
            aria-label="Support tier"
          >
            <option value="true">1L</option>
            <option value="false">2L</option>
          </select>
        </td>
        <td className={bodyCell}>
          <RefSelect
            label="Support level"
            value={form.support_level_id}
            onChange={(next) => patch({ support_level_id: next })}
            options={options.support_levels}
          />
        </td>
        <td className={bodyCell}>
          <RefSelect
            label="Company"
            value={form.company_id}
            onChange={(next) => patch({ company_id: next })}
            options={options.companies}
          />
        </td>
        <td className={bodyCell}>
          <RefSelect
            label="AMS year"
            value={form.ams_year_id}
            onChange={(next) => patch({ ams_year_id: next })}
            options={options.ams_years}
          />
        </td>
        <td className={bodyCell} colSpan={2}>
          <span className="text-xs text-slate-500">Note edited below ↓</span>
        </td>
      </tr>
      <tr
        className="border-b border-slate-100 bg-slate-50/60"
        onKeyDown={onKeyDown}
      >
        <td className={bodyCell} colSpan={15}>
          <div className="flex flex-col gap-2">
            <label className="block text-xs font-semibold uppercase tracking-wide text-slate-500">
              Note
              <textarea
                className={`${inputClass} mt-1 block resize-y font-normal normal-case`}
                rows={4}
                value={form.note}
                onChange={(event) => patch({ note: event.target.value })}
              />
            </label>
            {save.error && (
              <p className="text-sm text-negative" role="alert">
                {save.error.message}
              </p>
            )}
            <div className="flex justify-end gap-2">
              <button
                type="button"
                className={ghostButton}
                onClick={cancel}
                disabled={save.isPending}
              >
                Cancel
              </button>
              <button
                type="button"
                className={primaryButton}
                onClick={submit}
                disabled={!canSave}
              >
                {save.isPending ? 'Saving…' : 'Save'}
              </button>
            </div>
          </div>
        </td>
      </tr>
    </>
  )
}
