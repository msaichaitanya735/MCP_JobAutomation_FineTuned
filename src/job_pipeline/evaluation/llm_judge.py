"""LLM-as-judge harness for pipeline-vs-Claude comparison.

Runs a separate, judgment-only LLM call that scores a resume against a JD
on a fixed rubric. Token usage is captured into the active node's metrics
when invoked from inside a tracked node, but the harness can also be
invoked stand-alone outside the graph (e.g. from a comparison script).

Usage::

    from job_pipeline.evaluation import judge_single, judge_pairwise

    score = judge_single(jd_text=..., resume_text=..., label="pipeline_v1")
    diff  = judge_pairwise(jd_text=..., resume_a=..., resume_b=...,
                            label_a="pipeline_v1", label_b="claude_chat")

Both functions return Pydantic models so the caller can persist them
alongside RunRecords for trend analysis.
"""

from __future__ import annotations

from typing import Literal

from pydantic import BaseModel, Field

from job_pipeline.llm import get_llm_client


class JudgeRubricScore(BaseModel):
    """Per-rubric and overall judgment of a single resume."""

    label: str = Field(description="Identifier for the resume being judged.")
    keyword_alignment: float = Field(
        ge=0.0, le=1.0, description="JD keyword coverage and natural surfacing."
    )
    factual_fidelity: float = Field(
        ge=0.0,
        le=1.0,
        description="No fabricated metrics, roles, dates, or technologies.",
    )
    seniority_fit: float = Field(
        ge=0.0, le=1.0, description="Tone matches the JD's seniority signal."
    )
    prose_quality: float = Field(
        ge=0.0, le=1.0, description="Crisp, non-buzzword, readable English."
    )
    overall: float = Field(ge=0.0, le=1.0)
    rationale: str


class PairwiseJudgement(BaseModel):
    """Side-by-side judgment of two resumes against the same JD."""

    a: JudgeRubricScore
    b: JudgeRubricScore
    winner: Literal["a", "b", "tie"]
    reasoning: str


_SINGLE_SYSTEM = """\
You are a strict resume-quality judge. Score the candidate's resume against \
the provided job description on each rubric axis from 0 to 1, with one \
decimal of precision. Penalize fabrication harshly (factual_fidelity should \
drop sharply on any invented metric, role, or technology). Output exactly \
one JudgeRubricScore payload via the provided tool."""

_PAIRWISE_SYSTEM = """\
You are a strict pairwise resume-quality judge. Score BOTH resumes A and B \
against the same JD using the same rubric, then pick a winner or tie. \
Output exactly one PairwiseJudgement payload via the provided tool."""


def judge_single(
    *,
    jd_text: str,
    resume_text: str,
    label: str,
) -> JudgeRubricScore:
    user_prompt = (
        "## JOB DESCRIPTION\n"
        f"{jd_text.strip()}\n\n"
        f"## RESUME (label={label})\n"
        f"{resume_text.strip()}\n"
    )
    return get_llm_client().call_structured(
        node_name="judge_single",
        system_prompt=_SINGLE_SYSTEM,
        user_prompt=user_prompt,
        output_schema=JudgeRubricScore,
        max_tokens=1024,
        temperature=0.0,
    )


def judge_pairwise(
    *,
    jd_text: str,
    resume_a: str,
    resume_b: str,
    label_a: str,
    label_b: str,
) -> PairwiseJudgement:
    user_prompt = (
        "## JOB DESCRIPTION\n"
        f"{jd_text.strip()}\n\n"
        f"## RESUME A (label={label_a})\n"
        f"{resume_a.strip()}\n\n"
        f"## RESUME B (label={label_b})\n"
        f"{resume_b.strip()}\n"
    )
    return get_llm_client().call_structured(
        node_name="judge_pairwise",
        system_prompt=_PAIRWISE_SYSTEM,
        user_prompt=user_prompt,
        output_schema=PairwiseJudgement,
        max_tokens=2048,
        temperature=0.0,
    )
