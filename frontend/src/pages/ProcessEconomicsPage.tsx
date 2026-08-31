import { useMemo, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

import { formatValue } from '../api/metrics'
import {
  createProcessEconomics,
  deleteProcessEconomics,
  fetchProcessEconomics,
  fetchProcessOptions,
  updateProcessEconomics,
  type ProcessEconomicsCreate,
  type ProcessEconomicsRow,
  type ProcessEconomicsUpdate,
} from '../api/processEconomics'
import { AsyncSection } from '../components/AsyncSection'

const ROI_YEAR_OPTIONS = [1, 2, 3, 5]

const QUERY_KEY = ['process-economics']
const OPTIONS_KEY = ['process-economics', 'process-options']

interface RowFormState {
  capex_eur: string
  roi_expected_yr: string
  fte_hours_month_actual: string
  extra_annual_saving_eur: string
  note: string
}

const EMPTY_FORM: RowFormState = {
  capex_eur: '',
  roi_expected_yr: '',
  fte_hours_month_actual: '',
  extra_annual_saving_eur: '',
  note: '',
}

function rowToForm(row: ProcessEconomicsRow): RowFormState {
  return {
    capex_eur: String(row.capex_eur),
    roi_expected_yr:
      row.roi_expected_yr === null ? '' : String(row.roi_expected_yr),
    fte_hours_month_actual: String(row.fte_hours_month_actual),
    extra_annual_saving_eur: String(row.extra_annual_saving_eur),
    note: row.note ?? '',
  }
}

function formToUpdate(form: RowFormState): ProcessEconomicsUpdate {
  return {
    capex_eur: Number(form.capex_eur || 0),
    roi_expected_yr:
      form.roi_expected_yr === '' ? null : Number(form.roi_expected_yr),
    fte_hours_month_actual: Number(form.fte_hours_month_actual || 0),
    extra_annual_saving_eur: Number(form.extra_annual_saving_eur || 0),
    note: form.note.trim() === '' ? null : form.note.trim(),
  }
}

function isFormValid(form: RowFormState): boolean {
  const numbers = [
    form.capex_eur,
    form.fte_hours_month_actual,
    form.extra_annual_saving_eur,
  ]
  return numbers.every(
    (value) =>
      value !== '' && Number.isFinite(Number(value)) && Number(value) >= 0,
  )
}

const inputClass =
  'w-full rounded-lg border border-slate-300 px-2 py-1 text-sm focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/30'
const numberCell = 'px-3 py-2 text-right tabular-nums'
const ghostButton =
  'rounded-lg border border-slate-300 px-3 py-1 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50'
const primaryButton =
  'rounded-lg bg-brand px-3 py-1 text-sm font-semibold text-white hover:brightness-95 disabled:cursor-not-allowed disabled:opacity-50'

function FormFields({
  form,
  onChange,
}: {
  form: RowFormState
  onChange: (patch: Partial<RowFormState>) => void
}) {
  return (
    <>
      <td className={numberCell}>
        <input
          type="number"
          min={0}
          step={1000}
          value={form.capex_eur}
          onChange={(event) => onChange({ capex_eur: event.target.value })}
          className={`${inputClass} text-right`}
          aria-label="CAPEX (EUR)"
        />
      </td>
      <td className="px-3 py-2">
        <select
          value={form.roi_expected_yr}
          onChange={(event) =>
            onChange({ roi_expected_yr: event.target.value })
          }
          className={inputClass}
          aria-label="ROI expected (years)"
        >
          <option value="">—</option>
          {ROI_YEAR_OPTIONS.map((year) => (
            <option key={year} value={year}>
              {year} yr
            </option>
          ))}
        </select>
      </td>
      <td className={numberCell}>
        <input
          type="number"
          min={0}
          step={1}
          value={form.fte_hours_month_actual}
          onChange={(event) =>
            onChange({ fte_hours_month_actual: event.target.value })
          }
          className={`${inputClass} text-right`}
          aria-label="FTE hours / month (actual)"
        />
      </td>
      <td className={numberCell}>
        <input
          type="number"
          min={0}
          step={1000}
          value={form.extra_annual_saving_eur}
          onChange={(event) =>
            onChange({ extra_annual_saving_eur: event.target.value })
          }
          className={`${inputClass} text-right`}
          aria-label="Extra annual saving (EUR)"
        />
      </td>
      <td className="px-3 py-2">
        <input
          type="text"
          value={form.note}
          onChange={(event) => onChange({ note: event.target.value })}
          className={inputClass}
          aria-label="Note"
        />
      </td>
    </>
  )
}

function EconomicsRow({ row }: { row: ProcessEconomicsRow }) {
  const queryClient = useQueryClient()
  const [editing, setEditing] = useState(false)
  const [form, setForm] = useState<RowFormState>(() => rowToForm(row))

  const save = useMutation({
    mutationFn: (payload: ProcessEconomicsUpdate) =>
      updateProcessEconomics(row.id, payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: QUERY_KEY })
      setEditing(false)
    },
  })

  const remove = useMutation({
    mutationFn: () => deleteProcessEconomics(row.id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: QUERY_KEY })
      queryClient.invalidateQueries({ queryKey: OPTIONS_KEY })
    },
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
          <td className="px-3 py-2 font-medium text-ink">{row.process_name}</td>
          <FormFields
            form={form}
            onChange={(patch) =>
              setForm((current) => ({ ...current, ...patch }))
            }
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
                onClick={() => save.mutate(formToUpdate(form))}
                disabled={!isFormValid(form) || save.isPending}
              >
                {save.isPending ? 'Saving…' : 'Save'}
              </button>
            </div>
          </td>
        </tr>
        {save.error && (
          <tr>
            <td
              colSpan={7}
              className="px-3 py-1 text-sm text-brand"
              role="alert"
            >
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
        <td className="px-3 py-2 font-medium text-ink">{row.process_name}</td>
        <td className={numberCell}>{formatValue(row.capex_eur, 'eur')}</td>
        <td className="px-3 py-2">
          {row.roi_expected_yr === null ? '—' : `${row.roi_expected_yr} yr`}
        </td>
        <td className={numberCell}>
          {row.fte_hours_month_actual.toLocaleString('en-IE')}
        </td>
        <td className={numberCell}>
          {formatValue(row.extra_annual_saving_eur, 'eur')}
        </td>
        <td className="px-3 py-2 text-slate-600">{row.note ?? '—'}</td>
        <td className="px-3 py-2">
          <div className="flex justify-end gap-2">
            <button type="button" className={ghostButton} onClick={startEdit}>
              Edit
            </button>
            <button
              type="button"
              className={ghostButton}
              onClick={() => {
                if (
                  window.confirm(
                    `Delete process economics for "${row.process_name}"?`,
                  )
                ) {
                  remove.mutate()
                }
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
          <td colSpan={7} className="px-3 py-1 text-sm text-brand" role="alert">
            {remove.error.message}
          </td>
        </tr>
      )}
    </>
  )
}

