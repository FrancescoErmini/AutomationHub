import { useEffect, useMemo, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

import { fetchPeople } from '../api/people'
import {
  addProcessStakeholder,
  createProcess,
  deleteProcess,
  fetchProcessOptions,
  fetchProcesses,
  removeProcessStakeholder,
  updateProcess,
  type ProcessOptions,
  type ProcessRow,
  type ProcessStakeholderRow,
  type ProcessUpdate,
} from '../api/processes'
import { AsyncSection } from '../components/AsyncSection'
import { inputClass, RefSelect } from '../components/shared/formControls'
import { Modal, PageHeader, StatusBadge } from '../components/ui'

function useDebouncedValue<T>(value: T, ms: number): T {
  const [debounced, setDebounced] = useState(value)
  useEffect(() => {
    const id = window.setTimeout(() => setDebounced(value), ms)
    return () => window.clearTimeout(id)
  }, [value, ms])
  return debounced
}

const QUERY_KEY = ['processes']
const OPTIONS_KEY = ['processes', 'options']

interface FormState {
  canonical_name: string
  description: string
  documentation_url: string
  department_id: string
  company_id: string
  ams_year_id: string
  process_type_id: string
  status: string
  go_live_date: string
  in_pipeline: boolean
}

const EMPTY_FORM: FormState = {
  canonical_name: '',
  description: '',
  documentation_url: '',
  department_id: '',
  company_id: '',
  ams_year_id: '',
  process_type_id: '',
  status: '',
  go_live_date: '',
  in_pipeline: false,
}

function rowToForm(row: ProcessRow): FormState {
  return {
    canonical_name: row.canonical_name,
    description: row.description ?? '',
    documentation_url: row.documentation_url ?? '',
    department_id: row.department_id === null ? '' : String(row.department_id),
    company_id: row.company_id === null ? '' : String(row.company_id),
    ams_year_id: row.ams_year_id === null ? '' : String(row.ams_year_id),
    process_type_id: row.process_type_id === null ? '' : String(row.process_type_id),
    status: row.status ?? '',
    go_live_date: row.go_live_date ?? '',
    in_pipeline: row.in_pipeline,
  }
}

const numOrNull = (value: string): number | null => (value === '' ? null : Number(value))

function formToPayload(form: FormState): ProcessUpdate {
  return {
    canonical_name: form.canonical_name.trim(),
    description: form.description.trim() || null,
    documentation_url: form.documentation_url.trim() || null,
    department_id: numOrNull(form.department_id),
    company_id: numOrNull(form.company_id),
    ams_year_id: numOrNull(form.ams_year_id),
    process_type_id: numOrNull(form.process_type_id),
    status: form.status.trim() || null,
    go_live_date: form.go_live_date || null,
    in_pipeline: form.in_pipeline,
  }
}

const isValid = (form: FormState) => form.canonical_name.trim() !== ''

const ghostButton =
  'rounded-lg border border-slate-300 px-3 py-1.5 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50'
const primaryButton =
  'rounded-lg bg-brand px-3 py-1.5 text-sm font-semibold text-white transition hover:bg-brandHover disabled:cursor-not-allowed disabled:opacity-50'
const fieldLabel =
  'flex flex-col gap-1 text-xs font-semibold uppercase tracking-wide text-slate-500'

function StakeholderRoleRow({
  processId,
  role,
  people,
}: {
  processId: number
  role: string
  people: ProcessStakeholderRow[]
}) {
  const queryClient = useQueryClient()
  const [email, setEmail] = useState('')
  const [name, setName] = useState('')
  const debouncedEmail = useDebouncedValue(email.trim(), 250)
  const datalistId = `people-options-${role.replace(/[^a-z0-9]+/gi, '-').toLowerCase()}`

  const search = useQuery({
    queryKey: ['people', 'search', debouncedEmail],
    queryFn: () => fetchPeople(debouncedEmail),
    enabled: debouncedEmail.length >= 2,
    staleTime: 30_000,
  })

  const matched = (search.data ?? []).find(
    (person) => person.email.toLowerCase() === email.trim().toLowerCase(),
  )
  const isNewPerson = email.trim() !== '' && !matched

  const add = useMutation({
    mutationFn: () =>
      addProcessStakeholder(processId, {
        role,
        email: email.trim(),
        name: isNewPerson ? name.trim() || null : null,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: QUERY_KEY })
      setEmail('')
      setName('')
    },
  })

  const remove = useMutation({
    mutationFn: (stakeholderId: number) => removeProcessStakeholder(processId, stakeholderId),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: QUERY_KEY }),
  })

  const canAdd = email.trim() !== '' && email.trim().includes('@') && !add.isPending

  return (
    <div className="space-y-1.5 border-b border-slate-100 py-2 last:border-0">
      <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">
        {role}
      </span>
      {people.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {people.map((person) => (
            <span
              key={person.id}
              className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2 py-1 text-xs text-slate-700"
            >
              {person.person_name ?? person.person_email}
              <button
                type="button"
                className="text-slate-400 hover:text-negative"
                onClick={() => remove.mutate(person.id)}
                disabled={remove.isPending}
                aria-label={`Remove ${person.person_email} from ${role}`}
              >
                ×
              </button>
            </span>
          ))}
        </div>
      )}
      <div className="flex flex-wrap items-center gap-2">
        <input
          className={`${inputClass} max-w-[220px]`}
          type="text"
          list={datalistId}
          placeholder="email…"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
        />
        {isNewPerson && (
          <input
            className={`${inputClass} max-w-[180px]`}
            type="text"
            placeholder="name (new contact)"
            value={name}
            onChange={(event) => setName(event.target.value)}
          />
        )}
        <button
          type="button"
          className={ghostButton}
          onClick={() => add.mutate()}
          disabled={!canAdd}
        >
          {add.isPending ? 'Adding…' : '+ Add'}
        </button>
      </div>
      {add.error && (
        <p className="text-xs text-negative" role="alert">
          {add.error.message}
        </p>
      )}
      <datalist id={datalistId}>
        {(search.data ?? []).map((person) => (
          <option key={person.id} value={person.email}>
            {person.name ?? person.email}
          </option>
        ))}
      </datalist>
    </div>
  )
}

