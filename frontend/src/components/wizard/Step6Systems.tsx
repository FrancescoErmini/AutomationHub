import { SelectField } from './fields'
import type { StepProps } from './types'

const PRIMARY_INPUT_FORMAT_OPTIONS = [
  'Structured Digital (Excel/DB/API)',
  'Unstructured Digital (PDF/Email)',
  'Physical Paper',
]
const NUMBER_OF_SYSTEMS_OPTIONS = ['1', '2-3', '4-5', '6+']
const SYSTEM_INTERFACE_OPTIONS = [
  'API Available',
  'Web/Desktop GUI',
  'Mainframe/Legacy',
  'Citrix/Virtual Desktop',
]

export function Step6Systems({ value, onChange }: StepProps) {
  return (
    <div className="space-y-4">
      <h2 className="text-xl font-bold tracking-tight text-ink">
        Systems & Environment
      </h2>
      <SelectField
        label="Primary input format"
        value={value.primaryInputFormat}
        onChange={(primaryInputFormat) => onChange({ primaryInputFormat })}
        options={PRIMARY_INPUT_FORMAT_OPTIONS}
      />
      <SelectField
        label="Number of systems"
        value={value.numberOfSystems}
        onChange={(numberOfSystems) => onChange({ numberOfSystems })}
        options={NUMBER_OF_SYSTEMS_OPTIONS}
      />
      <SelectField
        label="System interface"
        value={value.systemInterface}
        onChange={(systemInterface) => onChange({ systemInterface })}
        options={SYSTEM_INTERFACE_OPTIONS}
      />
    </div>
  )
}
