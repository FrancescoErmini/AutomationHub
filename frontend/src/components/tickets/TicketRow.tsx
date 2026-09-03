import { useEffect, useMemo, useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'

import {
  deleteTicket,
  updateTicket,
  type TicketOptions,
  type TicketRow,
  type TicketUpdate,
} from '../../api/tickets'
import { StatusBadge } from '../ui'
import { RefSelect } from './RefSelect'
import {
  PROCESS_DATALIST_ID,
  deriveSupportLevelId,
  formToPayload,
  inputClass,
  resolveProcessId,
  rowToForm,
  type TicketFormState,
} from './ticketForm'

const bodyCell = 'whitespace-nowrap px-3 py-2 align-top text-slate-700'
// Pinned first column so the row action stays visible while the wide table
// scrolls horizontally. bg-inherit picks up the <tr> background.
const stickyCol =
  'sticky left-0 z-10 w-[112px] border-r border-slate-200 bg-inherit'
const ghostButton =
  'rounded-lg border border-slate-300 px-3 py-1 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50'
const primaryButton =
  'rounded-lg bg-brand px-3 py-1 text-sm font-semibold text-white transition hover:bg-brandHover disabled:cursor-not-allowed disabled:opacity-50'
const dangerButton =
  'rounded-lg border border-negative/40 px-3 py-1 text-sm font-semibold text-negative hover:bg-negative/5 disabled:cursor-not-allowed disabled:opacity-50'

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
  const [form, setForm] = useState<TicketFormState>(() => rowToForm(row))

  useEffect(() => {
    if (isEditing) setForm(rowToForm(row))
  }, [isEditing, row])

  const pristine = useMemo(() => JSON.stringify(rowToForm(row)), [row])
  const dirty = JSON.stringify(form) !== pristine

  useEffect(() => {
    if (isEditing) onDirtyChange(dirty)
  }, [isEditing, dirty, onDirtyChange])

  const resolvedProcessId = resolveProcessId(options, form.process_label)
  const processUnmatched = resolvedProcessId === undefined

  const save = useMutation({
    mutationFn: (payload: TicketUpdate) => updateTicket(row.id, payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tickets'] })
      onDirtyChange(false)
      onDone()
    },
  })

  const remove = useMutation({
    mutationFn: () => deleteTicket(row.id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['tickets'] }),
  })

  const patch = (part: Partial<TicketFormState>) =>
    setForm((current) => ({ ...current, ...part }))

  const canSave =
    form.ticket_id.trim() !== '' &&
    form.ticket_type.trim() !== '' &&
    !processUnmatched &&
    !save.isPending

  const submit = () => {
    if (!canSave) return
    save.mutate(
      formToPayload(
        form,
        resolvedProcessId ?? null,
        deriveSupportLevelId(
          options,
          form.is_1l === 'true',
          row.support_level_id,
        ),
      ),
    )
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
      <tr className="border-b border-slate-100 bg-white last:border-0">
        <td className={`${bodyCell} ${stickyCol}`}>
          <div className="flex flex-col gap-1.5">
            <button
              type="button"
              className={ghostButton}
              onClick={onRequestEdit}
            >
              Edit
            </button>
            <button
              type="button"
              className={dangerButton}
              disabled={remove.isPending}
              onClick={() => {
                if (
                  window.confirm(
                    `Delete ticket ${row.ticket_id}? This cannot be undone.`,
                  )
                ) {
                  remove.mutate()
                }
              }}
            >
              {remove.isPending ? 'Deleting…' : 'Delete'}
            </button>
            {remove.error && (
              <span className="text-xs text-negative" role="alert">
                {remove.error.message}
              </span>
            )}
          </div>
        </td>
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
        <td className={bodyCell}>{row.company_name ?? '—'}</td>
        <td className={bodyCell}>{row.ams_year_code ?? '—'}</td>
        <td
          className={`${bodyCell} max-w-[260px] truncate`}
          title={row.note ?? ''}
        >
          {row.note ?? '—'}
        </td>
      </tr>
    )
  }

  return (
    <>
      <tr
        className="border-b border-slate-100 bg-slate-50"
        onKeyDown={onKeyDown}
      >
        <td className={`${bodyCell} ${stickyCol}`}>
          <div className="flex flex-col gap-1.5">
            <button
              type="button"
              className={primaryButton}
              onClick={submit}
              disabled={!canSave}
            >
              {save.isPending ? 'Saving…' : 'Save'}
            </button>
            <button
              type="button"
              className={ghostButton}
              onClick={cancel}
              disabled={save.isPending}
            >
              Cancel
            </button>
          </div>
        </td>
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
        <td className={bodyCell} colSpan={1}>
          <span className="text-xs text-slate-500">Note ↓</span>
        </td>
      </tr>
      <tr
        className="border-b border-slate-100 bg-slate-50"
        onKeyDown={onKeyDown}
      >
        <td className={bodyCell} colSpan={14}>
          <div className="sticky left-0 flex max-w-3xl flex-col gap-2">
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
          </div>
        </td>
      </tr>
    </>
  )
}
