import { useEffect, useMemo, useRef, useState } from 'react'
import { useQuery } from '@tanstack/react-query'

import { fetchTicketOptions, fetchTickets } from '../api/tickets'
import { AsyncSection } from '../components/AsyncSection'
import { TicketEditableRow } from '../components/tickets/TicketRow'
import { PageHeader } from '../components/ui'

const PROCESS_DATALIST_ID = 'ticket-process-options'
const headCell =
  'whitespace-nowrap px-3 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500'

function useDebounced<T>(value: T, ms: number): T {
  const [debounced, setDebounced] = useState(value)
  useEffect(() => {
    const id = window.setTimeout(() => setDebounced(value), ms)
    return () => window.clearTimeout(id)
  }, [value, ms])
  return debounced
}

export function TicketsPage() {
  const [scope, setScope] = useState<'default' | 'all'>('default')
  const [search, setSearch] = useState('')
  const debouncedSearch = useDebounced(search.trim(), 300)
  const searching = debouncedSearch !== ''

  const [editingId, setEditingId] = useState<number | null>(null)
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

  const tickets = useQuery({
    queryKey: ['tickets', scope, debouncedSearch],
    queryFn: () => fetchTickets({ scope, q: debouncedSearch }),
  })

  const processOptions = options.data?.processes ?? []
  const rows = useMemo(() => tickets.data ?? [], [tickets.data])

  const toggleBtn = (value: 'default' | 'all', label: string) => (
    <button
      type="button"
      onClick={() => setScope(value)}
      disabled={searching}
      className={`rounded-lg px-3 py-2 text-sm font-semibold transition disabled:cursor-not-allowed disabled:opacity-50 ${
        scope === value
          ? 'bg-brand text-white'
          : 'border border-slate-300 text-slate-700 hover:bg-slate-50'
      }`}
    >
      {label}
    </button>
  )

  return (
    <div className="space-y-6">
      <PageHeader
        title="Tickets"
        subtitle="Review and edit raw ticket records inline. The default view shows every ticket still open plus anything opened or closed in the last 14 days; search spans all tickets."
      />

      <div className="flex flex-wrap items-center gap-3">
        <input
          type="search"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder="Search id, requestor, process, or note…"
          className="w-full max-w-sm rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/30"
        />
        <div className="flex gap-2">
          {toggleBtn('default', 'Recent & open')}
          {toggleBtn('all', 'All tickets')}
        </div>
        {searching && (
          <span className="text-xs text-slate-500">
            Showing search results across all tickets
          </span>
        )}
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
          {rows.length >= 500 ? ' (server-limited — narrow with search)' : ''}
        </p>
        <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white shadow-card">
          <table className="w-full min-w-[1400px] text-sm">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50">
                <th className={headCell}>Ticket ID</th>
                <th className={headCell}>Type</th>
                <th className={headCell}>Priority</th>
                <th className={headCell}>Process</th>
                <th className={headCell}>Requestor</th>
                <th className={headCell}>Start</th>
                <th className={headCell}>End</th>
                <th className={headCell}>Status</th>
                <th className={headCell}>Root cause</th>
                <th className={headCell}>Level</th>
                <th className={headCell}>Company</th>
                <th className={headCell}>AMS yr</th>
                <th className={headCell}>Note</th>
                <th className={headCell} />
              </tr>
            </thead>
            <tbody>
              {(() => {
                const opts = options.data
                if (!opts) return null
                return rows.map((row) => (
                  <TicketEditableRow
                    key={row.id}
                    row={row}
                    options={opts}
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
                    colSpan={14}
                    className="px-3 py-6 text-center text-slate-500"
                  >
                    {searching
                      ? 'No ticket matches your search.'
                      : 'No open or recently-touched tickets.'}
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