function StakeholderSection({
  processId,
  roles,
  stakeholders,
}: {
  processId: number
  roles: string[]
  stakeholders: ProcessStakeholderRow[]
}) {
  return (
    <div className="border-t border-slate-200 pt-3">
      <h3 className="mb-1 text-sm font-semibold text-ink">Stakeholder</h3>
      <div className="max-h-64 overflow-y-auto pr-1">
        {roles.map((role) => (
          <StakeholderRoleRow
            key={role}
            processId={processId}
            role={role}
            people={stakeholders.filter((s) => s.role === role)}
          />
        ))}
      </div>
    </div>
  )
}

function ProcessFormModal({
  options,
  initial,
  processId,
  stakeholders,
  onSubmit,
  isPending,
  error,
  onClose,
  title,
  submitLabel,
}: {
  options: ProcessOptions
  initial: FormState
  processId: number | null
  stakeholders: ProcessStakeholderRow[]
  onSubmit: (payload: ProcessUpdate) => void
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
    <Modal onClose={onClose} labelledBy="process-form-title">
      <div className="space-y-4 p-5">
        <h2 id="process-form-title" className="text-lg font-semibold text-slate-900">
          {title}
        </h2>
        <div className="grid gap-3 sm:grid-cols-2">
          <label className={`${fieldLabel} sm:col-span-2`}>
            Name *
            <input
              className={inputClass}
              value={form.canonical_name}
              onChange={(event) => patch({ canonical_name: event.target.value })}
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
            Department
            <RefSelect
              label="Department"
              value={form.department_id}
              onChange={(next) => patch({ department_id: next })}
              options={options.departments}
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
          <label className={fieldLabel}>
            Process type
            <RefSelect
              label="Process type"
              value={form.process_type_id}
              onChange={(next) => patch({ process_type_id: next })}
              options={options.process_types}
            />
          </label>
          <label className={fieldLabel}>
            Status
            <input
              className={inputClass}
              value={form.status}
              onChange={(event) => patch({ status: event.target.value })}
            />
          </label>
          <label className={fieldLabel}>
            Go-live date
            <input
              type="date"
              className={inputClass}
              value={form.go_live_date}
              onChange={(event) => patch({ go_live_date: event.target.value })}
            />
          </label>
          <label className={`${fieldLabel} sm:col-span-2`}>
            Documentation URL
            <input
              className={inputClass}
              value={form.documentation_url}
              onChange={(event) => patch({ documentation_url: event.target.value })}
            />
          </label>
          <label className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
            <input
              type="checkbox"
              checked={form.in_pipeline}
              onChange={(event) => patch({ in_pipeline: event.target.checked })}
            />
            In pipeline
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

        {processId !== null && (
          <StakeholderSection
            processId={processId}
            roles={options.roles}
            stakeholders={stakeholders}
          />
        )}

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

function ProcessTableRow({
  row,
  onEdit,
}: {
  row: ProcessRow
  onEdit: () => void
}) {
  const queryClient = useQueryClient()
  const remove = useMutation({
    mutationFn: () => deleteProcess(row.id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: QUERY_KEY }),
  })

  return (
    <>
      <tr className="border-b border-slate-100 last:border-0">
        <td className="px-3 py-2 font-medium text-ink">{row.canonical_name}</td>
        <td className="px-3 py-2">{row.company_name ?? '—'}</td>
        <td className="px-3 py-2">{row.department_name ?? '—'}</td>
        <td className="px-3 py-2">{row.ams_year_code ?? '—'}</td>
        <td className="px-3 py-2">{row.process_type_name ?? '—'}</td>
        <td className="px-3 py-2">{row.status ?? '—'}</td>
        <td className="px-3 py-2">
          {row.in_pipeline ? <StatusBadge tone="warning">In pipeline</StatusBadge> : '—'}
        </td>
        <td className="px-3 py-2">
          <div className="flex justify-end gap-2">
            <button type="button" className={ghostButton} onClick={onEdit}>
              Edit
            </button>
            <button
              type="button"
              className={ghostButton}
              onClick={() => {
                if (window.confirm(`Delete process "${row.canonical_name}"?`)) {
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
          <td colSpan={8} className="px-3 py-1 text-sm text-negative" role="alert">
            {remove.error.message}
          </td>
        </tr>
      )}
    </>
  )
}

export function ProcessesPage() {
  const rows = useQuery({ queryKey: QUERY_KEY, queryFn: fetchProcesses })
  const options = useQuery({
    queryKey: OPTIONS_KEY,
    queryFn: fetchProcessOptions,
    staleTime: 5 * 60_000,
  })
  const queryClient = useQueryClient()

  const [search, setSearch] = useState('')
  const [creating, setCreating] = useState(false)
  const [editingProcessId, setEditingProcessId] = useState<number | null>(null)
  // Derived (not a snapshot) so it stays fresh after each stakeholder add/remove,
  // which invalidates QUERY_KEY and refetches the list.
  const editingRow = rows.data?.find((row) => row.id === editingProcessId) ?? null

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase()
    const data = rows.data ?? []
    if (term === '') return data
    return data.filter((row) => row.canonical_name.toLowerCase().includes(term))
  }, [rows.data, search])

  const create = useMutation({
    mutationFn: (payload: ProcessUpdate) => createProcess(payload),
    onSuccess: (createdRow) => {
      // Seed the cache with the server response so the edit modal (opened
      // immediately below) finds the row without waiting on the refetch.
      queryClient.setQueryData<ProcessRow[]>(QUERY_KEY, (current) =>
        current ? [...current, createdRow] : [createdRow],
      )
      queryClient.invalidateQueries({ queryKey: QUERY_KEY })
      setCreating(false)
      setEditingProcessId(createdRow.id)
    },
  })

  const update = useMutation({
    mutationFn: (payload: ProcessUpdate) => updateProcess(editingRow!.id, payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: QUERY_KEY })
      setEditingProcessId(null)
    },
  })

  return (
    <div className="space-y-6">
      <PageHeader
        title="Processi"
        subtitle="Anagrafica dei processi: azienda, dipartimento, anno AMS e tipo processo."
        action={
          <button
            type="button"
            className={primaryButton}
            onClick={() => setCreating(true)}
            disabled={!options.data}
          >
            + Nuovo processo
          </button>
        }
      />

      {creating && options.data && (
        <ProcessFormModal
          options={options.data}
          initial={EMPTY_FORM}
          processId={null}
          stakeholders={[]}
          onSubmit={(payload) => create.mutate(payload)}
          isPending={create.isPending}
          error={create.error}
          onClose={() => setCreating(false)}
          title="New process"
          submitLabel="Create process"
        />
      )}

      {editingRow && options.data && (
        <ProcessFormModal
          key={editingRow.id}
          options={options.data}
          initial={rowToForm(editingRow)}
          processId={editingRow.id}
          stakeholders={editingRow.stakeholders}
          onSubmit={(payload) => update.mutate(payload)}
          isPending={update.isPending}
          error={update.error}
          onClose={() => setEditingProcessId(null)}
          title={`Edit ${editingRow.canonical_name}`}
          submitLabel="Save changes"
        />
      )}

      <input
        type="search"
        value={search}
        onChange={(event) => setSearch(event.target.value)}
        placeholder="Search by process name…"
        className="w-full max-w-xs rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/30"
      />

      <AsyncSection
        isPending={rows.isPending || options.isPending}
        isError={rows.isError || options.isError}
        error={rows.error ?? options.error}
        loadingLabel="Loading processes…"
      >
        <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white shadow-card">
          <table className="w-full min-w-[900px] text-sm">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50 text-xs font-semibold uppercase tracking-wide text-slate-500">
                <th className="px-3 py-3 text-left">Name</th>
                <th className="px-3 py-3 text-left">Company</th>
                <th className="px-3 py-3 text-left">Department</th>
                <th className="px-3 py-3 text-left">AMS year</th>
                <th className="px-3 py-3 text-left">Type</th>
                <th className="px-3 py-3 text-left">Status</th>
                <th className="px-3 py-3 text-left">Pipeline</th>
                <th className="px-3 py-3" />
              </tr>
            </thead>
            <tbody>
              {filtered.map((row) => (
                <ProcessTableRow
                  key={row.id}
                  row={row}
                  onEdit={() => setEditingProcessId(row.id)}
                />
              ))}
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={8} className="px-3 py-6 text-center text-slate-500">
                    {rows.data && rows.data.length > 0
                      ? 'No process matches your search.'
                      : 'No processes yet. Add one to get started.'}
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
