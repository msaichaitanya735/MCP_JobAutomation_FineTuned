"""Compose the dynamic resume content via one LLM call + deterministic skills.

The LLM produces only the parts that need genuine judgment (summary prose
and lightly tailored bullets). The technical-skills block is built
deterministically from the union of selected-story skills, intersected /
ordered by JD priorities, and grouped via ``data/skill_categories.yaml``.

This node is also the retry target of the ATS feedback loop. On retry
(``state.compose_attempts > 0``), the prior gap list is appended to the
user prompt so the model has a concrete signal to optimize toward.
"""

from __future__ import annotations

import json

from pydantic import BaseModel, Field

from job_pipeline.config import load_skill_categories, load_story_bank
from job_pipeline.instrumentation import track_node
from job_pipeline.llm import get_llm_client
from job_pipeline.schemas import (
    CompanyBullets,
    GraphState,
    JDAnalysis,
    ResumeContent,
    SelectedStories,
    Story,
    StoryBank,
    TailoredBullet,
    TechnicalSkillsBlock,
)


class ComposedSummaryAndBullets(BaseModel):
    """Sub-payload the LLM is forced to emit (skills are filled deterministically)."""

    summary: str = Field(
        description=(
            "2-4 sentence professional summary. JD-specific. No buzzword salad. "
            "Use first-person elided form (start with a noun phrase). Match the "
            "JD's seniority signal."
        )
    )
    experience: list[CompanyBullets] = Field(
        description=(
            "One entry per company in selected_stories.by_company, in the same "
            "company order. Each bullet's text MUST stay faithful to the source "
            "story's resume_bullet (no fabrication of metrics or experience). "
            "Light rewording to surface JD keywords is encouraged."
        )
    )


SYSTEM_PROMPT = """\
You are a resume-tailoring component. Given a JD analysis and a list of \
the candidate's selected stories per company, produce:

1) A short summary tailored to the JD.
2) For each company, a tailored list of bullets, one per provided story_id, \
keeping the substance and metrics of the source bullet but rewording lightly \
to surface JD-required keywords where natural.

Hard rules:
- Never invent experience, companies, dates, technologies, or metrics.
- Preserve every quantified result that exists in the source bullet.
- If a JD keyword cannot be honestly surfaced from a given story, do not force it.
- Output exactly one ComposedSummaryAndBullets payload via the provided tool."""


@track_node("compose_resume_content")
def compose_resume_node(state: GraphState) -> dict:
    if state.jd_analysis is None or state.selected_stories is None:
        raise RuntimeError(
            "compose_resume_content requires jd_analysis and selected_stories."
        )

    bank = load_story_bank()
    user_prompt = _build_user_prompt(
        jd=state.jd_analysis,
        selected=state.selected_stories,
        bank=bank,
        prior_gaps=state.ats_gap_history,
        attempt=state.compose_attempts,
    )

    llm = get_llm_client()
    composed: ComposedSummaryAndBullets = llm.call_structured(
        node_name="compose_resume_content",
        system_prompt=SYSTEM_PROMPT,
        user_prompt=user_prompt,
        output_schema=ComposedSummaryAndBullets,
        max_tokens=4096,
        temperature=0.2,
    )

    skills_block = _build_skills_block(
        jd=state.jd_analysis,
        selected=state.selected_stories,
        bank=bank,
    )

    resume_content = ResumeContent(
        summary=composed.summary,
        technical_skills=skills_block,
        experience=composed.experience,
    )

    return {
        "resume_content": resume_content,
        "compose_attempts": state.compose_attempts + 1,
    }


# ---------------------------------------------------------------------------
# Skills section (deterministic)
# ---------------------------------------------------------------------------


def _build_skills_block(
    *,
    jd: JDAnalysis,
    selected: SelectedStories,
    bank: StoryBank,
) -> TechnicalSkillsBlock:
    """Union of selected-story skills, prioritized by JD requirements."""
    selected_ids = {sid for ids in selected.by_company.values() for sid in ids}
    selected_stories = [bank.get(sid) for sid in selected_ids]
    candidate_skills = {
        tag.lower() for s in selected_stories for tag in s.skills
    }

    # Order: required skills first (in JD order), then nice-to-have, then rest.
    jd_required = [s.lower() for s in jd.required_skills]
    jd_nice = [s.lower() for s in jd.nice_to_have]
    seen: set[str] = set()
    ordered: list[str] = []
    for s in (*jd_required, *jd_nice):
        if s in candidate_skills and s not in seen:
            ordered.append(s)
            seen.add(s)
    for s in candidate_skills:
        if s not in seen:
            ordered.append(s)
            seen.add(s)

    categories = load_skill_categories()
    # Reverse-index: skill -> category.
    skill_to_cat: dict[str, str] = {}
    for cat, skills in categories.items():
        for s in skills:
            skill_to_cat[s.lower()] = cat

    grouped: dict[str, list[str]] = {}
    for s in ordered:
        cat = skill_to_cat.get(s, "Other")
        grouped.setdefault(cat, []).append(s)

    return TechnicalSkillsBlock(categories=grouped)


# ---------------------------------------------------------------------------
# User prompt
# ---------------------------------------------------------------------------


def _build_user_prompt(
    *,
    jd: JDAnalysis,
    selected: SelectedStories,
    bank: StoryBank,
    prior_gaps: list[list[str]],
    attempt: int,
) -> str:
    selected_payload: dict[str, list[dict[str, object]]] = {}
    for company, ids in selected.by_company.items():
        selected_payload[company] = [
            _story_for_prompt(bank.get(sid)) for sid in ids
        ]

    sections = [
        "## JD ANALYSIS",
        json.dumps(jd.model_dump(), indent=2),
        "",
        "## SELECTED STORIES (by company, in render order)",
        json.dumps(selected_payload, indent=2),
    ]
    if attempt > 0 and prior_gaps:
        sections.extend(
            [
                "",
                "## RETRY CONTEXT",
                f"This is attempt {attempt + 1}. Prior ATS pass(es) flagged these "
                "missing keywords; surface them where they can be honestly tied "
                "to a story:",
                json.dumps(prior_gaps[-1], indent=2),
            ]
        )
    return "\n".join(sections)


def _story_for_prompt(story: Story) -> dict[str, object]:
    """Trim story to the fields the composer needs (drops verbose `star`)."""
    return {
        "id": story.id,
        "resume_bullet": story.resume_bullet,
        "skills": story.skills,
        "metrics": story.metrics,
    }
