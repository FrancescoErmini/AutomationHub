import { SelectField } from './fields'
import type { StepProps } from './types'

const PRIMARY_GOAL_OPTIONS = [
  'Cost Reduction',
  'Speed/SLA',
  'Error Reduction',
  'Compliance',
  'Employee Satisfaction',
]
const PROCESS_STABILITY_OPTIONS = [
  'No Change',
  'Minor Tweak',
  'Moderate Change',
  'Major Overhaul Planned',
]
const SYSTEM_STABILITY_OPTIONS = [
  'No Change',
  'Minor Patch',
  'Platform Migration Planned',
]

export function Step3ProcessOverview({ value, onChange }: StepProps) {
  return (
    <div className="space-y-4">
      <h2 className="text-xl font-bold tracking-tight text-ink">
        Process Overview & Business Goals
      </h2>
      <SelectField
        label="Primary goal"
        value={value.primaryGoal}
        onChange={(primaryGoal) => onChange({ primaryGoal })}
        options={PRIMARY_GOAL_OPTIONS}
      />
      <SelectField
        label="Process stability (next 6 months)"
        value={value.processStability}
        onChange={(processStability) => onChange({ processStability })}
        options={PROCESS_STABILITY_OPTIONS}
      />
      <SelectField
        label="System stability (next 6 months)"
        value={value.systemStability}
        onChange={(systemStability) => onChange({ systemStability })}
        options={SYSTEM_STABILITY_OPTIONS}
      />
    </div>
  )
}
