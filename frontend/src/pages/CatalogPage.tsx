import { useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'

import { fetchProcessCatalog } from '../api/processCatalog'
import { AsyncSection } from '../components/AsyncSection'
import { ProcessCatalogCard } from '../components/ProcessCatalogCard'
import { SelectFilter } from '../components/SelectFilter'
import { PageHeader } from '../components/ui'

type View = 'live' | 'pipeline'

const toggleClass = (active: boolean) =>
  `rounded-lg px-3 py-1.5 text-sm font-semibold transition ${
    active ? 'bg-brand text-white' : 'text-slate-600 hover:bg-slate-100'
  }`

function uniqueSorted(values: (string | null)[]): string[] {
  return [
    ...new Set(values.filter((value): value is string => Boolean(value))),
  ].sort()
}

export function CatalogPage() {
  const [view, setView] = useState<View>('live')
  const [company, setCompany] = useState('')
  const [department, setDepartment] = useState('')
  const [application, setApplication] = useState('')
  const catalog = useQuery({
    queryKey: ['process-catalog'],
    queryFn: fetchProcessCatalog,
  })

  const companyOptions = useMemo(
    () => uniqueSorted((catalog.data ?? []).map((item) => item.company)),
    [catalog.data],
  )
  const departmentOptions = useMemo(
    () => uniqueSorted((catalog.data ?? []).map((item) => item.department)),
    [catalog.data],
  )
  const applicationOptions = useMemo(
    () =>
      uniqueSorted((catalog.data ?? []).flatMap((item) => item.applications)),
    [catalog.data],
  )

  const items = (catalog.data ?? []).filter((item) => {
    if (view === 'live' ? !item.is_live : item.is_live) return false
    if (company && item.company !== company) return false
    if (department && item.department !== department) return false
    if (application && !item.applications.includes(application)) return false
    return true
  })
  const emptyLabel =
    view === 'live'
      ? 'No live automations yet.'
      : 'Nothing in the pipeline yet.'

  return (
    <div className="space-y-8">
      <PageHeader
        title="Menarini Process Automation"
        subtitle="Every automated process running today, and every process still in the pipeline — organized by department in one place."
      />

      <AsyncSection
        isPending={catalog.isPending}
        isError={catalog.isError}
        error={catalog.error}
        loadingLabel="Loading automation catalog…"
      >
        <div className="flex flex-wrap items-center gap-4">
          <SelectFilter
            label="Company"
            placeholder="All companies"
            options={companyOptions}
            value={company}
            onChange={setCompany}
          />
          <SelectFilter
            label="Department"
            placeholder="All departments"
            options={departmentOptions}
            value={department}
            onChange={setDepartment}
          />
          <SelectFilter
            label="Application"
            placeholder="All applications"
            options={applicationOptions}
            value={application}
            onChange={setApplication}
          />
        </div>

        <div className="mt-4 flex flex-wrap items-center gap-3">
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
