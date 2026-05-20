"""End-to-end smoke test for the LangGraph pipeline.

Runs three canned scenarios through the full graph with the LLMClient
patched to a deterministic stub that pattern-matches on the JD text.
No real Anthropic calls are made.

Run from the repo root:

    python -m scripts.smoke_test

or:

    PYTHONPATH=src python scripts/smoke_test.py
"""

from __future__ import annotations

import os
import sys
import uuid
from datetime import datetime, timezone
from pathlib import Path

# Make the src/ layout importable when invoked as a script.
_ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(_ROOT / "src"))

# Smoke tests run in deployed mode so HITL auto-proceeds (no stdin block).
os.environ["JOB_PIPELINE_DEPLOYED"] = "true"
# Defensive: clear any real key so we cannot accidentally call the API.
os.environ.pop("ANTHROPIC_API_KEY", None)

from job_pipeline import llm as llm_module  # noqa: E402
from job_pipeline.nodes import compose_resume as compose_module  # noqa: E402
from job_pipeline.schemas import (  # noqa: E402
    CompanyBullets,
    EligibilityNodeOutput,
    EligibilityVerdict,
    GraphState,
    JDAnalysis,
    TailoredBullet,
)


class StubLLM:
    """Deterministic LLM stub. Returns canned Pydantic instances based on
    the requested output schema and a few JD-text heuristics."""

    def call_structured(
        self,
        *,
        node_name: str,
        system_prompt: str,
        user_prompt: str,
        output_schema,
        max_tokens: int = 4096,
        temperature: float = 0.0,
    ):
        # Pretend to record token usage so the metrics surface still works.
        from job_pipeline.instrumentation import current_node_metrics

        acc = current_node_metrics.get()
        if acc is not None:
            acc.record_llm_call(
                tokens_in=1000,
                tokens_out=400,
                model="stub-claude-sonnet-4-5",
                cost_usd=0.009,
            )

        name = output_schema.__name__
        if name == "EligibilityNodeOutput":
            return self._eligibility(user_prompt)
        if name == "ComposedSummaryAndBullets":
            return self._compose(user_prompt)
        raise NotImplementedError(f"StubLLM has no canned response for {name!r}.")

    def _eligibility(self, user_prompt: str) -> EligibilityNodeOutput:
        # The user_prompt contains BOTH the personal_rules JSON (which lists
        # blocker phrases) AND the JD itself. Scope the heuristics to just
        # the JD section so we don't false-positive on the rules block.
        parts = user_prompt.split("## JOB DESCRIPTION", 1)
        jd = (parts[1] if len(parts) > 1 else user_prompt).lower()

        soft_block = False
        worth_it = True
        fit_ok = True
        reason = "Strong fit; required skills match candidate experience."

        if "cannot sponsor" in jd or "no visa" in jd or "do not sponsor" in jd:
            soft_block = True
            worth_it = False
            reason = "Soft block: sponsorship constraints, not worth applying."

        return EligibilityNodeOutput(
            jd_analysis=JDAnalysis(
                role_family="AI engineer",
                seniority="mid",
                yoe_required=4,
                required_skills=[
                    "python",
                    "langgraph",
                    "fastapi",
                    "rag",
                    "agentic",
                ],
                nice_to_have=["mcp", "embeddings"],
                domain="ai-platform",
                company="TestCorp",
                role_title="AI Engineer",
            ),
            verdict=EligibilityVerdict(
                hard_block=False,
                soft_block=soft_block,
                fit_ok=fit_ok,
                worth_it=worth_it,
                reason=reason,
                explanation="Stubbed verdict for smoke test.",
            ),
        )

    def _compose(self, user_prompt: str):
        ComposedSummaryAndBullets = compose_module.ComposedSummaryAndBullets
        # Realistic-ish content so ATS scoring has something to cosine against.
        return ComposedSummaryAndBullets(
            summary=(
                "AI engineer with experience building production agentic systems "
                "in Python, LangGraph, and FastAPI. Shipped RAG pipelines, MCP "
                "connectors, and tool-calling agents with safe-execution guardrails."
            ),
            experience=[
                CompanyBullets(
                    company="HapTag AI",
                    bullets=[
                        TailoredBullet(
                            story_id="haptag_multiagent_threat",
                            text=(
                                "Built production multi-agent LangGraph pipeline; "
                                "1K+ events/day at 94% validity, with tool calling and "
                                "safe-execution guardrails."
                            ),
                        ),
                        TailoredBullet(
                            story_id="haptag_rag_semantic_cache",
                            text=(
                                "Designed RAG pipeline on pgvector with HNSW indexing "
                                "and semantic caching; cut LLM cost ~60%, sub-200ms search."
                            ),
                        ),
                        TailoredBullet(
                            story_id="haptag_mcp_connectors",
                            text=(
                                "Designed MCP connectors with versioned tool contracts; "
                                "exposed internal tools to AI agents safely."
                            ),
                        ),
                    ],
                ),
            ],
        )


