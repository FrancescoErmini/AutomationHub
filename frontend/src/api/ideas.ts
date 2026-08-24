import { getJson, parseResponse } from './client'

export type PrimaryGoal =
  | 'Cost Reduction'
  | 'Speed/SLA'
  | 'Error Reduction'
  | 'Compliance'
  | 'Employee Satisfaction'
export type ProcessStability =
  | 'No Change'
  | 'Minor Tweak'
  | 'Moderate Change'
  | 'Major Overhaul Planned'
export type SystemStability =
  | 'No Change'
  | 'Minor Patch'
  | 'Platform Migration Planned'
export type TaskFrequency =
  | 'Daily'
  | 'Weekly'
  | 'Monthly'
  | 'Quarterly'
  | 'Yearly'
export type NumberOfSteps = '1-5' | '6-15' | '16-30' | '31+'
export type DecisionLogic =
  | '100% Rule-Based'
  | 'Mostly Rules, Few Exceptions'
  | 'Requires Subjective Judgment'
export type ProcessVariations =
  | '1 Standard Path'
  | '2-3 Paths'
  | '4-5 Paths'
  | '6+ Custom Paths'
export type PrimaryInputFormat =
  | 'Structured Digital (Excel/DB/API)'
  | 'Unstructured Digital (PDF/Email)'
  | 'Physical Paper'
export type NumberOfSystems = '1' | '2-3' | '4-5' | '6+'
export type SystemInterface =
  | 'API Available'
  | 'Web/Desktop GUI'
  | 'Mainframe/Legacy'
  | 'Citrix/Virtual Desktop'
export type UnstructuredData =
  | 'No (Tabular/Structured)'
  | 'Yes - Standard Forms'
  | 'Yes - Free Text (Emails/Contracts)'
export type CognitiveReasoning =
  | 'No (Strict If/Then)'
  | 'Yes (Summarization/Sentiment/Extraction)'
export type ComputerVision =
  | 'No'
  | 'Yes - Native OCR'
  | 'Yes - Advanced AI Vision/Handwriting'
export type AiOutputRisk =
  | 'Strict 0% Tolerance'
  | 'Moderate (Human-in-the-Loop)'
  | 'High (Generative output acceptable)'

export interface IdeaCreate {
  title: string
  submitter_name: string
  apqc_process_id: number
  primary_goal: PrimaryGoal
  process_stability: ProcessStability
  system_stability: SystemStability
  task_frequency: TaskFrequency
  transaction_volume: number
  headcount_fte: number
  avg_time_per_task_minutes: number
  error_rate_pct: number
  avg_rework_time_minutes: number
  audit_rate_pct: number
  avg_loaded_fte_cost_eur: number
  number_of_steps: NumberOfSteps
  decision_logic: DecisionLogic
  process_variations: ProcessVariations
  primary_input_format: PrimaryInputFormat
  number_of_systems: NumberOfSystems
  system_interface: SystemInterface
  unstructured_data: UnstructuredData
  cognitive_reasoning: CognitiveReasoning
  computer_vision: ComputerVision
  ai_output_risk: AiOutputRisk
}

export interface Idea {
  id: number
  title: string
  submitter_name: string
  apqc_process_id: number
  l1_name: string
  l2_name: string
  l3_name: string
  gross_roi_eur: string
  feasibility_band: string
  technology_category: string
  final_classification: string
  status: string
  created_at: string
}

export interface IdeaDetail extends Idea {
  primary_goal: PrimaryGoal
  process_stability: ProcessStability
  system_stability: SystemStability
  task_frequency: TaskFrequency
  transaction_volume: string
  headcount_fte: string
  avg_time_per_task_minutes: string
  error_rate_pct: string
  avg_rework_time_minutes: string
  audit_rate_pct: string
  avg_loaded_fte_cost_eur: string
  number_of_steps: NumberOfSteps
  decision_logic: DecisionLogic
  process_variations: ProcessVariations
  primary_input_format: PrimaryInputFormat
  number_of_systems: NumberOfSystems
  system_interface: SystemInterface
  unstructured_data: UnstructuredData
  cognitive_reasoning: CognitiveReasoning
  computer_vision: ComputerVision
  ai_output_risk: AiOutputRisk
  annual_transactions: string
  base_hours: string
  rework_hours: string
  total_hours_saved: string
  feasibility_score: number
}

export async function fetchIdeas(): Promise<Idea[]> {
  return getJson<Idea[]>('/api/v1/ideas')
}

export async function fetchIdea(id: number): Promise<IdeaDetail> {
  return getJson<IdeaDetail>(`/api/v1/ideas/${id}`)
}

export async function createIdea(payload: IdeaCreate): Promise<IdeaDetail> {
  return parseResponse<IdeaDetail>(
    await fetch('/api/v1/ideas', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    }),
  )
}
