"""Deterministic ATS scoring against the JD.

Three signals, blended into ``overall_score``:

* ``cosine_similarity``  -- TF-IDF cosine on resume vs. JD text.
* ``keyword_coverage``   -- fraction of ``jd.required_skills`` whose lowercase
                            tag appears as a substring of the resume text.
* ``section_completeness`` -- 1.0 iff summary, skills, and experience are
                            all populated; weighted partials otherwise.

Pass / fail uses ``ATS_SCORE_THRESHOLD``. On fail the gap list and a short
``gap_summary`` are surfaced so ``compose_resume_content`` can retarget.
"""

from __future__ import annotations

from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.metrics.pairwise import cosine_similarity

from job_pipeline.config import ATS_SCORE_THRESHOLD
from job_pipeline.instrumentation import track_node
from job_pipeline.schemas import ATSScore, GraphState, ResumeContent


def _resume_to_text(content: ResumeContent) -> str:
    parts: list[str] = [content.summary]
    for cat, skills in content.technical_skills.categories.items():
        parts.append(f"{cat}: {', '.join(skills)}")
    for company in content.experience:
        for b in company.bullets:
            parts.append(b.text)
    return "\n".join(parts)


def _cosine_tfidf(a: str, b: str) -> float:
    if not a.strip() or not b.strip():
        return 0.0
    vec = TfidfVectorizer(stop_words="english", lowercase=True)
    matrix = vec.fit_transform([a, b])
    return float(cosine_similarity(matrix[0:1], matrix[1:2])[0, 0])


def _keyword_coverage(
    resume_text_lower: str, required: list[str]
) -> tuple[float, list[str], list[str]]:
    if not required:
        return 1.0, [], []
    matched = [k for k in required if k.lower() in resume_text_lower]
    missing = [k for k in required if k.lower() not in resume_text_lower]
    return len(matched) / len(required), matched, missing


def _section_completeness(content: ResumeContent) -> float:
    score = 0.0
    if content.summary.strip():
        score += 1.0 / 3
    if content.technical_skills.categories:
        score += 1.0 / 3
    if any(c.bullets for c in content.experience):
        score += 1.0 / 3
    return round(score, 4)


@track_node("ats_score")
def ats_score_node(state: GraphState) -> dict:
    if state.resume_content is None or state.jd_analysis is None:
        raise RuntimeError("ats_score requires resume_content and jd_analysis.")

    resume_text = _resume_to_text(state.resume_content)
    cosine = _cosine_tfidf(resume_text, state.jd_text)
    coverage, matched, missing = _keyword_coverage(
        resume_text.lower(), state.jd_analysis.required_skills
    )
    completeness = _section_completeness(state.resume_content)

    overall = round(0.4 * cosine + 0.4 * coverage + 0.2 * completeness, 4)
    passed = overall >= ATS_SCORE_THRESHOLD

    if missing:
        gap_summary = (
            f"Missing required keywords: {', '.join(missing)}. "
            "Surface these in the next attempt where they can be honestly "
            "tied to existing experience."
        )
    else:
        gap_summary = "All required keywords present; below threshold on prose similarity."

    score = ATSScore(
        overall_score=overall,
        keyword_coverage=round(coverage, 4),
        cosine_similarity=round(cosine, 4),
        section_completeness=completeness,
        matched_keywords=matched,
        missing_keywords=missing,
        threshold=ATS_SCORE_THRESHOLD,
        passed=passed,
        gap_summary=gap_summary,
    )

    update: dict = {"ats_score": score}
    if not passed:
        # Push the missing-keyword list onto the gap history so the
        # composer can use it on retry.
        update["ats_gap_history"] = [missing]
    return update
