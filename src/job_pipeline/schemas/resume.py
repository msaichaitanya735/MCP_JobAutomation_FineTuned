"""Resume content schemas (output of compose_resume_content, input to editor)."""

from __future__ import annotations

from pydantic import BaseModel, Field


class TechnicalSkillsBlock(BaseModel):
    """Categorized skills, in JD-priority order within each category."""

    categories: dict[str, list[str]] = Field(
        default_factory=dict,
        description="Mapping like {'Languages': ['Python', 'TypeScript'], ...}.",
    )


class TailoredBullet(BaseModel):
    """One bullet for a company section, traceable back to the source story."""

    story_id: str
    text: str


class CompanyBullets(BaseModel):
    """Tailored bullets for one employer, in render order."""

    company: str
    bullets: list[TailoredBullet] = Field(default_factory=list)


class ResumeContent(BaseModel):
    """Everything the editor needs to render the dynamic sections of the DOCX.

    Static sections (header, education, projects) live in the template
    and are not represented here.
    """

    summary: str
    technical_skills: TechnicalSkillsBlock
    experience: list[CompanyBullets] = Field(default_factory=list)


class SelectedStories(BaseModel):
    """Output of select_stories: which stories feed compose_resume_content."""

    by_company: dict[str, list[str]] = Field(
        default_factory=dict,
        description="company -> ordered list of story IDs.",
    )
    relevance_scores: dict[str, float] = Field(
        default_factory=dict,
        description="story_id -> similarity score (0-1).",
    )
    strategy: str = Field(
        default="deterministic_cosine",
        description="Selection strategy used (deterministic_cosine / ai / hybrid).",
    )
