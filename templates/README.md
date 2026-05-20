# templates/

Place your resume template here as `resume_template.docx`.

The `resume_editor` node renders this file via `docxtpl` (Jinja syntax inside
a Word document). Required placeholders:

- `{{ summary }}` — paragraph rewritten per JD by `compose_resume_content`.
- `{{ technical_skills }}` — block of categorized skills, per JD ordering.
- For each company you want to render, a placeholder block iterating the
  selected and tailored bullets, e.g.:
  ```
  {% for bullet in haptag_bullets %}
  - {{ bullet }}
  {% endfor %}
  ```
- Static sections (header, education, projects) live directly in the template
  and are never rewritten by the pipeline.

The exact Jinja variable names map to keys produced by `ResumeContent`
(see `src/job_pipeline/schemas/resume.py`).

This file is gitignored (DOCX/PDF excluded) since templates may contain PII.