# Patch the singleton BEFORE the graph is built so nodes pick up the stub.
llm_module._singleton = StubLLM()  # type: ignore[assignment]

from job_pipeline.graph import build_graph  # noqa: E402

_GRAPH = build_graph()


def run_scenario(name: str, jd_text: str) -> dict:
    state = GraphState(
        jd_text=jd_text,
        base_resume_template_path="templates/resume_template.docx",
        run_id=f"smoke_{name}_{uuid.uuid4().hex[:6]}",
        started_at=datetime.now(timezone.utc),
    )
    final = _GRAPH.invoke(state)
    final_state = (
        final if isinstance(final, GraphState) else GraphState.model_validate(final)
    )
    return {
        "name": name,
        "outcome": final_state.outcome,
        "skip_reason": final_state.skip_reason,
        "path_taken": list(final_state.path_taken),
        "hitl_triggered": final_state.hitl_triggered,
        "user_decision": final_state.user_decision,
        "ats_passed": (
            final_state.ats_score.passed if final_state.ats_score else None
        ),
        "ats_overall": (
            final_state.ats_score.overall_score if final_state.ats_score else None
        ),
        "metrics_count": len(final_state.node_metrics),
        "total_cost": sum(m.cost_usd for m in final_state.node_metrics),
    }


SCENARIOS = [
    (
        "applied",
        (
            "AI Engineer\n\n"
            "We're hiring an AI Engineer to build agentic systems on Python and LangGraph. "
            "Required: 3-5 years software experience, FastAPI, RAG, tool-calling, "
            "structured outputs, MCP, embeddings. Bonus: agentic systems shipped to "
            "production."
        ),
    ),
    (
        "hard_block",
        (
            "Senior AI Engineer (Cleared)\n\n"
            "Must be a US citizen with active TS/SCI clearance. 7+ years required. "
            "Build classified ML systems on air-gapped infra."
        ),
    ),
    (
        "hitl_proceed",
        (
            "Senior ML Engineer\n\n"
            "Build core training and serving stack in PyTorch. Standard equity-heavy "
            "package, modest cash. We cannot sponsor visas at this stage. 4-6 years required."
        ),
    ),
]


# Expectation per scenario: (allowed_outcomes, hitl_expected)
EXPECTATIONS = {
    "applied":      ({"applied", "failed_validation"}, False),
    "hard_block":   ({"skipped_hard_screen"}, False),
    "hitl_proceed": ({"applied", "failed_validation"}, True),
}


def main() -> int:
    print("=" * 100)
    header = (
        f"{'scenario':16} {'outcome':22} {'hitl':6} {'ats':16} {'cost':10} path"
    )
    print(header)
    print("=" * 100)
    failures: list[str] = []
    for name, jd in SCENARIOS:
        try:
            r = run_scenario(name, jd)
        except Exception as e:  # noqa: BLE001
            failures.append(f"{name}: raised {type(e).__name__}: {e}")
            print(f"  FAIL  {name:14} EXC {type(e).__name__}: {e}")
            continue

        ok_outcomes, expect_hitl = EXPECTATIONS[name]
        outcome_ok = r["outcome"] in ok_outcomes
        hitl_ok = r["hitl_triggered"] == expect_hitl

        ok = outcome_ok and hitl_ok
        flag = "PASS" if ok else "FAIL"
        ats = "—"
        if r["ats_passed"] is not None:
            ats = f"{'pass' if r['ats_passed'] else 'fail'} {r['ats_overall']:.2f}"
        print(
            f"  {flag}  {name:14} {str(r['outcome']):22} "
            f"{str(r['hitl_triggered']):6} {ats:16} "
            f"${r['total_cost']:.4f}  "
            f"{ ' -> '.join(r['path_taken']) }"
        )
        if not ok:
            if not outcome_ok:
                failures.append(
                    f"{name}: outcome {r['outcome']!r} not in {ok_outcomes}"
                )
            if not hitl_ok:
                failures.append(
                    f"{name}: hitl_triggered={r['hitl_triggered']}, expected {expect_hitl}"
                )

    print("=" * 100)
    if failures:
        print(f"\n{len(failures)} failure(s):")
        for f in failures:
            print(f"  - {f}")
        return 1
    print("\nall scenarios passed.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
