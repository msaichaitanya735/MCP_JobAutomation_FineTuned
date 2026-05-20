"""Deterministic story selection by skill-tag overlap.

Phase-1 strategy (locked decision): cheap and transparent. For each story,
score = 0.7 * required_overlap + 0.3 * nice_to_have_overlap, where overlap is
the Jaccard-style fraction of the JD skill set covered by the story's
``skills + best_for`` tag set.

Per-company top-K with overrides from ``config.bullets_for_company``.

Phase-2 upgrade path: hybrid (deterministic shortlist + AI fine-pick) or
embeddings-based similarity. Drop-in replacement; no schema changes.
"""

from __future__ import annotations

from job_pipeline.config import bullets_for_company, load_story_bank
from job_pipeline.instrumentation import track_node
from job_pipeline.schemas import GraphState, SelectedStories, Story


def _score_story(
    story: Story,
    jd_required: set[str],
    jd_nice: set[str],
) -> float:
    story_terms = {t.lower() for t in (*story.skills, *story.best_for)}
    if not jd_required and not jd_nice:
        return 0.0
    req_overlap = (
        len(story_terms & jd_required) / len(jd_required) if jd_required else 0.0
    )
    nice_overlap = (
        len(story_terms & jd_nice) / len(jd_nice) if jd_nice else 0.0
    )
    return 0.7 * req_overlap + 0.3 * nice_overlap


@track_node("select_stories")
def select_stories_node(state: GraphState) -> dict:
    if state.jd_analysis is None:
        raise RuntimeError("select_stories requires state.jd_analysis to be populated.")

    bank = load_story_bank()
    jd_required = {s.lower() for s in state.jd_analysis.required_skills}
    jd_nice = {s.lower() for s in state.jd_analysis.nice_to_have}

    by_company: dict[str, list[str]] = {}
    relevance: dict[str, float] = {}

    for company, stories in bank.by_company().items():
        scored = [(s, _score_story(s, jd_required, jd_nice)) for s in stories]
        # Stable deterministic ordering: score desc, then story.id asc for ties.
        scored.sort(key=lambda pair: (-pair[1], pair[0].id))
        k = bullets_for_company(company)
        chosen = scored[:k]
        if not chosen:
            continue
        by_company[company] = [s.id for s, _ in chosen]
        for s, score in chosen:
            relevance[s.id] = round(score, 4)

    selected = SelectedStories(
        by_company=by_company,
        relevance_scores=relevance,
        strategy="deterministic_overlap_v1",
    )
    return {"selected_stories": selected}
