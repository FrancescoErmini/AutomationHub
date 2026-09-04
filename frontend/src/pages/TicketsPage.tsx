import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { useQuery } from '@tanstack/react-query'

import {
  fetchTicketOptions,
  fetchTickets,
  type TicketFilters,
  type TicketLevelFilter,
  type TicketPeriodFilter,
  type TicketStatusFilter,
} from '../api/tickets'
import { AsyncSection } from '../components/AsyncSection'
import { NewTicketForm } from '../components/tickets/NewTicketForm'
import {
  TICKET_COLUMN_COUNT,
  TicketEditableRow,
} from '../components/tickets/TicketRow'
import { KpiStat, PageHeader } from '../components/ui'

const PROCESS_DATALIST_ID = 'ticket-process-options'
const headCell =
  'whitespace-nowrap px-3 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500'
const selectClass =
  'rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/30'

const PERIOD_OPTIONS: { value: TicketPeriodFilter; label: string }[] = [
  { value: 'all', label: 'All time' },
  { value: '7d', label: 'Last 7 days' },
  { value: '14d', label: 'Last 14 days' },
  { value: '30d', label: 'Last 30 days' },
  { value: '90d', label: 'Last 90 days' },
  { value: 'month', label: 'This month' },
  { value: 'year', label: 'This year' },
  { value: 'last_year', label: 'Last year' },
]

function useDebounced<T>(value: T, ms: number): T {
  const [debounced, setDebounced] = useState(value)
  useEffect(() => {
    const id = window.setTimeout(() => setDebounced(value), ms)
    return () => window.clearTimeout(id)
  }, [value, ms])
  return debounced
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="flex flex-col gap-1 text-xs font-semibold uppercase tracking-wide text-slate-500">
      {label}
      {children}
    </label>
  )
}

