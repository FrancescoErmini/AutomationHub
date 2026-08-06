import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'

import { fetchProcessCatalog } from '../api/processCatalog'
import { AsyncSection } from '../components/AsyncSection'
import { ProcessCatalogCard } from '../components/ProcessCatalogCard'

type View = 'live' | 'pipeline'

const toggleClass = (active: boolean) =>
  `rounded-lg px-3 py-1.5 text-sm font-semibold transition ${
    active ? 'bg-brand text-white' : 'text-slate-600 hover:bg-slate-100'
  }`

export function CatalogPage() {
  const [view, setView] = useState<View>('live')
  const catalog = useQuery({
    queryKey: ['process-catalog'],
    queryFn: fetchProcessCatalog,
  })

  const items = (catalog.data ?? []).filter((item) =>
    view === 'live' ? item.is_live : !item.is_live,
  )
  const emptyLabel =
    view === 'live'
      ? 'No live automations yet.'
      : 'Nothing in the pipeline yet.'

  return (
    <div className="space-y-8">
      <header>
        <h1 className="text-3xl font-bold tracking-tight text-ink">
          Menarini Process Automation
        </h1>
        <p className="mt-2 max-w-2xl text-slate-600">
          Every automated process running today, and every process still in the
          pipeline — organized by department in one place.
        </p>
      </header>

      <AsyncSection
        isPending={catalog.isPending}
        isError={catalog.isError}
        error={catalog.error}
        loadingLabel="Loading automation catalog…"
      >
        <div className="flex flex-wrap items-center gap-3">
          <div
            role="radiogroup"
            aria-label="View"
            className="inline-flex overflow-hidden rounded-lg border border-slate-200"
          >
            <button
              type="button"
              role="radio"
              aria-checked={view === 'live'}
              className={toggleClass(view === 'live')}
              onClick={() => setView('live')}
            >
              Live automations
            </button>
            <button
              type="button"
              role="radio"
              aria-checked={view === 'pipeline'}
              className={toggleClass(view === 'pipeline')}
              onClick={() => setView('pipeline')}
            >
              In the pipeline
            </button>
          </div>
          <span className="text-sm text-slate-500">
            {items.length} {view}{' '}
            {items.length === 1 ? 'initiative' : 'initiatives'}
          </span>
        </div>

        {items.length === 0 ? (
          <div className="mt-6 rounded-xl border border-dashed border-slate-300 bg-white p-10 text-center">
            <p className="text-sm text-slate-500">{emptyLabel}</p>
          </div>
        ) : (
          <section
            aria-label="Automation catalog"
            className="mt-6 grid gap-6 sm:grid-cols-2 lg:grid-cols-3"
          >
            {items.map((item) => (
              <ProcessCatalogCard
                key={`${item.department}-${item.title}`}
                item={item}
              />
            ))}
          </section>
        )}
      </AsyncSection>
    </div>
  )
}
