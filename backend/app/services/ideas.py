from decimal import Decimal
from typing import Any

from app.core.exceptions import NotFoundError
from app.models.core import Idea
from app.repositories.ideas import IdeaRepository
from app.schemas.idea import IdeaCreate
from app.services.idea_scoring import (
    FeasibilityInput,
    RoiInput,
    compute_feasibility,
    compute_final_classification,
    compute_roi,
    compute_technology_category,
)

_DEFAULT_ROI_THRESHOLD_EUR = Decimal("50000")


class IdeaService:
    def __init__(self, repository: IdeaRepository) -> None:
        self._repository = repository

    def list_ideas(self) -> list[dict[str, Any]]:
        return self._repository.list()

    def get_idea(self, idea_id: int) -> dict[str, Any]:
        idea = self._repository.get(idea_id)
        if idea is None:
            raise NotFoundError(f"Idea {idea_id} not found")
        return idea

    def create_idea(self, payload: IdeaCreate) -> dict[str, Any]:
        if self._repository.get_process(payload.apqc_process_id) is None:
            raise NotFoundError(f"APQC process {payload.apqc_process_id} not found")

        roi = compute_roi(
            RoiInput(
                task_frequency=payload.task_frequency,
                transaction_volume=payload.transaction_volume,
                avg_time_per_task_minutes=payload.avg_time_per_task_minutes,
                error_rate_pct=payload.error_rate_pct,
                avg_rework_time_minutes=payload.avg_rework_time_minutes,
                avg_loaded_fte_cost_eur=payload.avg_loaded_fte_cost_eur,
            )
        )
        feasibility = compute_feasibility(
            FeasibilityInput(
                process_stability=payload.process_stability,
                system_stability=payload.system_stability,
                decision_logic=payload.decision_logic,
                process_variations=payload.process_variations,
                system_interface=payload.system_interface,
                primary_input_format=payload.primary_input_format,
            )
        )
        technology_category = compute_technology_category(
            payload.unstructured_data, payload.cognitive_reasoning
        )
        roi_threshold_eur = (
            self._repository.reference_variable("idea_roi_threshold_eur")
            or _DEFAULT_ROI_THRESHOLD_EUR
        )
        final_classification = compute_final_classification(
            feasibility.band, roi.gross_roi_eur, roi_threshold_eur
        )

        idea = Idea(
            title=payload.title,
            submitter_name=payload.submitter_name,
            apqc_process_id=payload.apqc_process_id,
            primary_goal=payload.primary_goal,
            process_stability=payload.process_stability,
            system_stability=payload.system_stability,
            task_frequency=payload.task_frequency,
            transaction_volume=payload.transaction_volume,
            headcount_fte=payload.headcount_fte,
            avg_time_per_task_minutes=payload.avg_time_per_task_minutes,
            error_rate_pct=payload.error_rate_pct,
            avg_rework_time_minutes=payload.avg_rework_time_minutes,
            audit_rate_pct=payload.audit_rate_pct,
            avg_loaded_fte_cost_eur=payload.avg_loaded_fte_cost_eur,
            number_of_steps=payload.number_of_steps,
            decision_logic=payload.decision_logic,
            process_variations=payload.process_variations,
            primary_input_format=payload.primary_input_format,
            number_of_systems=payload.number_of_systems,
            system_interface=payload.system_interface,
            unstructured_data=payload.unstructured_data,
            cognitive_reasoning=payload.cognitive_reasoning,
            computer_vision=payload.computer_vision,
            ai_output_risk=payload.ai_output_risk,
            annual_transactions=roi.annual_transactions,
            base_hours=roi.base_hours,
            rework_hours=roi.rework_hours,
            total_hours_saved=roi.total_hours_saved,
            gross_roi_eur=roi.gross_roi_eur,
            feasibility_score=feasibility.score,
            feasibility_band=feasibility.band,
            technology_category=technology_category,
            final_classification=final_classification,
            status="Submitted",
        )
        saved = self._repository.add(idea)
        return self.get_idea(saved.id)
