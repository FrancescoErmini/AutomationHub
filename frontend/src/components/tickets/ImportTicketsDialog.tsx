import { useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'

import {
  importTicketsCsv,
  type TicketImportReport,
  type TicketImportRowReport,
} from '../../api/tickets'
import { Modal } from '../ui'

const primaryButton =
  'rounded-lg bg-brand px-3 py-1.5 text-sm font-semibold text-white transition hover:bg-brandHover disabled:cursor-not-allowed disabled:opacity-50'
const ghostButton =
  'rounded-lg border border-slate-300 px-3 py-1.5 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50'

function downloadReport(rows: TicketImportRowReport[]) {
  const escape = (value: string) => `"${value.replace(/"/g, '""')}"`
  const lines = [
    'line,ticket_id,action,errors',
    ...rows.map((row) =>
      [
        row.line,
        escape(row.ticket_id ?? ''),
        row.action,
        escape(row.errors.join('; ')),
      ].join(','),
    ),
  ]
  const blob = new Blob([lines.join('\n')], { type: 'text/csv' })
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = 'ticket-import-report.csv'
  anchor.click()
  URL.revokeObjectURL(url)
}

function Summary({ report }: { report: TicketImportReport }) {
  const verb = report.committed
    ? ['inserted', 'updated']
    : ['to insert', 'to update']
  return (
    <p className="text-sm text-slate-700">
      <strong>{report.total_rows}</strong> rows ·{' '}
      <strong>{report.inserted}</strong> {verb[0]} ·{' '}
      <strong>{report.updated}</strong> {verb[1]} ·{' '}
      <strong>{report.skipped}</strong> skipped
    </p>
  )
}

export function ImportTicketsDialog({ onClose }: { onClose: () => void }) {
  const queryClient = useQueryClient()
  const [file, setFile] = useState<File | null>(null)

  const preview = useMutation({
    mutationFn: (f: File) => importTicketsCsv(f, false),
  })
  const apply = useMutation({
    mutationFn: (f: File) => importTicketsCsv(f, true),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['tickets'] }),
  })

  const report = apply.data ?? preview.data
  const error = apply.error ?? preview.error
  const busy = preview.isPending || apply.isPending

  const onPick = (next: File | null) => {
    setFile(next)
    preview.reset()
    apply.reset()
    if (next) preview.mutate(next)
  }

  return (
    <Modal onClose={onClose} labelledBy="import-tickets-title">
      <div className="space-y-4 p-5">
        <h2
          id="import-tickets-title"
          className="text-lg font-semibold text-slate-900"
        >
          Import tickets from CSV
        </h2>

        <input
          type="file"
          accept=".csv,text/csv"
          onChange={(event) => onPick(event.target.files?.[0] ?? null)}
          className="block text-sm"
        />

        {busy && <p className="text-sm text-slate-500">Working…</p>}

        {error && (
          <p className="text-sm text-negative" role="alert">
            {error.message}
          </p>
        )}

        {report && (
          <div className="space-y-3">
            <Summary report={report} />
            {report.rows.length > 0 && (
              <div className="max-h-72 overflow-y-auto rounded-lg border border-slate-200">
                <table className="w-full text-left text-xs">
                  <thead className="sticky top-0 bg-slate-50 text-slate-500">
                    <tr>
                      <th className="px-2 py-1.5 font-semibold">Line</th>
                      <th className="px-2 py-1.5 font-semibold">Ticket ID</th>
                      <th className="px-2 py-1.5 font-semibold">Reason</th>
                    </tr>
                  </thead>
                  <tbody>
                    {report.rows.map((row) => (
                      <tr key={row.line} className="border-t border-slate-100">
                        <td className="px-2 py-1.5 tabular-nums">{row.line}</td>
                        <td className="px-2 py-1.5">{row.ticket_id ?? '—'}</td>
                        <td className="px-2 py-1.5 text-slate-700">
                          {row.errors.join('; ')}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        <div className="flex justify-end gap-2">
          {report && report.rows.length > 0 && (
            <button
              type="button"
              className={ghostButton}
              onClick={() => downloadReport(report.rows)}
            >
              Download report
            </button>
          )}
          <button type="button" className={ghostButton} onClick={onClose}>
            {apply.data ? 'Close' : 'Cancel'}
          </button>
          {file && preview.data && !apply.data && (
            <button
              type="button"
              className={primaryButton}
              disabled={
                busy || preview.data.inserted + preview.data.updated === 0
              }
              onClick={() => apply.mutate(file)}
            >
              Apply import
            </button>
          )}
        </div>
      </div>
    </Modal>
  )
}
