import { useMemo, useState } from 'react'

import { PageHeader } from '../../components/ui'
import { DICTIONARY } from './dictionary'
import type { DictionaryEntry } from './dictionary'
import { FieldCard } from './FieldCard'

const TOTAL_ENTRIES = DICTIONARY.reduce(
  (sum, category) => sum + category.entries.length,
  0,
)

function entryHaystack(entry: DictionaryEntry, categoryTitle: string): string {
  return [
    entry.name,
    entry.dashboardRef ?? '',
    entry.unit ?? '',
    entry.definition,
    entry.source,
    entry.calculation,
    entry.technical ?? '',
    categoryTitle,
  ]
    .join(' ')
    .toLowerCase()
}

export function DocumentationPage() {
  const [query, setQuery] = useState('')
  const [activeCategory, setActiveCategory] = useState<string>('all')
  const [expandAll, setExpandAll] = useState(false)

  const terms = useMemo(
    () => query.toLowerCase().split(/\s+/).filter(Boolean),
    [query],
  )

  const sections = useMemo(() => {
    return DICTIONARY.map((category) => {
      const entries = category.entries.filter((entry) => {
        if (activeCategory !== 'all' && activeCategory !== category.id)
          return false
        if (terms.length === 0) return true
        const haystack = entryHaystack(entry, category.title)
        return terms.every((term) => haystack.includes(term))
      })
      return { category, entries }
    }).filter((section) => section.entries.length > 0)
  }, [terms, activeCategory])

  const visibleCount = sections.reduce((sum, s) => sum + s.entries.length, 0)
  const isFiltered = terms.length > 0 || activeCategory !== 'all'

  return (
    <div className="space-y-8">
      <PageHeader
        title="Data Dictionary & Methodology"
        subtitle="The official reference for every metric and cost component in the portal — what each one means, where its numbers come from, and how it is worked out. Toggle a field's technical detail for the exact formula."
      />

      <div className="sticky top-0 z-10 -mx-6 border-b border-slate-200 bg-[var(--ah-canvas)] px-6 py-4">
        <div className="flex flex-col gap-3">
          <div className="flex flex-wrap items-center gap-3">
            <input
              type="search"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search fields, definitions, formulas, dashboards…"
              aria-label="Search the data dictionary"
              className="min-w-64 flex-1 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-ink outline-none transition placeholder:text-slate-400 focus:border-accent"
            />
            <label className="flex select-none items-center gap-2 text-sm font-semibold text-slate-600">
              <input
                type="checkbox"
                checked={expandAll}
                onChange={(event) => setExpandAll(event.target.checked)}
                className="h-4 w-4 accent-[var(--ah-indigo)]"
              />
              Expand all technical detail
            </label>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <FilterChip
              label="All"
              active={activeCategory === 'all'}
              onClick={() => setActiveCategory('all')}
            />
            {DICTIONARY.map((category) => (
              <FilterChip
                key={category.id}
                label={category.title}
                active={activeCategory === category.id}
                onClick={() => setActiveCategory(category.id)}
              />
            ))}
          </div>

          <p className="text-xs text-slate-500">
            {isFiltered
              ? `${visibleCount} of ${TOTAL_ENTRIES} fields`
              : `${TOTAL_ENTRIES} fields across ${DICTIONARY.length} categories`}
          </p>
        </div>
      </div>

      <div className="lg:grid lg:grid-cols-[200px_minmax(0,1fr)] lg:gap-10">
        <nav
          aria-label="Categories"
          className="mb-6 hidden lg:sticky lg:top-40 lg:mb-0 lg:block lg:self-start"
        >
          <ul className="space-y-1 text-sm">
            {sections.map(({ category }) => (
              <li key={category.id}>
                <a
                  href={`#${category.id}`}
                  className="block rounded-md px-2 py-1 text-slate-600 transition hover:bg-slate-100 hover:text-accent"
                >
                  {category.title}
                </a>
              </li>
            ))}
          </ul>
        </nav>

        <div className="space-y-12">
          {sections.length === 0 ? (
            <div className="rounded-xl border border-dashed border-slate-300 bg-white p-10 text-center">
              <p className="text-sm text-slate-500">
                No fields match “{query}”.
              </p>
            </div>
          ) : (
            sections.map(({ category, entries }) => (
              <section
                key={category.id}
                id={category.id}
                aria-label={category.title}
                className="scroll-mt-44"
              >
                <h2 className="text-xl font-bold tracking-tight text-ink">
                  {category.title}
                </h2>
                <p className="mt-1 max-w-3xl text-sm leading-relaxed text-slate-600">
                  {category.blurb}
                </p>
                <div className="mt-5 grid gap-5 xl:grid-cols-2">
                  {entries.map((entry) => (
                    <FieldCard
                      key={entry.id}
                      entry={entry}
                      forceOpen={expandAll}
                      highlight={query}
                    />
                  ))}
                </div>
              </section>
            ))
          )}
        </div>
      </div>
    </div>
  )
}

function FilterChip({
  label,
  active,
  onClick,
}: {
  label: string
  active: boolean
  onClick: () => void
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={`rounded-full px-3 py-1 text-xs font-semibold transition ${
        active
          ? 'bg-brand text-white'
          : 'bg-white text-slate-600 ring-1 ring-slate-200 hover:bg-slate-100'
      }`}
    >
      {label}
    </button>
  )
}
