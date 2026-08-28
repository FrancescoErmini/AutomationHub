from datetime import datetime
from decimal import Decimal
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field, field_validator

PrimaryGoal = Literal[
    "Cost Reduction", "Speed/SLA", "Error Reduction", "Compliance", "Employee Satisfaction"
]
ProcessStability = Literal["No Change", "Minor Tweak", "Moderate Change", "Major Overhaul Planned"]
SystemStability = Literal["No Change", "Minor Patch", "Platform Migration Planned"]
TaskFrequency = Literal["Daily", "Weekly", "Monthly", "Quarterly", "Yearly"]
NumberOfSteps = Literal["1-5", "6-15", "16-30", "31+"]
DecisionLogic = Literal[
    "100% Rule-Based", "Mostly Rules, Few Exceptions", "Requires Subjective Judgment"
]
ProcessVariations = Literal["1 Standard Path", "2-3 Paths", "4-5 Paths", "6+ Custom Paths"]
PrimaryInputFormat = Literal[
    "Structured Digital (Excel/DB/API)", "Unstructured Digital (PDF/Email)", "Physical Paper"
]
NumberOfSystems = Literal["1", "2-3", "4-5", "6+"]
SystemInterface = Literal[
    "API Available", "Web/Desktop GUI", "Mainframe/Legacy", "Citrix/Virtual Desktop"
]
UnstructuredData = Literal[
    "No (Tabular/Structured)", "Yes - Standard Forms", "Yes - Free Text (Emails/Contracts)"
]
CognitiveReasoning = Literal["No (Strict If/Then)", "Yes (Summarization/Sentiment/Extraction)"]
ComputerVision = Literal["No", "Yes - Native OCR", "Yes - Advanced AI Vision/Handwriting"]
AiOutputRisk = Literal[
    "Strict 0% Tolerance", "Moderate (Human-in-the-Loop)", "High (Generative output acceptable)"
]


class IdeaCreate(BaseModel):
    # Step 1
    title: str = Field(min_length=1, max_length=300)

    # Step 2
    apqc_process_id: int

    # Step 3
    primary_goal: PrimaryGoal
    process_stability: ProcessStability
    system_stability: SystemStability

    # Step 4
    task_frequency: TaskFrequency
    transaction_volume: Decimal = Field(gt=0)
    headcount_fte: Decimal = Field(ge=0)
    avg_time_per_task_minutes: Decimal = Field(gt=0)
    error_rate_pct: Decimal = Field(ge=0, le=100)
    avg_rework_time_minutes: Decimal = Field(ge=0)
    audit_rate_pct: Decimal = Field(ge=0, le=100)
    avg_loaded_fte_cost_eur: Decimal = Field(gt=0)

    # Step 5
    number_of_steps: NumberOfSteps
    decision_logic: DecisionLogic
    process_variations: ProcessVariations

    # Step 6
    primary_input_format: PrimaryInputFormat
    number_of_systems: NumberOfSystems
    system_interface: SystemInterface

    # Step 7
    unstructured_data: UnstructuredData
    cognitive_reasoning: CognitiveReasoning
    computer_vision: ComputerVision
    ai_output_risk: AiOutputRisk

    @field_validator("title")
    @classmethod
    def strip_and_require(cls, value: str) -> str:
        if not (cleaned := value.strip()):
            raise ValueError("must not be blank")
        return cleaned


class IdeaRead(BaseModel):
    id: int
    title: str
    submitter_name: str
    apqc_process_id: int
    l1_name: str
    l2_name: str
    l3_name: str
    gross_roi_eur: Decimal
    feasibility_band: str
    technology_category: str
    final_classification: str
    status: str
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)


class IdeaDetail(IdeaRead):
    primary_goal: str
    process_stability: str
    system_stability: str
    task_frequency: str
    transaction_volume: Decimal
    headcount_fte: Decimal
    avg_time_per_task_minutes: Decimal
    error_rate_pct: Decimal
    avg_rework_time_minutes: Decimal
    audit_rate_pct: Decimal
    avg_loaded_fte_cost_eur: Decimal
    number_of_steps: str
    decision_logic: str
    process_variations: str
    primary_input_format: str
    number_of_systems: str
    system_interface: str
    unstructured_data: str
    cognitive_reasoning: str
    computer_vision: str
    ai_output_risk: str
    annual_transactions: Decimal
    base_hours: Decimal
    rework_hours: Decimal
    total_hours_saved: Decimal
    feasibility_score: int
