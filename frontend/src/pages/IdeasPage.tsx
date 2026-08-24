import { useQuery } from '@tanstack/react-query'
import { Link } from 'react-router-dom'

import { fetchIdeas } from '../api/ideas'
import { formatValue } from '../api/metrics'
import { AsyncSection } from '../components/AsyncSection'

const CLASSIFICATION_STYLES: Record<string, string> = {
  'Quick Win': 'bg-emerald-100 text-emerald-800',
  'Strategic Investment': 'bg-blue-100 text-brand',
  'Low-Hanging Fruit': 'bg-amber-100 text-amber-800',
  'Deprioritize / Avoid': 'bg-slate-200 text-slate-600',
}

const FEASIBILITY_STYLES: Record<string, string> = {
  High: 'text-emerald-700',
  Medium: 'text-amber-700',
  Low: 'text-red-700',
}

export function IdeasPage() {
  const ideas = useQuery({ queryKey: ['ideas'], queryFn: fetchIdeas })

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Idea Pipeline</h1>
          <p className="mt-2 text-slate-600">
            Automation candidates submitted through the assessment wizard.
          </p>
        </div>
        <Link
          to="/ideas/new"
          className="rounded-lg bg-brand px-4 py-2 font-semibold text-white hover:bg-blue-700"
        >
          Submit new idea
        </Link>
      </div>

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
          <ul
            className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3"
            aria-label="Ideas list"
          >
            {ideas.data.map((idea) => (
              <li key={idea.id}>
                <Link
                  to={`/ideas/${idea.id}`}
                  className="flex h-full flex-col gap-2 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm hover:border-brand"
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
      </AsyncSection>
    </div>
  )
}
