import { useMemo, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

import {
  createAmsYear,
  deleteAmsYear,
  fetchAmsYears,
  updateAmsYear,
  type AmsYearRow,
  type AmsYearUpdate,
} from '../api/amsYears'
import { AsyncSection } from '../components/AsyncSection'
import { inputClass } from '../components/shared/formControls'
import { Modal, PageHeader } from '../components/ui'

const QUERY_KEY = ['ams-years']

interface FormState {
  code: string
  ordinal: string
  year: string
}

const EMPTY_FORM: FormState = { code: '', ordinal: '', year: '' }

function rowToForm(row: AmsYearRow): FormState {
  return {
    code: row.code,
    ordinal: String(row.ordinal),
    year: row.year === null ? '' : String(row.year),
  }
}

function formToPayload(form: FormState): AmsYearUpdate {
  return {
    code: form.code.trim(),
    ordinal: Number(form.ordinal),
    year: form.year === '' ? null : Number(form.year),
  }
}

function isValid(form: FormState): boolean {
  return (
    form.code.trim() !== '' &&
    form.ordinal !== '' &&
    Number.isFinite(Number(form.ordinal))
  )
}

const ghostButton =
  'rounded-lg border border-slate-300 px-3 py-1 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50'
const primaryButton =
  'rounded-lg bg-brand px-3 py-1 text-sm font-semibold text-white transition hover:bg-brandHover disabled:cursor-not-allowed disabled:opacity-50'
const fieldLabel =
  'flex flex-col gap-1 text-xs font-semibold uppercase tracking-wide text-slate-500'

function FormFields({
  form,
  onChange,
}: {
  form: FormState
  onChange: (patch: Partial<FormState>) => void
}) {
  return (
    <>
      <td className="px-3 py-2">
        <input
          className={inputClass}
          value={form.code}
          onChange={(event) => onChange({ code: event.target.value })}
          aria-label="Code"
        />
      </td>
      <td className="px-3 py-2">
        <input
          type="number"
          className={inputClass}
          value={form.ordinal}
          onChange={(event) => onChange({ ordinal: event.target.value })}
          aria-label="Ordinal"
        />
      </td>
      <td className="px-3 py-2">
        <input
          type="number"
          className={inputClass}
          value={form.year}
          onChange={(event) => onChange({ year: event.target.value })}
          aria-label="Calendar year"
        />
      </td>
    </>
  )
}

function YearRow({ row }: { row: AmsYearRow }) {
  const queryClient = useQueryClient()
  const [editing, setEditing] = useState(false)
  const [form, setForm] = useState<FormState>(() => rowToForm(row))

  const save = useMutation({
    mutationFn: (payload: AmsYearUpdate) => updateAmsYear(row.id, payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: QUERY_KEY })
      setEditing(false)
    },
  })

  const remove = useMutation({
    mutationFn: () => deleteAmsYear(row.id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: QUERY_KEY }),
  })

  function startEdit() {
    setForm(rowToForm(row))
    save.reset()
    setEditing(true)
  }

  if (editing) {
    return (
      <>
        <tr className="border-b border-slate-100 bg-slate-50/60">
          <FormFields
            form={form}
            onChange={(patch) => setForm((current) => ({ ...current, ...patch }))}
          />
          <td className="px-3 py-2">
            <div className="flex justify-end gap-2">
              <button
                type="button"
                className={ghostButton}
                onClick={() => setEditing(false)}
                disabled={save.isPending}
              >
                Cancel
              </button>
              <button
                type="button"
                className={primaryButton}
                onClick={() => save.mutate(formToPayload(form))}
                disabled={!isValid(form) || save.isPending}
              >
                {save.isPending ? 'Saving…' : 'Save'}
              </button>
            </div>
          </td>
        </tr>
        {save.error && (
          <tr>
            <td colSpan={4} className="px-3 py-1 text-sm text-negative" role="alert">
              {save.error.message}
            </td>
          </tr>
        )}
      </>
    )
  }

  return (
    <>
      <tr className="border-b border-slate-100 last:border-0">
        <td className="px-3 py-2 font-medium text-ink">{row.code}</td>
        <td className="px-3 py-2 tabular-nums">{row.ordinal}</td>
        <td className="px-3 py-2 tabular-nums">{row.year ?? '—'}</td>
        <td className="px-3 py-2">
          <div className="flex justify-end gap-2">
            <button type="button" className={ghostButton} onClick={startEdit}>
              Edit
            </button>
            <button
              type="button"
              className={ghostButton}
              onClick={() => {
                if (window.confirm(`Delete AMS year "${row.code}"?`)) remove.mutate()
              }}
              disabled={remove.isPending}
            >
              {remove.isPending ? 'Deleting…' : 'Delete'}
            </button>
          </div>
        </td>
      </tr>
      {remove.error && (
        <tr>
          <td colSpan={4} className="px-3 py-1 text-sm text-negative" role="alert">
            {remove.error.message}
          </td>
        </tr>
      )}
    </>
  )
}

