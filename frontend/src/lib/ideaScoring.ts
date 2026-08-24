/**
 * Client-side mirror of backend/app/services/idea_scoring.py, used only for
 * the Step 8 live preview. The persisted values always come from the
 * server's response after submit -- if these two implementations ever
 * disagree, the server wins.
 */

export const FREQUENCY_FACTORS: Record<string, number> = {
  Daily: 250,
  Weekly: 52,
  Monthly: 12,
  Quarterly: 4,
  Yearly: 1,
}

const WORK_HOURS_PER_YEAR = 250 * 8

function roundTo(value: number, decimals: number): number {
  const factor = 10 ** decimals
  return Math.round((value + Number.EPSILON) * factor) / factor
}

export interface RoiInput {
  taskFrequency: string
  transactionVolume: number
  avgTimePerTaskMinutes: number
  errorRatePct: number
  avgReworkTimeMinutes: number
  avgLoadedFteCostEur: number
}

export interface RoiResult {
  annualTransactions: number
  baseHours: number
  reworkHours: number
  totalHoursSaved: number
  grossRoiEur: number
}

export function computeRoi(input: RoiInput): RoiResult {
  const frequencyFactor = FREQUENCY_FACTORS[input.taskFrequency] ?? 0
  const annualTransactions = input.transactionVolume * frequencyFactor
  const baseHours = (annualTransactions * input.avgTimePerTaskMinutes) / 60
  const reworkHours =
    (annualTransactions *
      (input.errorRatePct / 100) *
      input.avgReworkTimeMinutes) /
    60
  const totalHoursSaved = baseHours + reworkHours
  const hourlyRate = input.avgLoadedFteCostEur / WORK_HOURS_PER_YEAR
  const grossRoiEur = totalHoursSaved * hourlyRate
  return {
    annualTransactions: roundTo(annualTransactions, 2),
    baseHours: roundTo(baseHours, 2),
    reworkHours: roundTo(reworkHours, 2),
    totalHoursSaved: roundTo(totalHoursSaved, 2),
    grossRoiEur: roundTo(grossRoiEur, 2),
  }
}

export interface FeasibilityInput {
  processStability: string
  systemStability: string
  decisionLogic: string
  processVariations: string
  systemInterface: string
  primaryInputFormat: string
}

export interface FeasibilityResult {
  score: number
  band: 'High' | 'Medium' | 'Low'
}

const FEASIBILITY_PENALTIES: Array<{
  field: keyof FeasibilityInput
  triggerValue: string
  penalty: number
}> = [
  {
    field: 'processStability',
    triggerValue: 'Major Overhaul Planned',
    penalty: 30,
  },
  {
    field: 'systemStability',
    triggerValue: 'Platform Migration Planned',
    penalty: 20,
  },
  {
    field: 'decisionLogic',
    triggerValue: 'Requires Subjective Judgment',
    penalty: 25,
  },
  { field: 'processVariations', triggerValue: '6+ Custom Paths', penalty: 20 },
  {
    field: 'systemInterface',
    triggerValue: 'Citrix/Virtual Desktop',
    penalty: 15,
  },
  { field: 'primaryInputFormat', triggerValue: 'Physical Paper', penalty: 15 },
]

export function computeFeasibility(input: FeasibilityInput): FeasibilityResult {
  let score = 100
  for (const { field, triggerValue, penalty } of FEASIBILITY_PENALTIES) {
    if (input[field] === triggerValue) score -= penalty
  }
  const band = score >= 80 ? 'High' : score >= 50 ? 'Medium' : 'Low'
  return { score, band }
}

export function computeTechnologyCategory(
  unstructuredData: string,
  cognitiveReasoning: string,
): string {
  if (
    unstructuredData === 'Yes - Free Text (Emails/Contracts)' ||
    cognitiveReasoning === 'Yes (Summarization/Sentiment/Extraction)'
  ) {
    return 'GenAI / Agentic (LLM + Automation)'
  }
  if (unstructuredData === 'Yes - Standard Forms') {
    return 'RPA + AI Document Understanding'
  }
  return 'Traditional RPA'
}

export function computeFinalClassification(
  feasibilityBand: string,
  grossRoiEur: number,
  roiThresholdEur: number,
): string {
  if (feasibilityBand === 'Low') return 'Deprioritize / Avoid'
  const isHighRoi = grossRoiEur >= roiThresholdEur
  if (feasibilityBand === 'High')
    return isHighRoi ? 'Quick Win' : 'Low-Hanging Fruit'
  // Medium feasibility
  return isHighRoi ? 'Strategic Investment' : 'Deprioritize / Avoid'
}

export const DEFAULT_ROI_THRESHOLD_EUR = 50000
