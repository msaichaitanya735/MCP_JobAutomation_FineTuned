# Agentic Resume Pipeline

A LangGraph-based pipeline that tailors a resume to a given job description.
Phase 1 goal: orchestration layer with most logic in deterministic Python and
one focused LLM call for genuine judgment.

## Design principle

> AI does judgment, code does determinism.

Concretely: a hard-screen filter (substring + YoE regex) catches obvious
blockers before any LLM is invoked; one LLM call assesses fit and emits
structured JD analysis; deterministic code selects stories from the bank,
renders the DOCX, converts to PDF, and scores against ATS criteria.

## Graph

```
hard_screen
  -> blocked              -> logger -> END
  -> ai_eligibility_and_fit
       -> hard_block            -> logger -> END
       -> fit_not_ok            -> human_in_the_loop
       -> soft_block & not_worth -> human_in_the_loop
       -> otherwise             -> select_stories
  human_in_the_loop
       -> proceed -> select_stories
       -> skip    -> logger -> END
  select_stories -> compose_resume_content -> resume_editor
              -> pdf_converter -> ats_score
                   -> pass             -> logger -> END
                   -> fail (retry)     -> compose_resume_content
                   -> fail (exhausted) -> logger -> END (failed)
```

## Layout

- `data/` — config: story bank, personal rules, skill categories, model pricing.
- `src/job_pipeline/schemas/` — Pydantic contracts between nodes.
- `src/job_pipeline/nodes/` — one file per graph node.
- `src/job_pipeline/instrumentation.py` — per-node time/token/cost tracking.
- `src/job_pipeline/llm.py` — Anthropic client with structured outputs.
- `src/job_pipeline/graph.py` — LangGraph wiring.
- `src/job_pipeline/evaluation/` — LLM-as-judge harness for pipeline-vs-Claude comparison.
- `runs/` — JSONL run records and generated artifacts (gitignored).

## Run

```bash
pip install -e .
cp .env.example .env  # fill in ANTHROPIC_API_KEY

# Drop your DOCX template at templates/resume_template.docx (with Jinja
# placeholders for summary, technical_skills, and per-company bullets).

job-pipeline run --jd-file path/to/jd.txt
```

## Status

Skeleton only. Node bodies are stubs returning placeholder values that
satisfy the schemas, so the graph runs end-to-end without real LLM calls.
Each node is implemented incrementally in subsequent iterations.
