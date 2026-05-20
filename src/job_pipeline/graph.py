"""LangGraph wiring.

State machine:

    hard_screen
      -> blocked                 -> logger -> END
      -> pass                    -> ai_eligibility_and_fit

    ai_eligibility_and_fit
      -> error / hard_block      -> logger -> END
      -> fit_not_ok              -> human_in_the_loop
      -> soft_block & !worth_it  -> human_in_the_loop
      -> otherwise               -> select_stories

    human_in_the_loop
      -> proceed                 -> select_stories
      -> skip                    -> logger -> END

    select_stories
      -> compose_resume_content
      -> resume_editor -> pdf_converter -> ats_score

    ats_score
      -> pass                    -> logger -> END
      -> fail & retries left     -> compose_resume_content
      -> fail & exhausted        -> logger -> END

Every routing function short-circuits to ``logger`` on
``state.outcome == "error"`` so a failed node does not cascade.
"""

from __future__ import annotations

from typing import Callable

from langgraph.graph import END, StateGraph

from job_pipeline.config import ATS_MAX_RETRIES
from job_pipeline.nodes import (
    ai_eligibility_node,
    ats_score_node,
    compose_resume_node,
    hard_screen_node,
    human_in_the_loop_node,
    logger_node,
    pdf_converter_node,
    resume_editor_node,
    select_stories_node,
)
from job_pipeline.schemas import GraphState

# ---------------------------------------------------------------------------
# Routers
# ---------------------------------------------------------------------------


def _short_circuit_on_error(default: str) -> Callable[[GraphState], str]:
    def router(state: GraphState) -> str:
        if state.outcome == "error":
            return "logger"
        return default

    return router


def _route_after_hard_screen(state: GraphState) -> str:
    if state.outcome == "error":
        return "logger"
    if state.hard_screen and state.hard_screen.blocked:
        return "logger"
    return "ai_eligibility_and_fit"


def _route_after_eligibility(state: GraphState) -> str:
    if state.outcome == "error":
        return "logger"
    verdict = state.eligibility_verdict
    if verdict is None or verdict.hard_block:
        return "logger"
    if not verdict.fit_ok:
        return "human_in_the_loop"
    if verdict.soft_block and not verdict.worth_it:
        return "human_in_the_loop"
    return "select_stories"


def _route_after_hitl(state: GraphState) -> str:
    if state.outcome == "error":
        return "logger"
    if state.user_decision == "proceed":
        return "select_stories"
    return "logger"


def _route_after_ats(state: GraphState) -> str:
    if state.outcome == "error":
        return "logger"
    score = state.ats_score
    if score is None:
        return "logger"
    if score.passed:
        return "logger"
    # compose_attempts is incremented INSIDE compose_resume_node, so by the
    # time we get here it equals "number of attempts already made".
    if state.compose_attempts > ATS_MAX_RETRIES:
        return "logger"
    return "compose_resume_content"


# ---------------------------------------------------------------------------
# Graph construction
# ---------------------------------------------------------------------------


def build_graph():
    """Compile and return the runnable LangGraph."""
    g: StateGraph = StateGraph(GraphState)

    g.add_node("hard_screen", hard_screen_node)
    g.add_node("ai_eligibility_and_fit", ai_eligibility_node)
    g.add_node("human_in_the_loop", human_in_the_loop_node)
    g.add_node("select_stories", select_stories_node)
    g.add_node("compose_resume_content", compose_resume_node)
    g.add_node("resume_editor", resume_editor_node)
    g.add_node("pdf_converter", pdf_converter_node)
    g.add_node("ats_score", ats_score_node)
    g.add_node("logger", logger_node)

    g.set_entry_point("hard_screen")

    g.add_conditional_edges(
        "hard_screen",
        _route_after_hard_screen,
        {"logger": "logger", "ai_eligibility_and_fit": "ai_eligibility_and_fit"},
    )

    g.add_conditional_edges(
        "ai_eligibility_and_fit",
        _route_after_eligibility,
        {
            "logger": "logger",
            "human_in_the_loop": "human_in_the_loop",
            "select_stories": "select_stories",
        },
    )

    g.add_conditional_edges(
        "human_in_the_loop",
        _route_after_hitl,
        {"select_stories": "select_stories", "logger": "logger"},
    )

    # Linear stretch: each edge still routes to logger on error.
    g.add_conditional_edges(
        "select_stories",
        _short_circuit_on_error("compose_resume_content"),
        {"compose_resume_content": "compose_resume_content", "logger": "logger"},
    )
    g.add_conditional_edges(
        "compose_resume_content",
        _short_circuit_on_error("resume_editor"),
        {"resume_editor": "resume_editor", "logger": "logger"},
    )
    g.add_conditional_edges(
        "resume_editor",
        _short_circuit_on_error("pdf_converter"),
        {"pdf_converter": "pdf_converter", "logger": "logger"},
    )
    g.add_conditional_edges(
        "pdf_converter",
        _short_circuit_on_error("ats_score"),
        {"ats_score": "ats_score", "logger": "logger"},
    )

    g.add_conditional_edges(
        "ats_score",
        _route_after_ats,
        {
            "logger": "logger",
            "compose_resume_content": "compose_resume_content",
        },
    )

    g.add_edge("logger", END)

    return g.compile()
