import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

import { formatValue } from '../api/metrics'
import {
  createTcoCost,
  deleteTcoCost,
  fetchTcoCostOptions,
  fetchTcoCosts,
  importTcoCostsCsv,
  updateTcoCost,
  type TcoCostImportRowReport,
  type TcoCostRow,
  type TcoCostType,
  type TcoCostUpdate,
} from '../api/tcoCosts'
import { AsyncSection } from '../components/AsyncSection'
import { ImportCsvDialog } from '../components/shared/ImportCsvDialog'
import { inputClass } from '../components/shared/formControls'
import { Modal, PageHeader } from '../components/ui'

const QUERY_KEY = ['tco-costs']
const OPTIONS_KEY = ['tco-costs', 'options']
const SUBTYPE_DATALIST_ID = 'tco-cost-subtype-options'

interface FormState {
  cost_date: string
  cost_eur: string
  cost_type: TcoCostType
  subtype: string
  description: string
}

const EMPTY_FORM: FormState = {
  cost_date: '',
  cost_eur: '',
  cost_type: 'OPEX',
  subtype: '',
  description: '',
}

function rowToForm(row: TcoCostRow): FormState {
  return {
    cost_date: row.cost_date,
    cost_eur: String(row.cost_eur),
    cost_type: row.cost_type,
    subtype: row.subtype ?? '',
    description: row.description ?? '',
  }
}

function formToPayload(form: FormState): TcoCostUpdate {
  return {
    cost_date: form.cost_date,
    cost_eur: Number(form.cost_eur || 0),
    cost_type: form.cost_type,
    subtype: form.subtype.trim() || null,
    description: form.description.trim() || null,
  }
}

const isValid = (form: FormState) =>
  form.cost_date !== '' &&
  form.cost_eur !== '' &&
  Number.isFinite(Number(form.cost_eur)) &&
  Number(form.cost_eur) >= 0

const ghostButton =
  'rounded-lg border border-slate-300 px-3 py-1.5 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50'
const primaryButton =
  'rounded-lg bg-brand px-3 py-1.5 text-sm font-semibold text-white transition hover:bg-brandHover disabled:cursor-not-allowed disabled:opacity-50'
const fieldLabel =
  'flex flex-col gap-1 text-xs font-semibold uppercase tracking-wide text-slate-500'

function CostFormModal({
  subtypeOptions,
  initial,
  onSubmit,
  isPending,
  error,
  onClose,
  title,
  submitLabel,
}: {
  subtypeOptions: string[]
  initial: FormState
  onSubmit: (payload: TcoCostUpdate) => void
  isPending: boolean
  error: Error | null
  onClose: () => void
  title: string
  submitLabel: string
}) {
  const [form, setForm] = useState<FormState>(initial)
  const patch = (part: Partial<FormState>) =>
    setForm((current) => ({ ...current, ...part }))

  return (
    <Modal onClose={onClose} labelledBy="cost-form-title">
      <div className="space-y-4 p-5">
        <h2 id="cost-form-title" className="text-lg font-semibold text-slate-900">
          {title}
        </h2>
        <div className="grid gap-3 sm:grid-cols-2">
          <label className={fieldLabel}>
            Date *
            <input
              type="date"
              className={inputClass}
              value={form.cost_date}
              onChange={(event) => patch({ cost_date: event.target.value })}
            />
          </label>
          <label className={fieldLabel}>
            Amount (EUR) *
            <input
              type="number"
              min={0}
              step="any"
              className={inputClass}
              value={form.cost_eur}
              onChange={(event) => patch({ cost_eur: event.target.value })}
            />
          </label>
          <label className={fieldLabel}>
            Type *
            <select
              className={inputClass}
              value={form.cost_type}
              onChange={(event) => patch({ cost_type: event.target.value as TcoCostType })}
            >
              <option value="CAPEX">CAPEX</option>
              <option value="OPEX">OPEX</option>
            </select>
          </label>
          <label className={fieldLabel}>
            Subtype
            <input
              className={inputClass}
              list={SUBTYPE_DATALIST_ID}
              value={form.subtype}
              onChange={(event) => patch({ subtype: event.target.value })}
            />
            <datalist id={SUBTYPE_DATALIST_ID}>
              {subtypeOptions.map((subtype) => (
                <option key={subtype} value={subtype} />
              ))}
            </datalist>
          </label>
        </div>
        <label className={fieldLabel}>
          Description
          <textarea
            className={`${inputClass} resize-y font-normal normal-case`}
            rows={3}
            value={form.description}
            onChange={(event) => patch({ description: event.target.value })}
          />
        </label>

        {error && (
          <p className="text-sm text-negative" role="alert">
            {error.message}
          </p>
        )}

        <div className="flex justify-end gap-2">
          <button
            type="button"
            className={ghostButton}
            onClick={onClose}
            disabled={isPending}
          >
            Cancel
          </button>
          <button
            type="button"
            className={primaryButton}
            onClick={() => onSubmit(formToPayload(form))}
            disabled={!isValid(form) || isPending}
          >
            {isPending ? 'Saving…' : submitLabel}
          </button>
        </div>
      </div>
    </Modal>
  )
}

