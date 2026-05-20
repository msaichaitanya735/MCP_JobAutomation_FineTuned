"""Terminal node: build a RunRecord and append it to runs/runs.jsonl.

Sits at every terminal edge of the graph (skip-on-hard-screen,
skip-on-eligibility, skip-on-user, applied, failed_validation, error).
Captures totals from ``state.node_metrics`` and the path the run took.
"""

from __future__ import annotations

import json
from datetime import datetime, timezone

from job_pipeline.config import RUNS_JSONL, ensure_runtime_dirs
from job_pipeline.instrumentation import aggregate_totals, track_node
from job_pipeline.schemas import GraphState, RunRecord

JD_EXCERPT_LEN = 240


@track_node("logger")
def logger_node(state: GraphState) -> dict:
    ensure_runtime_dirs()

    outcome = state.outcome or _infer_outcome(state)
    totals = aggregate_totals(state.node_metrics)

    record = RunRecord(
        run_id=state.run_id,
        timestamp=datetime.now(timezone.utc),
        jd_excerpt=state.jd_text[:JD_EXCERPT_LEN].strip(),
        company=state.jd_analysis.company if state.jd_analysis else None,
        role_title=state.jd_analysis.role_title if state.jd_analysis else None,
        outcome=outcome,
        skip_reason=state.skip_reason,
        path_taken=list(state.path_taken),
        eligibility_verdict=state.eligibility_verdict,
        hitl_triggered=state.hitl_triggered,
        hitl_decision=state.user_decision,
        rendered_pdf_path=state.rendered_pdf_path,
        ats_score=state.ats_score,
        node_metrics=list(state.node_metrics),
        **totals,
    )

    with RUNS_JSONL.open("a", encoding="utf-8") as f:
        f.write(record.model_dump_json() + "\n")

    return {"outcome": outcome}


def _infer_outcome(state: GraphState) -> str:
    """Best-effort fallback when no upstream node set state.outcome."""
    if state.error_message:
        return "error"
    if state.ats_score is not None:
        return "applied" if state.ats_score.passed else "failed_validation"
    return "error"
