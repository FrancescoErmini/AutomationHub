import { TextField } from './fields'
import type { StepProps } from './types'

export function Step1BasicInfo({ value, onChange }: StepProps) {
  return (
    <div className="space-y-4">
      <h2 className="text-xl font-semibold text-ink">Basic Info</h2>
      <TextField
        label="Idea title"
        value={value.title}
        onChange={(title) => onChange({ title })}
        maxLength={300}
      />
    </div>
  )
}