export function TicketsPage() {
  const [status, setStatus] = useState<TicketStatusFilter>('all')
  const [period, setPeriod] = useState<TicketPeriodFilter>('14d')
  const [level, setLevel] = useState<TicketLevelFilter>('all')
  const [rootCauseId, setRootCauseId] = useState<number | null>(null)
  const [ticketType, setTicketType] = useState<string | null>(null)
  const [search, setSearch] = useState('')
  const debouncedSearch = useDebounced(search.trim(), 300)

  const [editingId, setEditingId] = useState<number | null>(null)
  const [creating, setCreating] = useState(false)
  const dirtyRef = useRef(false)

  const requestEdit = (id: number) => {
    if (
      editingId !== null &&
      editingId !== id &&
      dirtyRef.current &&
      !window.confirm('Discard unsaved changes to the ticket you are editing?')
    ) {
      return
    }
    dirtyRef.current = false
    setEditingId(id)
  }

  const options = useQuery({
    queryKey: ['tickets', 'options'],
    queryFn: fetchTicketOptions,
    staleTime: 5 * 60_000,
  })

  const filters: TicketFilters = {
    status,
    period,
    level,
    rootCauseId,
    ticketType,
    q: debouncedSearch,
  }

  const tickets = useQuery({
    queryKey: [
      'tickets',
      'list',
      status,
      period,
      level,
      rootCauseId,
      ticketType,
      debouncedSearch,
    ],
    queryFn: () => fetchTickets(filters),
  })

  const processOptions = options.data?.processes ?? []
  const rootCauseOptions = options.data?.root_causes ?? []
  const ticketTypeOptions = options.data?.ticket_types ?? []
  const rows = useMemo(() => tickets.data ?? [], [tickets.data])

  const stats = useMemo(
    () => ({
      total: rows.length,
      open: rows.filter((row) => row.is_open).length,
      twoL: rows.filter((row) => !row.is_1l).length,
      incident: rows.filter(
        (row) => row.ticket_type.toLowerCase() === 'incident',
      ).length,
    }),
    [rows],
  )

  return (
    <div className="space-y-6">
      <PageHeader
        title="Tickets"
        subtitle="Review and edit raw ticket records inline. Combine the filters to narrow the list; the page opens on tickets opened in the last 14 days."
        action={
          <button
            type="button"
            onClick={() => setCreating((open) => !open)}
            className="rounded-lg bg-brand px-3 py-2 text-sm font-semibold text-white transition hover:bg-brandHover"
          >
            {creating ? 'Close' : '+ New ticket'}
          </button>
        }
      />

      {creating && options.data && (
        <NewTicketForm
          options={options.data}
          onClose={() => setCreating(false)}
        />
      )}

      <div className="flex flex-wrap items-end gap-3">
        <Field label="Status">
          <select
            className={selectClass}
            value={status}
            onChange={(event) =>
              setStatus(event.target.value as TicketStatusFilter)
            }
          >
            <option value="all">All</option>
            <option value="open">Open</option>
            <option value="closed">Closed</option>
          </select>
        </Field>
        <Field label="Period">
          <select
            className={selectClass}
            value={period}
            onChange={(event) =>
              setPeriod(event.target.value as TicketPeriodFilter)
            }
          >
            {PERIOD_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </Field>
        <Field label="AMS level">
          <select
            className={selectClass}
            value={level}
            onChange={(event) =>
              setLevel(event.target.value as TicketLevelFilter)
            }
          >
            <option value="all">All</option>
            <option value="1l">1L</option>
            <option value="2l">2L</option>
          </select>
        </Field>
        <Field label="Root cause">
          <select
            className={selectClass}
            value={rootCauseId === null ? '' : String(rootCauseId)}
            onChange={(event) =>
              setRootCauseId(
                event.target.value === '' ? null : Number(event.target.value),
              )
            }
          >
            <option value="">All</option>
            {rootCauseOptions.map((option) => (
              <option key={option.id} value={option.id}>
                {option.label}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Ticket type">
          <select
            className={selectClass}
            value={ticketType ?? ''}
            onChange={(event) =>
              setTicketType(
                event.target.value === '' ? null : event.target.value,
              )
            }
          >
            <option value="">All</option>
            {ticketTypeOptions.map((type) => (
              <option key={type} value={type}>
                {type}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Search">
          <input
            type="search"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="id, requestor, process, note…"
            className={`${selectClass} w-56 font-normal normal-case`}
          />
        </Field>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <KpiStat label="Total tickets" value={String(stats.total)} />
        <KpiStat label="Open" value={String(stats.open)} />
        <KpiStat label="2L tickets" value={String(stats.twoL)} />
        <KpiStat label="Incident" value={String(stats.incident)} />
      </div>

      <datalist id={PROCESS_DATALIST_ID}>
        {processOptions.map((option) => (
          <option key={option.id} value={option.label} />
        ))}
      </datalist>

      <AsyncSection
        isPending={tickets.isPending || options.isPending}
        isError={tickets.isError || options.isError}
        error={tickets.error ?? options.error}
        loadingLabel="Loading tickets…"
      >
        <p className="text-xs text-slate-500">
          {rows.length} ticket{rows.length === 1 ? '' : 's'}
          {rows.length >= 500 ? ' (server-limited — narrow the filters)' : ''}
        </p>
        <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white shadow-card">
          <table className="w-auto table-auto text-sm">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50">
                <th
                  className={`${headCell} sticky left-0 z-20 border-r border-slate-200 bg-slate-50`}
                />
                <th className={headCell}>Ticket ID</th>
                <th className={headCell}>Process</th>
                <th className={headCell}>Requestor</th>
                <th className={headCell}>Start</th>
                <th className={headCell}>End</th>
                <th className={headCell}>Status</th>
                <th className={headCell}>Root cause</th>
                <th className={headCell}>Level</th>
                <th className={headCell}>Company</th>
                <th className={headCell}>AMS yr</th>
                <th className={headCell}>Priority</th>
                <th className={headCell}>Type</th>
              </tr>
            </thead>
            <tbody>
              {(() => {
                const opts = options.data
                if (!opts) return null
                return rows.map((row, index) => (
                  <TicketEditableRow
                    key={row.id}
                    row={row}
                    options={opts}
                    index={index}
                    isEditing={editingId === row.id}
                    onRequestEdit={() => requestEdit(row.id)}
                    onDone={() => {
                      dirtyRef.current = false
                      setEditingId(null)
                    }}
                    onDirtyChange={(value) => {
                      dirtyRef.current = value
                    }}
                  />
                ))
              })()}
              {rows.length === 0 && (
                <tr>
                  <td
                    colSpan={TICKET_COLUMN_COUNT}
                    className="px-3 py-6 text-center text-slate-500"
                  >
                    No tickets match the current filters.
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
