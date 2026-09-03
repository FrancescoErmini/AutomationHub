import { useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'

import { createTicket, type TicketOptions } from '../../api/tickets'
import { RefSelect } from './RefSelect'
import {
  EMPTY_TICKET_FORM,
  PROCESS_DATALIST_ID,
  deriveSupportLevelId,
  formToPayload,
  inputClass,
  resolveProcessId,
  type TicketFormState,
} from './ticketForm'

const primaryButton =
  'rounded-lg bg-brand px-3 py-1.5 text-sm font-semibold text-white transition hover:bg-brandHover disabled:cursor-not-allowed disabled:opacity-50'
const ghostButton =
  'rounded-lg border border-slate-300 px-3 py-1.5 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50'
const fieldLabel =
  'flex flex-col gap-1 text-xs font-semibold uppercase tracking-wide text-slate-500'

export function NewTicketForm({
  options,
  onClose,
}: {
  options: TicketOptions
  onClose: () => void
}) {
  const queryClient = useQueryClient()
  const [form, setForm] = useState<TicketFormState>(EMPTY_TICKET_FORM)

  const patch = (part: Partial<TicketFormState>) =>
    setForm((current) => ({ ...current, ...part }))

  const resolvedProcessId = resolveProcessId(options, form.process_label)
  const processUnmatched = resolvedProcessId === undefined

  const create = useMutation({
    mutationFn: () =>
      createTicket(
        formToPayload(
          form,
          resolvedProcessId ?? null,
          deriveSupportLevelId(options, form.is_1l === 'true', null),
        ),
      ),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tickets'] })
      onClose()
    },
  })

  const canCreate =
    form.ticket_id.trim() !== '' &&
    form.ticket_type.trim() !== '' &&
    !processUnmatched &&
    !create.isPending

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-card">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <label className={fieldLabel}>
          Ticket ID *
          <input
            className={inputClass}
            value={form.ticket_id}
            onChange={(event) => patch({ ticket_id: event.target.value })}
          />
        </label>
        <label className={fieldLabel}>
          Type *
          <input
            className={inputClass}
            list="new-ticket-type-options"
            value={form.ticket_type}
            onChange={(event) => patch({ ticket_type: event.target.value })}
          />
          <datalist id="new-ticket-type-options">
            {options.ticket_types.map((type) => (
              <option key={type} value={type} />
            ))}
          </datalist>
        </label>
        <label className={fieldLabel}>
          Priority
          <RefSelect
            label="Priority"
            value={form.priority_id}
            onChange={(next) => patch({ priority_id: next })}
            options={options.priorities}
          />
        </label>
        <label className={fieldLabel}>
          Process
          <input
            className={inputClass}
            list={PROCESS_DATALIST_ID}
            value={form.process_label}
            onChange={(event) => patch({ process_label: event.target.value })}
          />
          {processUnmatched && (
            <span className="font-normal normal-case text-negative">
              Pick a process from the list
            </span>
          )}
        </label>
        <label className={fieldLabel}>
          Requestor
          <input
            className={inputClass}
            value={form.requestor}
            onChange={(event) => patch({ requestor: event.target.value })}
          />
        </label>
        <label className={fieldLabel}>
          Start date
          <input
            type="date"
            className={inputClass}
            value={form.start_date}
            onChange={(event) => patch({ start_date: event.target.value })}
          />
        </label>
        <label className={fieldLabel}>
          End date
          <input
            type="date"
            className={inputClass}
            value={form.end_date}
            onChange={(event) => patch({ end_date: event.target.value })}
          />
        </label>
        <label className={fieldLabel}>
          Level
          <select
            className={inputClass}
            value={form.is_1l}
            onChange={(event) =>
              patch({ is_1l: event.target.value as 'true' | 'false' })
            }
          >
            <option value="true">1L</option>
            <option value="false">2L</option>
          </select>
        </label>
        <label className={fieldLabel}>
          Root cause
          <RefSelect
            label="Root cause"
            value={form.root_cause_id}
            onChange={(next) => patch({ root_cause_id: next })}
            options={options.root_causes}
          />
        </label>
        <label className={fieldLabel}>
          Company
          <RefSelect
            label="Company"
            value={form.company_id}
            onChange={(next) => patch({ company_id: next })}
            options={options.companies}
          />
        </label>
        <label className={fieldLabel}>
          AMS year
          <RefSelect
            label="AMS year"
            value={form.ams_year_id}
            onChange={(next) => patch({ ams_year_id: next })}
            options={options.ams_years}
          />
        </label>
      </div>

      <label className={`${fieldLabel} mt-3`}>
        Note
        <textarea
          className={`${inputClass} resize-y font-normal normal-case`}
          rows={3}
          value={form.note}
          onChange={(event) => patch({ note: event.target.value })}
        />
      </label>

      {create.error && (
        <p className="mt-2 text-sm text-negative" role="alert">
          {create.error.message}
        </p>
      )}

      <div className="mt-3 flex justify-end gap-2">
        <button
          type="button"
          className={ghostButton}
          onClick={onClose}
          disabled={create.isPending}
        >
          Cancel
        </button>
        <button
          type="button"
          className={primaryButton}
          onClick={() => create.mutate()}
          disabled={!canCreate}
        >
          {create.isPending ? 'Creating…' : 'Create ticket'}
        </button>
      </div>
    </div>
  )
}