function NewYearModal({ onClose }: { onClose: () => void }) {
  const queryClient = useQueryClient()
  const [form, setForm] = useState<FormState>(EMPTY_FORM)

  const create = useMutation({
    mutationFn: () => createAmsYear(formToPayload(form)),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: QUERY_KEY })
      onClose()
    },
  })

  const patch = (part: Partial<FormState>) =>
    setForm((current) => ({ ...current, ...part }))

  return (
    <Modal onClose={onClose} labelledBy="new-year-title">
      <div className="space-y-4 p-5">
        <h2 id="new-year-title" className="text-lg font-semibold text-slate-900">
          New AMS year
        </h2>
        <div className="grid gap-3 sm:grid-cols-3">
          <label className={fieldLabel}>
            Code *
            <input
              className={inputClass}
              value={form.code}
              onChange={(event) => patch({ code: event.target.value })}
            />
          </label>
          <label className={fieldLabel}>
            Ordinal *
            <input
              type="number"
              className={inputClass}
              value={form.ordinal}
              onChange={(event) => patch({ ordinal: event.target.value })}
            />
          </label>
          <label className={fieldLabel}>
            Calendar year
            <input
              type="number"
              className={inputClass}
              value={form.year}
              onChange={(event) => patch({ year: event.target.value })}
            />
          </label>
        </div>
        {create.error && (
          <p className="text-sm text-negative" role="alert">
            {create.error.message}
          </p>
        )}
        <div className="flex justify-end gap-2">
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
            disabled={!isValid(form) || create.isPending}
          >
            {create.isPending ? 'Creating…' : 'Create year'}
          </button>
        </div>
      </div>
    </Modal>
  )
}

export function YearsPage() {
  const rows = useQuery({ queryKey: QUERY_KEY, queryFn: fetchAmsYears })
  const [creating, setCreating] = useState(false)
  const sorted = useMemo(
    () => [...(rows.data ?? [])].sort((a, b) => a.ordinal - b.ordinal),
    [rows.data],
  )

  return (
    <div className="space-y-6">
      <PageHeader
        title="Anni AMS"
        subtitle="Gestisci gli anni contrattuali AMS usati da ticket, processi e costi."
        action={
          <button type="button" className={primaryButton} onClick={() => setCreating(true)}>
            + Nuovo anno
          </button>
        }
      />

      {creating && <NewYearModal onClose={() => setCreating(false)} />}

      <AsyncSection
        isPending={rows.isPending}
        isError={rows.isError}
        error={rows.error}
        loadingLabel="Loading years…"
      >
        <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white shadow-card">
          <table className="w-full min-w-[420px] text-sm">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50 text-xs font-semibold uppercase tracking-wide text-slate-500">
                <th className="px-3 py-3 text-left">Code</th>
                <th className="px-3 py-3 text-left">Ordinal</th>
                <th className="px-3 py-3 text-left">Calendar year</th>
                <th className="px-3 py-3" />
              </tr>
            </thead>
            <tbody>
              {sorted.map((row) => (
                <YearRow key={row.id} row={row} />
              ))}
              {sorted.length === 0 && (
                <tr>
                  <td colSpan={4} className="px-3 py-6 text-center text-slate-500">
                    No AMS years yet. Add one to get started.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </AsyncSection>
    </div>
  )
}
