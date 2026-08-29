import type { ReactElement } from 'react'
import { useState } from 'react'
import { useMutation } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'

import { createIdea } from '../api/ideas'
import { Step1BasicInfo } from '../components/wizard/Step1BasicInfo'
import { Step2ProcessMapping } from '../components/wizard/Step2ProcessMapping'
import { Step3ProcessOverview } from '../components/wizard/Step3ProcessOverview'
import { Step4Volumetry } from '../components/wizard/Step4Volumetry'
import { Step5Complexity } from '../components/wizard/Step5Complexity'
import { Step6Systems } from '../components/wizard/Step6Systems'
import { Step7AiAssessment } from '../components/wizard/Step7AiAssessment'
import { Step8Review } from '../components/wizard/Step8Review'
import { Stepper } from '../components/wizard/Stepper'
import {
  INITIAL_WIZARD_STATE,
  STEP_LABELS,
  isStepValid,
  toIdeaCreate,
  type StepProps,
  type WizardState,
} from '../components/wizard/types'

const TOTAL_STEPS = STEP_LABELS.length

const STEP_COMPONENTS: Array<(props: StepProps) => ReactElement> = [
  Step1BasicInfo,
  Step2ProcessMapping,
  Step3ProcessOverview,
  Step4Volumetry,
  Step5Complexity,
  Step6Systems,
  Step7AiAssessment,
  Step8Review,
]

export function IdeaWizardPage() {
  const [currentStep, setCurrentStep] = useState(1)
  const [state, setState] = useState<WizardState>(INITIAL_WIZARD_STATE)
  const navigate = useNavigate()

  const submit = useMutation({
    mutationFn: createIdea,
    onSuccess: () => navigate('/ideas'),
  })

  function patch(update: Partial<WizardState>) {
    setState((current) => ({ ...current, ...update }))
  }

  const StepComponent = STEP_COMPONENTS[currentStep - 1]
  const canAdvance = isStepValid(currentStep, state)
  const isLastStep = currentStep === TOTAL_STEPS

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Submit New Idea</h1>
        <p className="mt-2 text-slate-600">
          Walk through the assessment wizard to score and route a new automation
          candidate.
        </p>
      </div>

      <Stepper currentStep={currentStep} labels={STEP_LABELS} />

      <div className="rounded-xl border border-slate-200 bg-white p-6">
        <StepComponent value={state} onChange={patch} />
      </div>

      {submit.error && (
        <p role="alert" className="text-sm text-red-700">
          {submit.error.message}
        </p>
      )}

      <div className="flex justify-between">
        <button
          type="button"
          onClick={() => setCurrentStep((step) => Math.max(1, step - 1))}
          disabled={currentStep === 1}
          className="rounded-lg border border-slate-300 px-4 py-2 font-semibold text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
        >
          Back
        </button>
        {isLastStep ? (
          <button
            type="button"
            onClick={() => submit.mutate(toIdeaCreate(state))}
            disabled={!canAdvance || submit.isPending}
            className="rounded-lg bg-brand px-4 py-2 font-semibold text-white hover:brightness-95 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {submit.isPending ? 'Submitting…' : 'Submit idea'}
          </button>
        ) : (
          <button
            type="button"
            onClick={() =>
              setCurrentStep((step) => Math.min(TOTAL_STEPS, step + 1))
            }
            disabled={!canAdvance}
            className="rounded-lg bg-brand px-4 py-2 font-semibold text-white hover:brightness-95 disabled:cursor-not-allowed disabled:opacity-50"
          >
            Next
          </button>
        )}
      </div>
    </div>
  )
}
