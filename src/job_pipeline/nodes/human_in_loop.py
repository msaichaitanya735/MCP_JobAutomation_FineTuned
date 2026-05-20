"""Human-in-the-loop confirmation node.

Triggered by the eligibility router when:
* ``fit_ok`` is False (role family does not match preferences), or
* ``soft_block`` is True and ``worth_it`` is False.

Surfaces the AI's reasoning to the user and asks proceed / skip.

Two execution modes:
* CLI (default)            - prompt via stdin, block until user replies.
* Deployed (serverless)    - ``JOB_PIPELINE_DEPLOYED=true`` short-circuits
  the prompt. Submitting a JD through the live form is treated as
  implicit consent to proceed; the auto-decision is recorded on the
  metric so the trace shows what happened.

The deployed-mode behavior is documented in ``.kiro/steering/architecture.md``.
"""

from __future__ import annotations

import os
import sys

from job_pipeline.instrumentation import current_node_metrics, track_node
from job_pipeline.schemas import GraphState


def _is_deployed() -> bool:
    return os.environ.get("JOB_PIPELINE_DEPLOYED", "").lower() in {"1", "true", "yes"}


def _ask_proceed_or_skip(question: str, context_lines: list[str]) -> str:
    """Prompt the user; return 'proceed' or 'skip'."""
    print("\n" + "=" * 72, file=sys.stderr)
    print("HUMAN-IN-THE-LOOP", file=sys.stderr)
    print("=" * 72, file=sys.stderr)
    print(question, file=sys.stderr)
    print("", file=sys.stderr)
    for line in context_lines:
        print(f"  {line}", file=sys.stderr)
    print("", file=sys.stderr)
    print("  [1] Proceed (apply anyway)", file=sys.stderr)
    print("  [2] Skip", file=sys.stderr)
    print("=" * 72, file=sys.stderr)
    while True:
        try:
            ans = input("Choice [1/2]: ").strip()
        except EOFError:
            return "skip"
        if ans == "1":
            return "proceed"
        if ans == "2":
            return "skip"
        print("Please enter 1 or 2.", file=sys.stderr)


@track_node("human_in_the_loop")
def human_in_the_loop_node(state: GraphState) -> dict:
    verdict = state.eligibility_verdict
    jd = state.jd_analysis
    if verdict is None or jd is None:
        # Defensive: should never hit because the router enforces this.
        return {
            "hitl_triggered": True,
            "user_decision": "skip",
            "outcome": "skipped_user",
            "skip_reason": "HITL invoked without eligibility verdict.",
        }

    if not verdict.fit_ok:
        question = "Role family does not match your preferences. Apply anyway?"
    elif verdict.soft_block and not verdict.worth_it:
        question = "Soft blocker present and AI judged not worth applying. Override?"
    else:
        question = "Borderline case. Review and decide."

    context_lines = [
        f"Company:    {jd.company or '(not detected)'}",
        f"Role:       {jd.role_title or '(not detected)'}",
        f"Family:     {jd.role_family} ({jd.seniority})",
        f"Domain:     {jd.domain}",
        f"Reason:     {verdict.reason}",
        f"Reasoning:  {verdict.explanation}",
    ]

    if _is_deployed():
        # Submitting a JD through the live form is implicit consent.
        decision = "proceed"
        acc = current_node_metrics.get()
        if acc is not None:
            acc.extra["auto_decision_reason"] = "deployed_mode_implicit_proceed"
    else:
        decision = _ask_proceed_or_skip(question, context_lines)

    update: dict = {
        "hitl_triggered": True,
        "user_decision": decision,
    }
    if decision == "skip":
        update["outcome"] = "skipped_user"
        update["skip_reason"] = "User declined at HITL."
    return update
