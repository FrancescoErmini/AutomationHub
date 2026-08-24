import { SelectField } from './fields'
import type { StepProps } from './types'

const UNSTRUCTURED_DATA_OPTIONS = [
  'No (Tabular/Structured)',
  'Yes - Standard Forms',
  'Yes - Free Text (Emails/Contracts)',
]
const COGNITIVE_REASONING_OPTIONS = [
  'No (Strict If/Then)',
  'Yes (Summarization/Sentiment/Extraction)',
]
const COMPUTER_VISION_OPTIONS = [
  'No',
  'Yes - Native OCR',
  'Yes - Advanced AI Vision/Handwriting',
]
const AI_OUTPUT_RISK_OPTIONS = [
  'Strict 0% Tolerance',
  'Moderate (Human-in-the-Loop)',
  'High (Generative output acceptable)',
]

export function Step7AiAssessment({ value, onChange }: StepProps) {
  return (
    <div className="space-y-4">
      <h2 className="text-xl font-semibold text-ink">AI Assessment</h2>
      <SelectField
        label="Unstructured data"
        value={value.unstructuredData}
        onChange={(unstructuredData) => onChange({ unstructuredData })}
        options={UNSTRUCTURED_DATA_OPTIONS}
      />
      <SelectField
        label="Cognitive reasoning required"
        value={value.cognitiveReasoning}
        onChange={(cognitiveReasoning) => onChange({ cognitiveReasoning })}
        options={COGNITIVE_REASONING_OPTIONS}
      />
      <SelectField
        label="Computer vision / OCR"
        value={value.computerVision}
        onChange={(computerVision) => onChange({ computerVision })}
        options={COMPUTER_VISION_OPTIONS}
      />
      <SelectField
        label="AI output risk tolerance"
        value={value.aiOutputRisk}
        onChange={(aiOutputRisk) => onChange({ aiOutputRisk })}
        options={AI_OUTPUT_RISK_OPTIONS}
      />
    </div>
  )
}