function AddRow({ takenProcessIds }: { takenProcessIds: Set<number> }) {
  const queryClient = useQueryClient()
  const options = useQuery({
    queryKey: OPTIONS_KEY,
    queryFn: fetchProcessOptions,
  })
  const [open, setOpen] = useState(false)
  const [processId, setProcessId] = useState('')
  const [form, setForm] = useState<RowFormState>(EMPTY_FORM)

  const create = useMutation({
    mutationFn: (payload: ProcessEconomicsCreate) =>
      createProcessEconomics(payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: QUERY_KEY })
      queryClient.invalidateQueries({ queryKey: OPTIONS_KEY })
      setOpen(false)
      setProcessId('')
      setForm(EMPTY_FORM)
    },
  })

  const available = (options.data ?? []).filter(
    (option) => !option.has_economics && !takenProcessIds.has(option.id),
  )

  if (!open) {
    return (
      <div>
        <button
          type="button"
          className={primaryButton}
          onClick={() => setOpen(true)}
        >
          + Add process economics
        </button>
      </div>
    )
  }

  const canSave = processId !== '' && isFormValid(form) && !create.isPending

  return (
    <div className="w-full basis-full rounded-xl border border-slate-200 bg-white p-4">
      <div className="overflow-x-auto">
        <table className="w-full min-w-[720px] text-sm">
          <thead>
            <tr className="border-b border-slate-200 bg-slate-50 text-xs font-semibold uppercase tracking-wide text-slate-500">
              <th className="px-3 py-2 text-left">Process</th>
              <th className="px-3 py-2 text-right">CAPEX (EUR)</th>
              <th className="px-3 py-2 text-left">ROI expected</th>
              <th className="px-3 py-2 text-right">FTE hrs / month</th>
              <th className="px-3 py-2 text-right">
                Extra annual saving (EUR)
              </th>
              <th className="px-3 py-2 text-left">Note</th>
              <th className="px-3 py-2" />
            </tr>
          </thead>
          <tbody>
            <tr>
              <td className="px-3 py-2">
                <select
                  value={processId}
                  onChange={(event) => setProcessId(event.target.value)}
                  className={inputClass}
                  aria-label="Process"
                >
                  <option value="">Select a process…</option>
                  {available.map((option) => (
                    <option key={option.id} value={option.id}>
                      {option.canonical_name}
                    </option>
                  ))}
                </select>
              </td>
              <FormFields
                form={form}
                onChange={(patch) =>
                  setForm((current) => ({ ...current, ...patch }))
                }
              />
              <td className="px-3 py-2">
                <div className="flex justify-end gap-2">
                  <button
                    type="button"
                    className={ghostButton}
                    onClick={() => {
                      setOpen(false)
                      setForm(EMPTY_FORM)
                      setProcessId('')
                      create.reset()
                    }}
                    disabled={create.isPending}
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    className={primaryButton}
                    disabled={!canSave}
                    onClick={() =>
                      create.mutate({
                        process_id: Number(processId),
                        ...formToUpdate(form),
                      })
                    }
                  >
                    {create.isPending ? 'Adding…' : 'Add'}
                  </button>
                </div>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
      {available.length === 0 && !options.isPending && (
        <p className="mt-2 text-sm text-slate-500">
          Every process already has an economics row. Edit an existing row
          instead.
        </p>
      )}
      {create.error && (
        <p className="mt-2 text-sm text-brand" role="alert">
          {create.error.message}
        </p>
      )}
    </div>
  )
}

