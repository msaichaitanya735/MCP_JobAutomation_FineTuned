"""LangGraph state, per-node metrics, and final run record."""

from __future__ import annotations

from datetime import datetime
from operator import add
from typing import Annotated, Literal

from pydantic import BaseModel, Field

from job_pipeline.schemas.ats import ATSScore
from job_pipeline.schemas.jd import (
    EligibilityVerdict,
    HardScreenResult,
    JDAnalysis,
)
from job_pipeline.schemas.resume import ResumeContent, SelectedStories

Outcome = Literal[
    "applied",
    "skipped_hard_screen",
    "skipped_eligibility",
    "skipped_user",
    "failed_validation",
    "error",
]

UserDecision = Literal["proceed", "skip"]


class NodeMetrics(BaseModel):
    """One execution of one node. Accumulated into state.node_metrics."""

    node_name: str
    started_at: datetime
    ended_at: datetime
    latency_ms: float
    tokens_in: int = 0
    tokens_out: int = 0
    cost_usd: float = 0.0
    model: str | None = None
    success: bool = True
    error: str | None = None
    extra: dict[str, object] = Field(default_factory=dict)


class GraphState(BaseModel):
    """Shared state flowing through the LangGraph.

    Fields use `Annotated[..., add]` reducers where multiple nodes append.
    Single-write fields default to None and are populated by exactly one node.
    """

    # ---- inputs ----------------------------------------------------------
    jd_text: str
    base_resume_template_path: str
    run_id: str
    started_at: datetime

    # ---- hard_screen -----------------------------------------------------
    hard_screen: HardScreenResult | None = None

    # ---- ai_eligibility_and_fit -----------------------------------------
    jd_analysis: JDAnalysis | None = None
    eligibility_verdict: EligibilityVerdict | None = None

    # ---- human_in_the_loop ----------------------------------------------
    hitl_triggered: bool = False
    user_decision: UserDecision | None = None

    # ---- select_stories --------------------------------------------------
    selected_stories: SelectedStories | None = None

    # ---- compose_resume_content -----------------------------------------
    resume_content: ResumeContent | None = None
    compose_attempts: int = 0
    # Each retry pushes the prior gap list onto this stack.
    ats_gap_history: Annotated[list[list[str]], add] = Field(default_factory=list)

    # ---- resume_editor + pdf_converter ----------------------------------
    rendered_docx_path: str | None = None
    rendered_pdf_path: str | None = None

    # ---- ats_score -------------------------------------------------------
    ats_score: ATSScore | None = None

    # ---- terminal --------------------------------------------------------
    outcome: Outcome | None = None
    skip_reason: str | None = None
    error_message: str | None = None

    # ---- accumulated tracking -------------------------------------------
    node_metrics: Annotated[list[NodeMetrics], add] = Field(default_factory=list)
    path_taken: Annotated[list[str], add] = Field(default_factory=list)


class RunRecord(BaseModel):
    """Final record appended to runs/runs.jsonl by the logger node."""

    run_id: str
    timestamp: datetime
    jd_excerpt: str
    company: str | None = None
    role_title: str | None = None

    outcome: Outcome
    skip_reason: str | None = None

    path_taken: list[str]
    eligibility_verdict: EligibilityVerdict | None = None
    hitl_triggered: bool = False
    hitl_decision: UserDecision | None = None

    rendered_pdf_path: str | None = None
    ats_score: ATSScore | None = None

    total_latency_ms: float
    total_tokens_in: int
    total_tokens_out: int
    total_cost_usd: float

    node_metrics: list[NodeMetrics]
