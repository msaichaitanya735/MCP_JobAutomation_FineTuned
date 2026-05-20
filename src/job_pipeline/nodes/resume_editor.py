"""Render the dynamic resume content into a DOCX from a Jinja DOCX template.

Uses ``docxtpl`` (Jinja inside Word). Static sections (header, education,
projects) live in the template and are not represented in ``ResumeContent``.

The template is expected at ``templates/resume_template.docx`` and must
expose at minimum these Jinja variables:

* ``summary``                  -> str
* ``technical_skills``         -> dict[str, list[str]]  (category -> skills)
* ``experience``               -> list[{company, bullets: list[str]}]

Output path: ``runs/outputs/<run_id>_resume.docx``.

This node is a *thin* skeleton in v1: if the template is missing it logs a
warning and produces a placeholder ``.txt`` rendering of the content so the
graph can still complete end-to-end during early development.
"""

from __future__ import annotations

import logging
from pathlib import Path

from job_pipeline.config import RUNS_OUTPUTS_DIR, TEMPLATES_DIR, ensure_runtime_dirs
from job_pipeline.instrumentation import track_node
from job_pipeline.schemas import GraphState, ResumeContent

logger = logging.getLogger(__name__)

TEMPLATE_FILENAME = "resume_template.docx"


@track_node("resume_editor")
def resume_editor_node(state: GraphState) -> dict:
    if state.resume_content is None:
        raise RuntimeError("resume_editor requires state.resume_content to be set.")

    ensure_runtime_dirs()
    template_path = TEMPLATES_DIR / TEMPLATE_FILENAME
    out_path = RUNS_OUTPUTS_DIR / f"{state.run_id}_resume.docx"

    if not template_path.exists():
        # Soft fallback so the graph remains end-to-end runnable before the
        # user drops their template in. Produces a plain text dump.
        txt_path = out_path.with_suffix(".txt")
        txt_path.write_text(_render_text_fallback(state.resume_content), encoding="utf-8")
        logger.warning(
            "resume_template.docx not found; wrote text fallback to %s", txt_path
        )
        return {"rendered_docx_path": str(txt_path)}

    _render_with_docxtpl(template_path, out_path, state.resume_content)
    return {"rendered_docx_path": str(out_path)}


def _render_with_docxtpl(
    template_path: Path,
    out_path: Path,
    content: ResumeContent,
) -> None:
    # Imported lazily so the package can be imported even when docxtpl
    # is missing in a stripped-down environment.
    from docxtpl import DocxTemplate

    tpl = DocxTemplate(str(template_path))
    context = {
        "summary": content.summary,
        "technical_skills": content.technical_skills.categories,
        "experience": [
            {
                "company": company.company,
                "bullets": [b.text for b in company.bullets],
            }
            for company in content.experience
        ],
    }
    tpl.render(context)
    tpl.save(str(out_path))


def _render_text_fallback(content: ResumeContent) -> str:
    lines: list[str] = ["SUMMARY", content.summary, "", "TECHNICAL SKILLS"]
    for cat, skills in content.technical_skills.categories.items():
        lines.append(f"  {cat}: {', '.join(skills)}")
    lines.extend(["", "EXPERIENCE"])
    for company in content.experience:
        lines.append(f"  {company.company}")
        for b in company.bullets:
            lines.append(f"    - {b.text}")
    return "\n".join(lines)
