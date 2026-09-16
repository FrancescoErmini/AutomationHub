import { useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'

import { Modal } from '../ui'

interface ImportRowReport {
  line: number
  action: string
  errors: string[]
}

interface ImportReport<Row extends ImportRowReport> {
  committed: boolean
  total_rows: number
  inserted: number
  updated: number
  skipped: number
  rows: Row[]
}

function downloadReport<Row extends ImportRowReport>(
  rows: Row[],
  getRowLabel: (row: Row) => string,
  filename: string,
) {
  const escape = (value: string) => `"${value.replace(/"/g, '""')}"`
  const lines = [
    'line,label,action,errors',
    ...rows.map((row) =>
      [row.line, escape(getRowLabel(row)), row.action, escape(row.errors.join('; '))].join(
        ',',
      ),
    ),
  ]
  const blob = new Blob([lines.join('\n')], { type: 'text/csv' })
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = filename
  anchor.click()
  URL.revokeObjectURL(url)
}

/** Generic dry-run/apply CSV importer -- upload a file, preview what would
 * happen, then commit. Mirrors the ticket importer's flow so every entity
 * that accepts periodic bulk loads (e.g. from an external export) gets the
 * same safety net without re-implementing it. */
export function ImportCsvDialog<Row extends ImportRowReport>({
  title,
  invalidateKey,
  importFn,
  getRowLabel,
  reportFilename,
  onClose,
}: {
  title: string
  invalidateKey: readonly unknown[]
  importFn: (file: File, commit: boolean) => Promise<ImportReport<Row>>
  getRowLabel: (row: Row) => string
  reportFilename: string
  onClose: () => void
}) {
  const queryClient = useQueryClient()
  const [file, setFile] = useState<File | null>(null)

  const preview = useMutation({
    mutationFn: (f: File) => importFn(f, false),
  })
  const apply = useMutation({
    mutationFn: (f: File) => importFn(f, true),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: invalidateKey }),
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
    <Modal onClose={onClose} labelledBy="import-csv-title">
      <div className="space-y-4 p-5">
        <h2 id="import-csv-title" className="text-lg font-semibold text-slate-900">
          {title}
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
            <p className="text-sm text-slate-700">
              <strong>{report.total_rows}</strong> rows ·{' '}
              <strong>{report.inserted}</strong>{' '}
              {report.committed ? 'inserted' : 'to insert'} ·{' '}
              <strong>{report.updated}</strong>{' '}
              {report.committed ? 'updated' : 'to update'} ·{' '}
              <strong>{report.skipped}</strong> skipped
            </p>
            {report.rows.length > 0 && (
              <div className="max-h-72 overflow-y-auto rounded-lg border border-slate-200">
                <table className="w-full text-left text-xs">
                  <thead className="sticky top-0 bg-slate-50 text-slate-500">
                    <tr>
                      <th className="px-2 py-1.5 font-semibold">Line</th>
                      <th className="px-2 py-1.5 font-semibold">Row</th>
                      <th className="px-2 py-1.5 font-semibold">Reason</th>
                    </tr>
                  </thead>
                  <tbody>
                    {report.rows.map((row) => (
                      <tr key={row.line} className="border-t border-slate-100">
                        <td className="px-2 py-1.5 tabular-nums">{row.line}</td>
                        <td className="px-2 py-1.5">{getRowLabel(row) || '—'}</td>
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
              className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm font-semibold text-slate-700 hover:bg-slate-50"
              onClick={() => downloadReport(report.rows, getRowLabel, reportFilename)}
            >
              Download report
            </button>
          )}
          <button
            type="button"
            className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
            onClick={onClose}
          >
            {apply.data ? 'Close' : 'Cancel'}
          </button>
          {file && preview.data && !apply.data && (
            <button
              type="button"
              className="rounded-lg bg-brand px-3 py-1.5 text-sm font-semibold text-white transition hover:bg-brandHover disabled:cursor-not-allowed disabled:opacity-50"
              disabled={
                busy || preview.data.inserted + preview.data.updated === 0
              }
              onClick={() => file && apply.mutate(file)}
            >
              Apply import
            </button>
          )}
        </div>
      </div>
    </Modal>
  )
}
