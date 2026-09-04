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
import { TicketColorPicker } from './TicketColorPicker'
import { contrastText } from './ticketColors'
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
  'sticky left-0 z-10 w-[84px] border-r border-slate-200 bg-inherit'

// Compact square icon buttons keep the action column to one line tall so a
// ticket's values aren't pushed down by a stack of full-size buttons.
const iconButton =
  'inline-flex h-7 w-7 items-center justify-center rounded-md border transition disabled:cursor-not-allowed disabled:opacity-40'
const neutralIconButton = `${iconButton} border-slate-300 text-slate-600 hover:bg-slate-100`
const dangerIconButton = `${iconButton} border-negative/40 text-negative hover:bg-negative/10`
const primaryIconButton = `${iconButton} border-brand bg-brand text-white hover:bg-brandHover`

function ActionIcon({ d }: { d: string }) {
  return (
    <svg
      viewBox="0 0 16 16"
      className="h-4 w-4"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.6}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d={d} />
    </svg>
  )
}

const ICON_PENCIL = 'M10.5 2.5l3 3-8 8H2.5v-3zM9 4l3 3'
const ICON_TRASH = 'M2.5 4.5h11M6 4.5V2.5h4v2M4 4.5l.8 9h6.4l.8-9M6.5 7v4M9.5 7v4'
const ICON_CHECK = 'M3 8.5l3.5 3.5L13 4.5'
const ICON_CROSS = 'M4 4l8 8M12 4l-8 8'

// action column + 12 data columns; the Note row spans the full width below.
export const TICKET_COLUMN_COUNT = 13

export function TicketEditableRow({
  row,
  options,
  isEditing,
  index = 0,
  onRequestEdit,
  onDone,
  onDirtyChange,
}: {
  row: TicketRow
  options: TicketOptions
  isEditing: boolean
  index?: number
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
    const idStyle = row.ticket_color
      ? {
          backgroundColor: row.ticket_color,
          color: contrastText(row.ticket_color),
        }
      : undefined

    // One zebra tint per ticket, shared by the data row and its note row so
    // the pair reads as a single record.
    const tint = index % 2 === 0 ? 'bg-white' : 'bg-slate-50'
    const hasNote = Boolean(row.note)
    // Data cells: tighten the bottom padding when a note row follows so the
    // two lines sit close together.
    const viewCell = `whitespace-nowrap px-3 pt-2.5 align-top text-slate-700 ${
      hasNote ? 'pb-1' : 'pb-2.5'
    }`

    return (
      <>
        <tr
          className={`${tint} ${
            hasNote ? '' : 'border-b border-slate-200 last:border-0'
          }`}
        >
          <td className={`${viewCell} ${stickyCol}`}>
            <div className="flex items-center gap-1">
              <button
                type="button"
                className={neutralIconButton}
                onClick={onRequestEdit}
                title="Edit ticket"
                aria-label={`Edit ticket ${row.ticket_id}`}
              >
                <ActionIcon d={ICON_PENCIL} />
              </button>
              <button
                type="button"
                className={dangerIconButton}
                disabled={remove.isPending}
                title="Delete ticket"
                aria-label={`Delete ticket ${row.ticket_id}`}
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
                <ActionIcon d={ICON_TRASH} />
              </button>
            </div>
            {remove.error && (
              <span
                className="mt-1 block whitespace-normal text-xs text-negative"
                role="alert"
              >
                {remove.error.message}
              </span>
            )}
          </td>
          <td className={`${viewCell} font-medium text-ink`}>
            <span
              className={
                row.ticket_color ? 'inline-block rounded px-1.5 py-0.5' : ''
              }
              style={idStyle}
            >
              {row.ticket_id}
            </span>
          </td>
          <td
            className={`${viewCell} max-w-[220px] truncate`}
            title={row.process_name ?? ''}
          >
            {row.process_name ?? '—'}
          </td>
          <td className={viewCell}>{row.requestor ?? '—'}</td>
          <td className={viewCell}>{row.start_date ?? '—'}</td>
          <td className={viewCell}>{row.end_date ?? '—'}</td>
          <td className={viewCell}>
            <StatusBadge tone={row.is_open ? 'warning' : 'positive'}>
              {row.is_open ? 'Open' : 'Closed'}
            </StatusBadge>
          </td>
          <td className={viewCell}>{row.root_cause_name ?? '—'}</td>
          <td className={viewCell}>{row.is_1l ? '1L' : '2L'}</td>
          <td className={viewCell}>{row.company_name ?? '—'}</td>
          <td className={viewCell}>{row.ams_year_code ?? '—'}</td>
          <td className={viewCell}>{row.priority_value ?? '—'}</td>
          <td className={viewCell}>{row.ticket_type}</td>
        </tr>
        {hasNote && (
          <tr className={`${tint} border-b border-slate-200 last:border-0`}>
            <td className={stickyCol} />
            <td
              className="px-3 pb-2.5 pt-0 align-top"
              colSpan={TICKET_COLUMN_COUNT - 1}
            >
              <div className="w-0 min-w-full whitespace-normal break-words leading-snug">
                <span className="mr-2 align-[1px] text-[11px] font-semibold uppercase tracking-wide text-slate-400">
                  Note
                </span>
                <span className="text-slate-600">{row.note}</span>
              </div>
            </td>
          </tr>
        )}
      </>
    )
  }

  return (
    <>
      <tr
        className="border-b border-slate-100 bg-slate-50"
        onKeyDown={onKeyDown}
      >
        <td className={`${bodyCell} ${stickyCol}`}>
          <div className="flex items-center gap-1">
            <button
              type="button"
              className={`${primaryIconButton} ${save.isPending ? 'animate-pulse' : ''}`}
              onClick={submit}
              disabled={!canSave}
              title="Save changes"
              aria-label="Save changes"
            >
              <ActionIcon d={ICON_CHECK} />
            </button>
            <button
              type="button"
              className={neutralIconButton}
              onClick={cancel}
              disabled={save.isPending}
              title="Cancel editing"
              aria-label="Cancel editing"
            >
              <ActionIcon d={ICON_CROSS} />
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
      </tr>
      <tr
        className="border-b border-slate-100 bg-slate-50"
        onKeyDown={onKeyDown}
      >
        <td className={`${stickyCol} bg-slate-50`} />
        <td className={bodyCell} colSpan={TICKET_COLUMN_COUNT - 1}>
          <div className="flex max-w-3xl flex-col gap-3">
            <label className="block text-xs font-semibold uppercase tracking-wide text-slate-500">
              Note
              <textarea
                className={`${inputClass} mt-1 block resize-y font-normal normal-case`}
                rows={4}
                value={form.note}
                onChange={(event) => patch({ note: event.target.value })}
              />
            </label>
            <TicketColorPicker
              value={form.ticket_color || null}
              onChange={(next) => patch({ ticket_color: next ?? '' })}
            />
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
