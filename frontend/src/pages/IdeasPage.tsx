import { useEffect, useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Link } from 'react-router-dom'

import { fetchIdeas, type Idea } from '../api/ideas'
import { formatValue } from '../api/metrics'
import { AsyncSection } from '../components/AsyncSection'
import { IdeaClassificationDonut } from '../components/IdeaClassificationDonut'
import { IdeaFeasibilityMatrix } from '../components/IdeaFeasibilityMatrix'
import { Card, PageHeader } from '../components/ui'

const CLASSIFICATION_STYLES: Record<string, string> = {
  'Quick Win': 'bg-positive/10 text-positive',
  'Strategic Investment': 'bg-brand/10 text-brand',
  'Low-Hanging Fruit': 'bg-slate-100 text-slate-600',
  'Deprioritize / Avoid': 'bg-slate-200 text-slate-700',
}

const FEASIBILITY_STYLES: Record<string, string> = {
  High: 'text-positive',
  Medium: 'text-slate-500',
  Low: 'text-negative',
}

const PAGE_SIZE = 9

function matchesSearch(idea: Idea, term: string): boolean {
  return [
    idea.title,
    idea.submitter_name,
    idea.l1_name,
    idea.l2_name,
    idea.l3_name,
  ]
    .join(' ')
    .toLowerCase()
    .includes(term)
}

export function IdeasPage() {
  const ideas = useQuery({ queryKey: ['ideas'], queryFn: fetchIdeas })

  const [search, setSearch] = useState('')
  const [page, setPage] = useState(1)

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase()
    const data = ideas.data ?? []
    if (term === '') return data
    return data.filter((idea) => matchesSearch(idea, term))
  }, [ideas.data, search])

  const pageCount = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE))
  const currentPage = Math.min(page, pageCount)
  const pageItems = filtered.slice(
    (currentPage - 1) * PAGE_SIZE,
    currentPage * PAGE_SIZE,
  )

  useEffect(() => {
    setPage(1)
  }, [search])

  return (
    <div className="space-y-8">
      <PageHeader
        title="Idea Pipeline"
        subtitle="Automation candidates submitted through the assessment wizard."
        action={
          <Link
            to="/ideas/new"
            className="inline-flex rounded-lg bg-brand px-4 py-2 font-semibold text-white transition hover:bg-brandHover"
          >
            Submit new idea
          </Link>
        }
      />

      <AsyncSection
        isPending={ideas.isPending}
        isError={ideas.isError}
        error={ideas.error}
        loadingLabel="Loading ideas…"
      >
        {ideas.data?.length === 0 && (
          <div className="rounded-xl border border-dashed border-slate-300 bg-white p-10 text-center">
            <h2 className="font-semibold">No ideas yet</h2>
            <p className="mt-1 text-sm text-slate-500">
              Use "Submit new idea" to add the first automation candidate.
            </p>
          </div>
        )}
        {ideas.data && ideas.data.length > 0 && (
          <div className="space-y-8">
            <div
              className="grid gap-4 lg:grid-cols-2"
              aria-label="Idea pipeline charts"
            >
              <Card kicker="Distribution" title="Pipeline by classification">
                <IdeaClassificationDonut ideas={ideas.data} />
              </Card>
              <Card kicker="Prioritisation" title="Feasibility matrix">
                <IdeaFeasibilityMatrix ideas={ideas.data} />
              </Card>
            </div>

            <div className="space-y-4">
              <input
                type="search"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Search ideas by name, submitter, or process…"
                aria-label="Search ideas"
                className="w-full max-w-md rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/30"
              />

              {pageItems.length === 0 ? (
                <div className="rounded-xl border border-dashed border-slate-300 bg-white p-10 text-center">
                  <h2 className="font-semibold">No ideas match your search</h2>
                  <p className="mt-1 text-sm text-slate-500">
                    Try a different name, submitter, or process.
                  </p>
                </div>
              ) : (
                <ul
                  className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3"
                  aria-label="Ideas list"
                >
                  {pageItems.map((idea) => (
                    <li key={idea.id}>
                      <Link
                        to={`/ideas/${idea.id}`}
                        className="flex h-full flex-col gap-2 rounded-xl border border-slate-200 bg-white p-5 shadow-card transition hover:border-accent hover:shadow-pop"
                      >
                        <span
                          className={`inline-flex w-fit rounded-full px-2.5 py-0.5 text-xs font-semibold ${
                            CLASSIFICATION_STYLES[idea.final_classification] ??
                            'bg-slate-100 text-slate-600'
                          }`}
                        >
                          {idea.final_classification}
                        </span>
                        <h3 className="font-semibold text-ink">{idea.title}</h3>
                        <p className="text-sm text-slate-600">
                          {idea.l1_name} → {idea.l2_name} → {idea.l3_name}
                        </p>
                        <p className="text-sm text-slate-500">
                          Submitted by {idea.submitter_name}
                        </p>
                        <div className="mt-auto flex items-center justify-between pt-2 text-sm">
                          <span className="font-semibold text-ink">
                            {formatValue(Number(idea.gross_roi_eur), 'eur')}
                          </span>
                          <span
                            className={`font-medium ${FEASIBILITY_STYLES[idea.feasibility_band] ?? 'text-slate-600'}`}
                          >
                            {idea.feasibility_band} feasibility
                          </span>
                        </div>
                        <div className="flex items-center justify-between text-xs text-slate-400">
                          <span>{idea.status}</span>
                          <span>
                            {new Date(idea.created_at).toLocaleDateString()}
                          </span>
                        </div>
                      </Link>
                    </li>
                  ))}
                </ul>
              )}

              {filtered.length > 0 && (
                <div className="flex flex-wrap items-center justify-between gap-3 text-sm text-slate-500">
                  <span>
                    {filtered.length} {filtered.length === 1 ? 'idea' : 'ideas'}
                  </span>
                  {pageCount > 1 && (
                    <div className="flex items-center gap-3">
                      <button
                        type="button"
                        onClick={() =>
                          setPage((value) => Math.max(1, value - 1))
                        }
                        disabled={currentPage === 1}
                        className="rounded-lg border border-slate-300 px-3 py-1.5 font-medium text-slate-600 transition hover:border-accent hover:text-accent disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:border-slate-300 disabled:hover:text-slate-600"
                      >
                        Prev
                      </button>
                      <span>
                        Page {currentPage} of {pageCount}
                      </span>
                      <button
                        type="button"
                        onClick={() =>
                          setPage((value) => Math.min(pageCount, value + 1))
                        }
                        disabled={currentPage === pageCount}
                        className="rounded-lg border border-slate-300 px-3 py-1.5 font-medium text-slate-600 transition hover:border-accent hover:text-accent disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:border-slate-300 disabled:hover:text-slate-600"
                      >
                        Next
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        )}
      </AsyncSection>
    </div>
  )
}
