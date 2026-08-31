import { SelectField } from './fields'
import type { StepProps } from './types'

const NUMBER_OF_STEPS_OPTIONS = ['1-5', '6-15', '16-30', '31+']
const DECISION_LOGIC_OPTIONS = [
  '100% Rule-Based',
  'Mostly Rules, Few Exceptions',
  'Requires Subjective Judgment',
]
const PROCESS_VARIATIONS_OPTIONS = [
  '1 Standard Path',
  '2-3 Paths',
  '4-5 Paths',
  '6+ Custom Paths',
]

export function Step5Complexity({ value, onChange }: StepProps) {
  return (
    <div className="space-y-4">
      <h2 className="text-xl font-bold tracking-tight text-ink">
        Complexity & Standardisation
      </h2>
      <SelectField
        label="Number of steps"
        value={value.numberOfSteps}
        onChange={(numberOfSteps) => onChange({ numberOfSteps })}
        options={NUMBER_OF_STEPS_OPTIONS}
      />
      <SelectField
        label="Decision logic"
        value={value.decisionLogic}
        onChange={(decisionLogic) => onChange({ decisionLogic })}
        options={DECISION_LOGIC_OPTIONS}
      />
      <SelectField
        label="Process variations"
        value={value.processVariations}
        onChange={(processVariations) => onChange({ processVariations })}
        options={PROCESS_VARIATIONS_OPTIONS}
      />
    </div>
  )
}
