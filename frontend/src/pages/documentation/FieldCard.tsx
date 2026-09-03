import { useEffect, useId, useState } from 'react'

import type { DictionaryEntry } from './dictionary'

interface FieldCardProps {
  entry: DictionaryEntry
  /** When true, the technical-detail panel is forced open by the page toggle. */
  forceOpen: boolean
  /** Substrings to highlight in the name / definition (the active search terms). */
  highlight: string
}

function Highlighted({ text, term }: { text: string; term: string }) {
  const needle = term.trim()
  if (!needle) return <>{text}</>
  const parts = text.split(new RegExp(`(${escapeRegExp(needle)})`, 'ig'))
  return (
    <>
      {parts.map((part, i) =>
        part.toLowerCase() === needle.toLowerCase() ? (
          <mark
            key={i}
            className="rounded bg-[var(--ah-warning-bg)] px-0.5 text-ink"
          >
            {part}
          </mark>
        ) : (
          <span key={i}>{part}</span>
        ),
      )}
    </>
  )
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

export function FieldCard({ entry, forceOpen, highlight }: FieldCardProps) {
  const [open, setOpen] = useState(false)
  const panelId = useId()

  useEffect(() => {
    setOpen(forceOpen)
  }, [forceOpen])

  return (
    <article className="rounded-xl border border-slate-200 bg-white p-5 shadow-card">
      <div className="flex flex-wrap items-start justify-between gap-x-4 gap-y-2">
        <h3 className="text-base font-bold tracking-tight text-ink">
          <Highlighted text={entry.name} term={highlight} />
        </h3>
        {entry.unit && (
          <span className="shrink-0 rounded-md bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-600">
            {entry.unit}
          </span>
        )}
      </div>

      {entry.dashboardRef && (
        <p className="mt-1 text-xs font-semibold uppercase tracking-[0.08em] text-accent">
          {entry.dashboardRef}
        </p>
      )}

      <p className="mt-3 text-sm leading-relaxed text-ink">
        <Highlighted text={entry.definition} term={highlight} />
      </p>

      <dl className="mt-4 grid gap-4 sm:grid-cols-2">
        <div>
          <dt className="text-[11px] font-semibold uppercase tracking-[0.08em] text-slate-500">
            Data source
          </dt>
          <dd className="mt-1 text-sm leading-relaxed text-slate-700">
            {entry.source}
          </dd>
        </div>
        <div>
          <dt className="text-[11px] font-semibold uppercase tracking-[0.08em] text-slate-500">
            How it is calculated
          </dt>
          <dd className="mt-1 text-sm leading-relaxed text-slate-700">
            {entry.calculation}
          </dd>
        </div>
      </dl>

      {entry.technical && (
        <div className="mt-4 border-t border-slate-100 pt-3">
          <button
            type="button"
            aria-expanded={open}
            aria-controls={panelId}
            onClick={() => setOpen((v) => !v)}
            className="flex items-center gap-1.5 text-xs font-semibold text-accent transition hover:text-accentHover"
          >
            <span aria-hidden className="inline-block w-3 text-center">
              {open ? '−' : '+'}
            </span>
            Technical detail
          </button>
          {open && (
            <p
              id={panelId}
              className="mt-2 whitespace-pre-wrap rounded-lg bg-slate-50 p-3 font-mono text-xs leading-relaxed text-slate-700"
            >
              {entry.technical}
            </p>
          )}
        </div>
      )}
    </article>
  )
}
