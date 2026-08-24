import { useQuery } from '@tanstack/react-query'
import { Link, useParams } from 'react-router-dom'

import { fetchIdea } from '../api/ideas'
import { formatValue } from '../api/metrics'
import { AsyncSection } from '../components/AsyncSection'

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-4 border-b border-slate-100 py-2 text-sm last:border-0">
      <span className="text-slate-500">{label}</span>
      <span className="text-right font-medium text-ink">{value}</span>
    </div>
  )
}

export function IdeaDetailPage() {
  const { id } = useParams<{ id: string }>()
  const ideaId = Number(id)
  const idea = useQuery({
    queryKey: ['idea', ideaId],
    queryFn: () => fetchIdea(ideaId),
    enabled: Number.isFinite(ideaId),
  })

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <Link
        to="/ideas"
        className="text-sm font-semibold text-brand hover:underline"
      >
        ← Back to Idea Pipeline
      </Link>

      <AsyncSection
        isPending={idea.isPending}
        isError={idea.isError}
        error={idea.error}
        loadingLabel="Loading idea…"
      >
        {idea.data && (
          <div className="space-y-6">
            <div>
              <h1 className="text-3xl font-bold tracking-tight">
                {idea.data.title}
              </h1>
              <p className="mt-2 text-slate-600">
                {idea.data.l1_name} → {idea.data.l2_name} → {idea.data.l3_name}
              </p>
            </div>

            <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
              <h2 className="mb-2 font-semibold text-ink">Scoring</h2>
              <Row
                label="Gross ROI / year"
                value={formatValue(Number(idea.data.gross_roi_eur), 'eur')}
              />
              <Row
                label="Feasibility"
                value={`${idea.data.feasibility_band} (${idea.data.feasibility_score})`}
              />
              <Row
                label="Technology category"
                value={idea.data.technology_category}
              />
              <Row
                label="Final classification"
                value={idea.data.final_classification}
              />
              <Row label="Status" value={idea.data.status} />
            </section>

            <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
              <h2 className="mb-2 font-semibold text-ink">Submission</h2>
              <Row label="Submitter" value={idea.data.submitter_name} />
              <Row
                label="Submitted"
                value={new Date(idea.data.created_at).toLocaleString()}
              />
              <Row label="Primary goal" value={idea.data.primary_goal} />
              <Row
                label="Process stability"
                value={idea.data.process_stability}
              />
              <Row
                label="System stability"
                value={idea.data.system_stability}
              />
            </section>

            <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
              <h2 className="mb-2 font-semibold text-ink">
                Volumetry & Human Effort
              </h2>
              <Row label="Task frequency" value={idea.data.task_frequency} />
              <Row
                label="Transaction volume"
                value={idea.data.transaction_volume}
              />
              <Row label="Headcount (FTEs)" value={idea.data.headcount_fte} />
              <Row
                label="Avg. time per task (min)"
                value={idea.data.avg_time_per_task_minutes}
              />
              <Row label="Error rate (%)" value={idea.data.error_rate_pct} />
              <Row
                label="Avg. rework time (min)"
                value={idea.data.avg_rework_time_minutes}
              />
              <Row label="Audit rate (%)" value={idea.data.audit_rate_pct} />
              <Row
                label="Avg. loaded FTE cost (EUR)"
                value={idea.data.avg_loaded_fte_cost_eur}
              />
              <Row
                label="Annual transactions"
                value={idea.data.annual_transactions}
              />
              <Row label="Base hours / year" value={idea.data.base_hours} />
              <Row label="Rework hours / year" value={idea.data.rework_hours} />
              <Row
                label="Total hours saved / year"
                value={idea.data.total_hours_saved}
              />
            </section>

            <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
              <h2 className="mb-2 font-semibold text-ink">
                Complexity & Standardisation
              </h2>
              <Row label="Number of steps" value={idea.data.number_of_steps} />
              <Row label="Decision logic" value={idea.data.decision_logic} />
              <Row
                label="Process variations"
                value={idea.data.process_variations}
              />
            </section>

            <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
              <h2 className="mb-2 font-semibold text-ink">
                Systems & Environment
              </h2>
              <Row
                label="Primary input format"
                value={idea.data.primary_input_format}
              />
              <Row
                label="Number of systems"
                value={idea.data.number_of_systems}
              />
              <Row
                label="System interface"
                value={idea.data.system_interface}
              />
            </section>

            <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
              <h2 className="mb-2 font-semibold text-ink">AI Assessment</h2>
              <Row
                label="Unstructured data"
                value={idea.data.unstructured_data}
              />
              <Row
                label="Cognitive reasoning"
                value={idea.data.cognitive_reasoning}
              />
              <Row
                label="Computer vision / OCR"
                value={idea.data.computer_vision}
              />
              <Row
                label="AI output risk tolerance"
                value={idea.data.ai_output_risk}
              />
            </section>
          </div>
        )}
      </AsyncSection>
    </div>
  )
}
