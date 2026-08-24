import { NumberField, SelectField } from './fields'
import type { StepProps } from './types'

const TASK_FREQUENCY_OPTIONS = [
  'Daily',
  'Weekly',
  'Monthly',
  'Quarterly',
  'Yearly',
]

export function Step4Volumetry({ value, onChange }: StepProps) {
  return (
    <div className="space-y-4">
      <h2 className="text-xl font-semibold text-ink">
        Volumetry & Human Effort
      </h2>
      <SelectField
        label="Task frequency"
        value={value.taskFrequency}
        onChange={(taskFrequency) => onChange({ taskFrequency })}
        options={TASK_FREQUENCY_OPTIONS}
      />
      <NumberField
        label="Transaction volume per cycle"
        value={value.transactionVolume}
        onChange={(transactionVolume) => onChange({ transactionVolume })}
      />
      <NumberField
        label="Headcount in FTEs"
        value={value.headcountFte}
        onChange={(headcountFte) => onChange({ headcountFte })}
      />
      <NumberField
        label="Avg. time per task (minutes)"
        value={value.avgTimePerTaskMinutes}
        onChange={(avgTimePerTaskMinutes) =>
          onChange({ avgTimePerTaskMinutes })
        }
      />
      <NumberField
        label="Error rate (%)"
        value={value.errorRatePct}
        onChange={(errorRatePct) => onChange({ errorRatePct })}
      />
      <NumberField
        label="Avg. rework time (minutes)"
        value={value.avgReworkTimeMinutes}
        onChange={(avgReworkTimeMinutes) => onChange({ avgReworkTimeMinutes })}
      />
      <NumberField
        label="Audit rate (%)"
        value={value.auditRatePct}
        onChange={(auditRatePct) => onChange({ auditRatePct })}
      />
      <NumberField
        label="Avg. loaded FTE cost per year (EUR)"
        value={value.avgLoadedFteCostEur}
        onChange={(avgLoadedFteCostEur) => onChange({ avgLoadedFteCostEur })}
      />
    </div>
  )
}
