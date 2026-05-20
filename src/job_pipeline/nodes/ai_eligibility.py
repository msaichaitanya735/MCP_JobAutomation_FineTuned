"""AI eligibility + fit + structured JD extraction (single LLM call).

One Anthropic call emits an ``EligibilityNodeOutput`` containing both the
parsed JD analysis and the routing verdict. Sharing input context across
the two concerns keeps token cost down (see prior design discussion).

Routes:
* hard_block=True                       -> logger -> END
* fit_ok=False                          -> human_in_the_loop
* soft_block=True and worth_it=False    -> human_in_the_loop
* otherwise                             -> select_stories
"""

from __future__ import annotations

import json

from job_pipeline.config import load_personal_rules
from job_pipeline.instrumentation import track_node
from job_pipeline.llm import get_llm_client
from job_pipeline.schemas import EligibilityNodeOutput, GraphState

SYSTEM_PROMPT = """\
You are a precise resume-pipeline component that decides whether a job \
description is worth applying to and extracts a structured analysis of it.

Output exactly one EligibilityNodeOutput payload via the provided tool. \
Do not return prose. Do not invent fields.

Decision rules (from the candidate's personal rules):

1. hard_block: true if the JD has an UNCONDITIONAL disqualifier the regex \
pre-screen missed (e.g., paraphrased citizenship requirement, an explicit \
YoE floor that the regex did not catch). Be conservative; default false.

2. soft_block: true if the JD has a CONDITIONAL blocker (no visa sponsorship, \
limited sponsorship language, restricted location, etc.). Sponsorship-related \
language is the canonical case.

3. fit_ok: true if the role family matches one of the candidate's preferred \
families (AI engineer, ML engineer applied, software/backend/full-stack, \
forward-deployed, AI platform). false for pure ML research, network/firmware/ \
hardware, mobile-first, game development, or pure data analyst roles.

4. worth_it: only meaningful when soft_block is true. Apply the candidate's \
worth_it_context to decide. true if the role is technically interesting \
(agentic systems, novel infra), the company is well-known or in an interesting \
domain, or compensation appears strong. Otherwise false.

For jd_analysis fill role_family with a short canonical label, seniority \
(junior/mid/senior/staff/principal/unknown), yoe_required (only if explicitly \
stated), required_skills + nice_to_have as lowercase tag-style strings, domain \
(e.g. fintech / cybersecurity / healthcare), and company + role_title if \
visible in the JD."""


@track_node("ai_eligibility_and_fit")
def ai_eligibility_node(state: GraphState) -> dict:
    rules = load_personal_rules()
    user_prompt = _build_user_prompt(state.jd_text, rules)

    llm = get_llm_client()
    output: EligibilityNodeOutput = llm.call_structured(
        node_name="ai_eligibility_and_fit",
        system_prompt=SYSTEM_PROMPT,
        user_prompt=user_prompt,
        output_schema=EligibilityNodeOutput,
        max_tokens=2048,
        temperature=0.0,
    )

    update: dict = {
        "jd_analysis": output.jd_analysis,
        "eligibility_verdict": output.verdict,
    }
    if output.verdict.hard_block:
        update["outcome"] = "skipped_eligibility"
        update["skip_reason"] = f"AI hard_block: {output.verdict.reason}"
    return update


def _build_user_prompt(jd_text: str, rules: dict) -> str:
    rules_block = json.dumps(
        {
            "preferred_role_families": rules.get("preferred_role_families", []),
            "disfavored_role_families": rules.get("disfavored_role_families", []),
            "soft_block_phrases": rules.get("soft_block_phrases", []),
            "worth_it_context": rules.get("worth_it_context", ""),
        },
        indent=2,
    )
    return (
        "## CANDIDATE PERSONAL RULES\n"
        f"{rules_block}\n\n"
        "## JOB DESCRIPTION\n"
        f"{jd_text.strip()}\n"
    )
