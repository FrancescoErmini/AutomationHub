import { useEffect, useState } from 'react'

import type { ProcessCatalogItem } from '../api/processCatalog'

interface ProcessCatalogCardProps {
  item: ProcessCatalogItem
}

function formatGoLiveDate(goLiveDate: string | null): string {
  if (!goLiveDate) return 'Not live yet'
  return new Date(goLiveDate).toLocaleDateString('en-IE', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  })
}

export function ProcessCatalogCard({ item }: ProcessCatalogCardProps) {
  const [isOpen, setIsOpen] = useState(false)
  const tagClass = item.is_live
    ? 'bg-positive/10 text-positive'
    : 'bg-amber-100 text-amber-800'

  useEffect(() => {
    if (!isOpen) return
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setIsOpen(false)
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [isOpen])

  return (
    <>
      <article className="flex flex-col gap-2 rounded-xl border border-slate-200 bg-white p-5">
        <span
          className={`inline-flex w-fit rounded-full px-2.5 py-0.5 text-xs font-semibold ${tagClass}`}
        >
          {item.department}
        </span>
        <h3 className="font-semibold text-ink">{item.title}</h3>
        <p className="line-clamp-3 text-sm text-slate-600">
          {item.description || 'No description provided.'}
        </p>
        {item.applications.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {item.applications.map((application) => (
              <span
                key={application}
                className="inline-flex w-fit rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-600"
              >
                {application}
              </span>
            ))}
          </div>
        )}
        <p className="text-xs text-slate-500">{formatGoLiveDate(item.go_live_date)}</p>
        <button
          type="button"
          onClick={() => setIsOpen(true)}
          className="mt-1 self-start text-sm font-semibold text-brand hover:underline"
        >
          View details
        </button>
      </article>

      {isOpen && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label={`${item.title} details`}
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
          onClick={() => setIsOpen(false)}
        >
          <div
            className="w-full max-w-md rounded-xl bg-white p-6 shadow-xl"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-4">
              <h3 className="text-lg font-semibold text-ink">{item.title}</h3>
              <button
                type="button"
                onClick={() => setIsOpen(false)}
                aria-label="Close"
                className="text-slate-400 hover:text-slate-600"
              >
                ✕
              </button>
            </div>

            <div className="mt-4 space-y-3 text-sm">
              <div className="flex flex-wrap gap-1.5">
                <span
                  className={`inline-flex w-fit rounded-full px-2.5 py-0.5 text-xs font-semibold ${tagClass}`}
                >
                  {item.department}
                </span>
                <span className="inline-flex w-fit rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-semibold text-slate-600">
                  {item.is_live ? 'Live' : 'In pipeline'}
                </span>
              </div>

              <p className="text-slate-600">{item.description || 'No description provided.'}</p>

              <dl className="grid grid-cols-2 gap-x-4 gap-y-2">
                <dt className="text-slate-500">Company</dt>
                <dd className="text-right font-medium text-ink">{item.company ?? 'Not specified'}</dd>
                <dt className="text-slate-500">Go-live date</dt>
                <dd className="text-right font-medium text-ink">
                  {formatGoLiveDate(item.go_live_date)}
                </dd>
                <dt className="text-slate-500">Status</dt>
                <dd className="text-right font-medium text-ink">{item.status ?? 'Not specified'}</dd>
              </dl>

              {item.applications.length > 0 && (
                <div>
                  <p className="mb-1.5 text-slate-500">Applications used</p>
                  <div className="flex flex-wrap gap-1.5">
                    {item.applications.map((application) => (
                      <span
                        key={application}
                        className="inline-flex w-fit rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-600"
                      >
                        {application}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  )
}
