"""Deterministic phrase + YoE pre-screen.

Catches obvious disqualifiers (citizenship, clearance, ITAR, polygraph) and
rejects roles with a YoE floor above ``yoe.hard_block_threshold`` in
``personal_rules.yaml``.

Substring-matching is used for fixed phrases. Regex is used only for YoE
extraction (where we need to capture and compare a number).

YoE semantics (per locked decision):
* ``5+ years``    -> floor=5  -> ok
* ``6+ years``    -> floor=6  -> blocked
* ``5-7 years``   -> floor=5  -> ok
* ``minimum 6 years`` -> 6   -> blocked
* No YoE mentioned -> ok (no soft-block injected here).
"""

from __future__ import annotations

import re

from job_pipeline.config import load_personal_rules
from job_pipeline.instrumentation import track_node
from job_pipeline.schemas import GraphState, HardScreenResult

# Each pattern's group(1) is the FLOOR years value.
_YOE_PATTERNS: list[re.Pattern[str]] = [
    re.compile(r"(\d+)\s*[-\u2013]\s*\d+\s*(?:years?|yrs?)\b", re.IGNORECASE),
    re.compile(r"(\d+)\s*\+\s*(?:years?|yrs?)\b", re.IGNORECASE),
    re.compile(
        r"(?:minimum|at\s+least|min\.?)\s+(?:of\s+)?(\d+)\s*(?:years?|yrs?)\b",
        re.IGNORECASE,
    ),
    re.compile(
        r"(\d+)\s*(?:years?|yrs?)\s+(?:of\s+)?experience\b",
        re.IGNORECASE,
    ),
]


def _extract_yoe_floor(jd_text: str) -> int | None:
    """Return the strongest (max) YoE floor found in the JD, or None.

    The range pattern (e.g. ``3-5 years``) is processed first and its
    matched spans are blanked out before the remaining patterns run.
    Otherwise ``"3-5 years experience"`` would have its upper bound
    re-captured by the bare ``X years experience`` pattern, which would
    overstate the floor.
    """
    floors: list[int] = []
    text = jd_text

    range_pat = _YOE_PATTERNS[0]
    consumed: list[tuple[int, int]] = []
    for m in range_pat.finditer(text):
        try:
            floors.append(int(m.group(1)))
            consumed.append(m.span())
        except (ValueError, IndexError):
            continue

    if consumed:
        chars = list(text)
        for start, end in consumed:
            for i in range(start, end):
                chars[i] = " "
        text = "".join(chars)

    for pat in _YOE_PATTERNS[1:]:
        for m in pat.finditer(text):
            try:
                floors.append(int(m.group(1)))
            except (ValueError, IndexError):
                continue

    return max(floors) if floors else None


@track_node("hard_screen")
def hard_screen_node(state: GraphState) -> dict:
    rules = load_personal_rules()
    jd_lower = state.jd_text.lower()

    blocker_phrases = [p.lower() for p in rules.get("hard_block_phrases", [])]
    matched = [p for p in blocker_phrases if p in jd_lower]

    yoe = _extract_yoe_floor(state.jd_text)
    threshold = int(rules.get("yoe", {}).get("hard_block_threshold", 6))
    yoe_blocked = yoe is not None and yoe >= threshold

    blocked = bool(matched) or yoe_blocked

    if matched:
        reason: str | None = f"Hard-block phrase matched: {matched[0]!r}"
    elif yoe_blocked:
        reason = f"YoE requirement {yoe} >= threshold {threshold}"
    else:
        reason = None

    result = HardScreenResult(
        blocked=blocked,
        matched_phrases=matched,
        yoe_extracted=yoe,
        yoe_blocked=yoe_blocked,
        reason=reason,
    )

    update: dict = {"hard_screen": result}
    if blocked:
        update["outcome"] = "skipped_hard_screen"
        update["skip_reason"] = reason
    return update