export function ProcessEconomicsPage() {
  const rows = useQuery({ queryKey: QUERY_KEY, queryFn: fetchProcessEconomics })
  const [search, setSearch] = useState('')

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase()
    const data = rows.data ?? []
    if (term === '') return data
    return data.filter((row) => row.process_name.toLowerCase().includes(term))
  }, [rows.data, search])

  const takenProcessIds = useMemo(
    () => new Set((rows.data ?? []).map((row) => row.process_id)),
    [rows.data],
  )

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-3xl font-bold tracking-tight text-ink">
          Process Economics
        </h1>
        <p className="mt-1 text-slate-600">
          Maintain the per-process business case: CAPEX, expected ROI horizon,
          actual FTE hours saved per month, and any extra annual saving.
        </p>
      </header>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <input
          type="search"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder="Search by process name…"
          className="w-full max-w-xs rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/30"
        />
        <AddRow takenProcessIds={takenProcessIds} />
      </div>

      <AsyncSection
        isPending={rows.isPending}
        isError={rows.isError}
        error={rows.error}
        loadingLabel="Loading process economics…"
      >
        <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white">
          <table className="w-full min-w-[720px] text-sm">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50 text-xs font-semibold uppercase tracking-wide text-slate-500">
                <th className="px-3 py-3 text-left">Process</th>
                <th className="px-3 py-3 text-right">CAPEX (EUR)</th>
                <th className="px-3 py-3 text-left">ROI expected</th>
                <th className="px-3 py-3 text-right">FTE hrs / month</th>
                <th className="px-3 py-3 text-right">
                  Extra annual saving (EUR)
                </th>
                <th className="px-3 py-3 text-left">Note</th>
                <th className="px-3 py-3" />
              </tr>
            </thead>
            <tbody>
              {filtered.map((row) => (
                <EconomicsRow key={row.id} row={row} />
              ))}
              {filtered.length === 0 && (
                <tr>
                  <td
                    colSpan={7}
                    className="px-3 py-6 text-center text-slate-500"
                  >
                    {rows.data && rows.data.length > 0
                      ? 'No process matches your search.'
                      : 'No process economics yet. Add one to get started.'}
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
