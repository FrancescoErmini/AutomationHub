import { useQuery } from '@tanstack/react-query'

import {
  fetchApqcCategories,
  fetchApqcProcessGroups,
  fetchApqcProcesses,
} from '../../api/apqc'
import { formatValue } from '../../api/metrics'
import {
  DEFAULT_ROI_THRESHOLD_EUR,
  computeFeasibility,
  computeFinalClassification,
  computeRoi,
  computeTechnologyCategory,
} from '../../lib/ideaScoring'
import type { StepProps } from './types'

function SummaryRow({ label, answer }: { label: string; answer: string }) {
  return (
    <div className="flex justify-between gap-4 border-b border-slate-100 py-1.5 text-sm last:border-0">
      <span className="text-slate-500">{label}</span>
      <span className="text-right font-medium text-ink">{answer || '—'}</span>
    </div>
  )
}

export function Step8Review({ value }: StepProps) {
  const categories = useQuery({
    queryKey: ['apqc', 'categories'],
    queryFn: fetchApqcCategories,
  })
  const processGroups = useQuery({
    queryKey: ['apqc', 'process-groups', value.categoryId],
    queryFn: () => fetchApqcProcessGroups(value.categoryId as number),
    enabled: value.categoryId !== undefined,
  })
  const processes = useQuery({
    queryKey: ['apqc', 'processes', value.processGroupId],
    queryFn: () => fetchApqcProcesses(value.processGroupId as number),
    enabled: value.processGroupId !== undefined,
  })

  const l1Name = categories.data?.find((c) => c.id === value.categoryId)?.name
  const l2Name = processGroups.data?.find(
    (g) => g.id === value.processGroupId,
  )?.name
  const l3Name = processes.data?.find((p) => p.id === value.processId)?.name

  const roi = computeRoi({
    taskFrequency: value.taskFrequency,
    transactionVolume: Number(value.transactionVolume),
    avgTimePerTaskMinutes: Number(value.avgTimePerTaskMinutes),
    errorRatePct: Number(value.errorRatePct),
    avgReworkTimeMinutes: Number(value.avgReworkTimeMinutes),
    avgLoadedFteCostEur: Number(value.avgLoadedFteCostEur),
  })
  const feasibility = computeFeasibility({
    processStability: value.processStability,
    systemStability: value.systemStability,
    decisionLogic: value.decisionLogic,
    processVariations: value.processVariations,
    systemInterface: value.systemInterface,
    primaryInputFormat: value.primaryInputFormat,
  })
  const technologyCategory = computeTechnologyCategory(
    value.unstructuredData,
    value.cognitiveReasoning,
  )
  const finalClassification = computeFinalClassification(
    feasibility.band,
    roi.grossRoiEur,
    DEFAULT_ROI_THRESHOLD_EUR,
  )

  return (
    <div className="space-y-6">
      <h2 className="text-xl font-semibold text-ink">Review & Submit</h2>

      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <h3 className="mb-2 font-semibold text-ink">Summary</h3>
        <SummaryRow label="Title" answer={value.title} />
        <SummaryRow label="Submitter" answer={value.submitterName} />
        <SummaryRow
          label="Process"
          answer={[l1Name, l2Name, l3Name].filter(Boolean).join(' → ')}
        />
        <SummaryRow label="Primary goal" answer={value.primaryGoal} />
        <SummaryRow label="Process stability" answer={value.processStability} />
        <SummaryRow label="System stability" answer={value.systemStability} />
        <SummaryRow label="Task frequency" answer={value.taskFrequency} />
        <SummaryRow
          label="Transaction volume"
          answer={value.transactionVolume}
        />
        <SummaryRow label="Headcount (FTEs)" answer={value.headcountFte} />
        <SummaryRow
          label="Avg. time per task (min)"
          answer={value.avgTimePerTaskMinutes}
        />
        <SummaryRow label="Error rate (%)" answer={value.errorRatePct} />
        <SummaryRow
          label="Avg. rework time (min)"
          answer={value.avgReworkTimeMinutes}
        />
        <SummaryRow label="Audit rate (%)" answer={value.auditRatePct} />
        <SummaryRow
          label="Avg. loaded FTE cost (EUR)"
          answer={value.avgLoadedFteCostEur}
        />
        <SummaryRow label="Number of steps" answer={value.numberOfSteps} />
        <SummaryRow label="Decision logic" answer={value.decisionLogic} />
        <SummaryRow
          label="Process variations"
          answer={value.processVariations}
        />
        <SummaryRow
          label="Primary input format"
          answer={value.primaryInputFormat}
        />
        <SummaryRow label="Number of systems" answer={value.numberOfSystems} />
        <SummaryRow label="System interface" answer={value.systemInterface} />
        <SummaryRow label="Unstructured data" answer={value.unstructuredData} />
        <SummaryRow
          label="Cognitive reasoning"
          answer={value.cognitiveReasoning}
        />
        <SummaryRow
          label="Computer vision / OCR"
          answer={value.computerVision}
        />
        <SummaryRow
          label="AI output risk tolerance"
          answer={value.aiOutputRisk}
        />
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <h3 className="mb-2 font-semibold text-ink">Live score preview</h3>
        <p className="mb-3 text-xs text-slate-500">
          Estimated client-side. The authoritative scores are computed on the
          server when you submit.
        </p>
        <SummaryRow
          label="Gross ROI / year"
          answer={formatValue(roi.grossRoiEur, 'eur')}
        />
        <SummaryRow
          label="Feasibility"
          answer={`${feasibility.band} (${feasibility.score})`}
        />
        <SummaryRow label="Technology category" answer={technologyCategory} />
        <SummaryRow label="Final classification" answer={finalClassification} />
      </section>
    </div>
  )
}
