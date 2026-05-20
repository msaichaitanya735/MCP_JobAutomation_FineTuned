"""ATS score schema."""

from __future__ import annotations

from pydantic import BaseModel, Field


class ATSScore(BaseModel):
    """Deterministic scoring of the rendered resume against the JD."""

    overall_score: float = Field(ge=0.0, le=1.0)
    keyword_coverage: float = Field(
        ge=0.0,
        le=1.0,
        description="Fraction of jd.required_skills present in resume text.",
    )
    cosine_similarity: float = Field(
        ge=0.0,
        le=1.0,
        description="TF-IDF cosine similarity between resume text and JD text.",
    )
    section_completeness: float = Field(
        ge=0.0,
        le=1.0,
        description="Heuristic check that summary/skills/experience are populated.",
    )
    matched_keywords: list[str] = Field(default_factory=list)
    missing_keywords: list[str] = Field(default_factory=list)
    threshold: float
    passed: bool
    gap_summary: str = Field(
        default="",
        description="Short prose summary of gaps; fed back to compose_resume_content on retry.",
    )