function CostTableRow({ row, onEdit }: { row: TcoCostRow; onEdit: () => void }) {
  const queryClient = useQueryClient()
  const remove = useMutation({
    mutationFn: () => deleteTcoCost(row.id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: QUERY_KEY }),
  })

  return (
    <>
      <tr className="border-b border-slate-100 last:border-0">
        <td className="px-3 py-2">{row.cost_date}</td>
        <td className="px-3 py-2">{row.cost_type}</td>
        <td className="px-3 py-2">{row.subtype ?? '—'}</td>
        <td className="px-3 py-2 text-right tabular-nums">
          {formatValue(row.cost_eur, 'eur')}
        </td>
        <td className="px-3 py-2 text-slate-600">{row.description ?? '—'}</td>
        <td className="px-3 py-2">
          <div className="flex justify-end gap-2">
            <button type="button" className={ghostButton} onClick={onEdit}>
              Edit
            </button>
            <button
              type="button"
              className={ghostButton}
              onClick={() => {
                if (window.confirm('Delete this cost record?')) remove.mutate()
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
          <td colSpan={6} className="px-3 py-1 text-sm text-negative" role="alert">
            {remove.error.message}
          </td>
        </tr>
      )}
    </>
  )
}

export function OrdersPage() {
  const rows = useQuery({ queryKey: QUERY_KEY, queryFn: fetchTcoCosts })
  const options = useQuery({
    queryKey: OPTIONS_KEY,
    queryFn: fetchTcoCostOptions,
    staleTime: 5 * 60_000,
  })
  const queryClient = useQueryClient()

  const [creating, setCreating] = useState(false)
  const [editingRow, setEditingRow] = useState<TcoCostRow | null>(null)
  const [importing, setImporting] = useState(false)

  const create = useMutation({
    mutationFn: (payload: TcoCostUpdate) => createTcoCost(payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: QUERY_KEY })
      queryClient.invalidateQueries({ queryKey: OPTIONS_KEY })
      setCreating(false)
    },
  })

  const update = useMutation({
    mutationFn: (payload: TcoCostUpdate) => updateTcoCost(editingRow!.id, payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: QUERY_KEY })
      setEditingRow(null)
    },
  })

  const rowsData = rows.data ?? []

  return (
    <div className="space-y-6">
      <PageHeader
        title="Ordini (TCO)"
        subtitle="Voci di costo CAPEX/OPEX del portafoglio, alla base del grafico TCO & ROI. Inserimento singolo o import CSV per i carichi periodici da finance."
        action={
          <div className="flex gap-2">
            <button
              type="button"
              className={ghostButton}
              onClick={() => setImporting(true)}
            >
              Import CSV
            </button>
            <button
              type="button"
              className={primaryButton}
              onClick={() => setCreating(true)}
              disabled={!options.data}
            >
              + Nuovo ordine
            </button>
          </div>
        }
      />

      {importing && (
        <ImportCsvDialog<TcoCostImportRowReport>
          title="Import TCO costs from CSV"
          invalidateKey={QUERY_KEY}
          importFn={importTcoCostsCsv}
          getRowLabel={(row) => row.description ?? ''}
          reportFilename="tco-cost-import-report.csv"
          onClose={() => setImporting(false)}
        />
      )}

      {creating && options.data && (
        <CostFormModal
          subtypeOptions={options.data.subtypes}
          initial={EMPTY_FORM}
          onSubmit={(payload) => create.mutate(payload)}
          isPending={create.isPending}
          error={create.error}
          onClose={() => setCreating(false)}
          title="New TCO cost"
          submitLabel="Create"
        />
      )}

      {editingRow && options.data && (
        <CostFormModal
          subtypeOptions={options.data.subtypes}
          initial={rowToForm(editingRow)}
          onSubmit={(payload) => update.mutate(payload)}
          isPending={update.isPending}
          error={update.error}
          onClose={() => setEditingRow(null)}
          title="Edit TCO cost"
          submitLabel="Save changes"
        />
      )}

      <AsyncSection
        isPending={rows.isPending}
        isError={rows.isError}
        error={rows.error}
        loadingLabel="Loading TCO costs…"
      >
        <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white shadow-card">
          <table className="w-full min-w-[720px] text-sm">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50 text-xs font-semibold uppercase tracking-wide text-slate-500">
                <th className="px-3 py-3 text-left">Date</th>
                <th className="px-3 py-3 text-left">Type</th>
                <th className="px-3 py-3 text-left">Subtype</th>
                <th className="px-3 py-3 text-right">Amount (EUR)</th>
                <th className="px-3 py-3 text-left">Description</th>
                <th className="px-3 py-3" />
              </tr>
            </thead>
            <tbody>
              {rowsData.map((row) => (
                <CostTableRow key={row.id} row={row} onEdit={() => setEditingRow(row)} />
              ))}
              {rowsData.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-3 py-6 text-center text-slate-500">
                    No TCO cost records yet.
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
