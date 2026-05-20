"""Pydantic contracts between graph nodes.

These models are the boundary types. LLM nodes use structured-output mode
to emit instances directly; deterministic nodes return them as plain values.
"""

from job_pipeline.schemas.ats import ATSScore
from job_pipeline.schemas.jd import (
    EligibilityNodeOutput,
    EligibilityVerdict,
    HardScreenResult,
    JDAnalysis,
)
from job_pipeline.schemas.resume import (
    CompanyBullets,
    ResumeContent,
    SelectedStories,
    TailoredBullet,
    TechnicalSkillsBlock,
)
from job_pipeline.schemas.state import GraphState, NodeMetrics, RunRecord
from job_pipeline.schemas.story import Story, StoryBank, StoryStar

__all__ = [
    "ATSScore",
    "CompanyBullets",
    "EligibilityNodeOutput",
    "EligibilityVerdict",
    "GraphState",
    "HardScreenResult",
    "JDAnalysis",
    "NodeMetrics",
    "ResumeContent",
    "RunRecord",
    "SelectedStories",
    "Story",
    "StoryBank",
    "StoryStar",
    "TailoredBullet",
    "TechnicalSkillsBlock",
]
