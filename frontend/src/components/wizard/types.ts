import type { IdeaCreate } from '../../api/ideas'

export interface WizardState {
  title: string
  categoryId: number | undefined
  processGroupId: number | undefined
  processId: number | undefined
  primaryGoal: string
  processStability: string
  systemStability: string
  taskFrequency: string
  transactionVolume: string
  headcountFte: string
  avgTimePerTaskMinutes: string
  errorRatePct: string
  avgReworkTimeMinutes: string
  auditRatePct: string
  avgLoadedFteCostEur: string
  numberOfSteps: string
  decisionLogic: string
  processVariations: string
  primaryInputFormat: string
  numberOfSystems: string
  systemInterface: string
  unstructuredData: string
  cognitiveReasoning: string
  computerVision: string
  aiOutputRisk: string
}

export const INITIAL_WIZARD_STATE: WizardState = {
  title: '',
  categoryId: undefined,
  processGroupId: undefined,
  processId: undefined,
  primaryGoal: '',
  processStability: '',
  systemStability: '',
  taskFrequency: '',
  transactionVolume: '',
  headcountFte: '',
  avgTimePerTaskMinutes: '',
  errorRatePct: '',
  avgReworkTimeMinutes: '',
  auditRatePct: '',
  avgLoadedFteCostEur: '',
  numberOfSteps: '',
  decisionLogic: '',
  processVariations: '',
  primaryInputFormat: '',
  numberOfSystems: '',
  systemInterface: '',
  unstructuredData: '',
  cognitiveReasoning: '',
  computerVision: '',
  aiOutputRisk: '',
}

export interface StepProps {
  value: WizardState
  onChange: (patch: Partial<WizardState>) => void
}

export const STEP_LABELS = [
  'Basic Info',
  'Process Mapping',
  'Process Overview',
  'Volumetry',
  'Complexity',
  'Systems',
  'AI Assessment',
  'Review & Submit',
]

function isNonEmpty(value: string): boolean {
  return value.trim().length > 0
}

function isPositiveNumber(value: string): boolean {
  const parsed = Number(value)
  return value.trim() !== '' && Number.isFinite(parsed) && parsed > 0
}

function isNonNegativeNumber(value: string): boolean {
  const parsed = Number(value)
  return value.trim() !== '' && Number.isFinite(parsed) && parsed >= 0
}

export function isStepValid(step: number, state: WizardState): boolean {
  switch (step) {
    case 1:
      return isNonEmpty(state.title)
    case 2:
      return state.processId !== undefined
    case 3:
      return (
        isNonEmpty(state.primaryGoal) &&
        isNonEmpty(state.processStability) &&
        isNonEmpty(state.systemStability)
      )
    case 4:
      return (
        isNonEmpty(state.taskFrequency) &&
        isPositiveNumber(state.transactionVolume) &&
        isNonNegativeNumber(state.headcountFte) &&
        isPositiveNumber(state.avgTimePerTaskMinutes) &&
        isNonNegativeNumber(state.errorRatePct) &&
        isNonNegativeNumber(state.avgReworkTimeMinutes) &&
        isNonNegativeNumber(state.auditRatePct) &&
        isPositiveNumber(state.avgLoadedFteCostEur)
      )
    case 5:
      return (
        isNonEmpty(state.numberOfSteps) &&
        isNonEmpty(state.decisionLogic) &&
        isNonEmpty(state.processVariations)
      )
    case 6:
      return (
        isNonEmpty(state.primaryInputFormat) &&
        isNonEmpty(state.numberOfSystems) &&
        isNonEmpty(state.systemInterface)
      )
    case 7:
      return (
        isNonEmpty(state.unstructuredData) &&
        isNonEmpty(state.cognitiveReasoning) &&
        isNonEmpty(state.computerVision) &&
        isNonEmpty(state.aiOutputRisk)
      )
    default:
      return true
  }
}

export function toIdeaCreate(state: WizardState): IdeaCreate {
  if (state.processId === undefined) {
    throw new Error('Cannot submit before an L3 process is selected')
  }
  return {
    title: state.title.trim(),
    apqc_process_id: state.processId,
    primary_goal: state.primaryGoal as IdeaCreate['primary_goal'],
    process_stability:
      state.processStability as IdeaCreate['process_stability'],
    system_stability: state.systemStability as IdeaCreate['system_stability'],
    task_frequency: state.taskFrequency as IdeaCreate['task_frequency'],
    transaction_volume: Number(state.transactionVolume),
    headcount_fte: Number(state.headcountFte),
    avg_time_per_task_minutes: Number(state.avgTimePerTaskMinutes),
    error_rate_pct: Number(state.errorRatePct),
    avg_rework_time_minutes: Number(state.avgReworkTimeMinutes),
    audit_rate_pct: Number(state.auditRatePct),
    avg_loaded_fte_cost_eur: Number(state.avgLoadedFteCostEur),
    number_of_steps: state.numberOfSteps as IdeaCreate['number_of_steps'],
    decision_logic: state.decisionLogic as IdeaCreate['decision_logic'],
    process_variations:
      state.processVariations as IdeaCreate['process_variations'],
    primary_input_format:
      state.primaryInputFormat as IdeaCreate['primary_input_format'],
    number_of_systems: state.numberOfSystems as IdeaCreate['number_of_systems'],
    system_interface: state.systemInterface as IdeaCreate['system_interface'],
    unstructured_data:
      state.unstructuredData as IdeaCreate['unstructured_data'],
    cognitive_reasoning:
      state.cognitiveReasoning as IdeaCreate['cognitive_reasoning'],
    computer_vision: state.computerVision as IdeaCreate['computer_vision'],
    ai_output_risk: state.aiOutputRisk as IdeaCreate['ai_output_risk'],
  }
}
