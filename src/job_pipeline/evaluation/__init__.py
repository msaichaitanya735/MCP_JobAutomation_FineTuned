"""Evaluation harnesses.

Phase-1 surface: an LLM-as-judge that compares two resume renderings
(typically: this pipeline's output vs the user's existing Claude-chat
output) against a JD on a fixed rubric.
"""

from job_pipeline.evaluation.llm_judge import (
    JudgeRubricScore,
    PairwiseJudgement,
    judge_pairwise,
    judge_single,
)

__all__ = [
    "JudgeRubricScore",
    "PairwiseJudgement",
    "judge_pairwise",
    "judge_single",
]
