"""JD analysis and eligibility verdict schemas."""

from __future__ import annotations

from typing import Literal

from pydantic import BaseModel, Field

Seniority = Literal["junior", "mid", "senior", "staff", "principal", "unknown"]


class HardScreenResult(BaseModel):
    """Output of the deterministic phrase + YoE screen."""

    blocked: bool
    matched_phrases: list[str] = Field(default_factory=list)
    yoe_extracted: int | None = None
    yoe_blocked: bool = False
    reason: str | None = None


class JDAnalysis(BaseModel):
    """Structured extraction of a job description.

    Produced by `ai_eligibility_and_fit` and reused downstream by
    `select_stories`, `compose_resume_content`, and `ats_score`.
    """

    role_family: str = Field(
        description=(
            "Short canonical label for the role family, e.g. 'AI engineer', "
            "'ML researcher', 'Backend SWE', 'Forward-deployed engineer'."
        )
    )
    seniority: Seniority
    yoe_required: int | None = Field(
        default=None,
        description="Minimum years of experience required, if explicitly stated.",
    )
    required_skills: list[str] = Field(
        default_factory=list,
        description="Skills the JD calls out as required. Lowercase tags preferred.",
    )
    nice_to_have: list[str] = Field(
        default_factory=list,
        description="Skills called out as preferred / nice-to-have.",
    )
    domain: str = Field(description="Industry or problem space, e.g. 'fintech'.")
    company: str | None = None
    role_title: str | None = None


class EligibilityVerdict(BaseModel):
    """Routing decision for the eligibility node."""

    hard_block: bool = Field(
        description="True if the JD has an unconditional disqualifier the regex missed."
    )
    soft_block: bool = Field(
        description="True if the JD has a conditional blocker (e.g. no sponsorship)."
    )
    fit_ok: bool = Field(
        description="True if the role family matches preferred families."
    )
    worth_it: bool = Field(
        description="Only meaningful if soft_block=True. False -> route to HITL."
    )
    reason: str = Field(description="One short phrase summarizing the decision.")
    explanation: str = Field(description="Two-to-four sentence rationale.")


class EligibilityNodeOutput(BaseModel):
    """The structured payload the LLM emits in one call."""

    jd_analysis: JDAnalysis
    verdict: EligibilityVerdict
