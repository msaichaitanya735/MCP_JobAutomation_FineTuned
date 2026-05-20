---
inclusion: always
---

# Architecture and locked design decisions

## Project goal

Tailor a resume to a single job description with maximum quality and minimum
LLM spend. Phase 1 = orchestration layer only. Phase 2 = swap the LLM nodes
for a fine-tuned local model trained on prior Opus-generated tailorings.

## Guiding principle

> AI does judgment. Code does determinism.

If two competent humans would always produce the same output, it is code.
If they would reasonably differ, it is AI. Every cost / latency reduction
in this project comes from pushing work from the AI side to the code side.

## Orchestration framework

**LangGraph** is the orchestrator. Selected over LangChain (chains are too
linear), CrewAI (assumes every agent is an LLM), AutoGen (conversation
loops re-introduce the token problem), and plain Python (would require
re-implementing checkpointing, branching, and HITL by hand).

Nodes are plain functions. The shared `GraphState` is a Pydantic model.
List-typed accumulator fields use `Annotated[list, operator.add]` so
reducer-style appending works.

## Graph topology (locked)

```
hard_screen
  -> blocked                  -> logger -> END
  -> pass                     -> ai_eligibility_and_fit

ai_eligibility_and_fit  (one LLM call, emits JDAnalysis + EligibilityVerdict)
  -> hard_block               -> logger -> END
  -> fit_ok=False             -> human_in_the_loop
  -> soft_block & !worth_it   -> human_in_the_loop
  -> otherwise                -> select_stories

human_in_the_loop  (stdin choice 1/2)
  -> proceed                  -> select_stories
  -> skip                     -> logger -> END

select_stories  (deterministic, per-company top-K)
  -> compose_resume_content   (one LLM call: summary + tailored bullets;
                              skills filled deterministically in same node)
  -> resume_editor            (docxtpl render of templates/resume_template.docx)
  -> pdf_converter            (libreoffice --headless --convert-to pdf)
  -> ats_score                (TF-IDF + keyword + section completeness)

ats_score
  -> pass                     -> logger -> END
  -> fail & retries left      -> compose_resume_content (loop)
  -> fail & exhausted         -> logger -> END (failed_validation)
```

Every routing function short-circuits to `logger` on `state.outcome == "error"`.

## Decisions locked (do not relitigate without a discussion)

- **Hard-screen** uses substring matching for fixed phrases (citizenship,
  clearance, ITAR, polygraph) and regex only for YoE extraction. Threshold
  in `data/personal_rules.yaml`. Semantics: `5+ years` ok, `6+ years` blocks.
- **One LLM call** for eligibility + JD analysis (shared input context;
  splitting them wastes tokens). Implemented as `EligibilityNodeOutput`.
- **HITL is invoked** when `fit_ok=False` OR (`soft_block=True` AND
  `worth_it=False`). Hard-blocks skip silently. Worth-it=true continues
  silently. HITL is only for borderline cases.
- **`select_stories` and `compose_resume_content` are separate nodes.**
  select_stories is deterministic (`0.7 * req_overlap + 0.3 * nice_overlap`
  on `story.skills | story.best_for`). Per-company top-K from
  `bullets_for_company`. Phase-2 upgrade path: hybrid (deterministic
  shortlist + AI fine-pick) or embeddings.
- **Skills section is deterministic.** Built inside `compose_resume_node`
  from the union of selected-story skills, ordered by JD priority,
  grouped via `data/skill_categories.yaml`.
- **ATS scoring**: 0.4 cosine + 0.4 keyword_coverage + 0.2 section_completeness.
  Threshold 0.75. Max 2 retries. Failure after retries = `failed_validation`,
  not HITL (deliberate; we do not block the user on every failure).
- **Cover letter is out of scope for v1.** Add as a parallel sub-graph later.
- **No URL fetching.** JD is provided as text via `--jd-file` or stdin.
- **Pydantic + structured output mode is mandatory** for every LLM call.
  Use `LLMClient.call_structured(...)` with a Pydantic schema; never parse
  free text.
- **Track everything natively.** `@track_node` captures latency, tokens,
  cost, success/error per node. Totals aggregated into the terminal
  `RunRecord` (JSONL at `runs/runs.jsonl`). LangSmith / Langfuse may be
  bolted on later; not required.
- **Verified-metrics gate.** All metrics in `data/story_bank.yaml` are
  treated as already verified. Do not re-introduce a `[VERIFY]` flag
  unless the user adds new unverified entries.

## Decisions explicitly deferred

- Story bank embeddings / ATS via embeddings (currently lexical TF-IDF).
- LangGraph `interrupt`-based HITL for non-CLI deployments (currently stdin).
- Cover letter sub-graph.
- Phase-2: fine-tuned model adapter behind the same `LLMClient` interface.
- LangSmith / Langfuse tracing integrations.

## File map (do not move without updating this doc)

```
data/                              YAML config, single source of truth
  story_bank.yaml                  the user's stories
  personal_rules.yaml              YoE threshold, blocker phrases, fit prefs
  skill_categories.yaml            skill -> category for skills section
  model_pricing.yaml               $ / 1k tokens, default model, per-node overrides

src/job_pipeline/
  schemas/                         Pydantic contracts (boundary types)
  nodes/                           one file per LangGraph node
  config.py                        loaders + tunables (paths, thresholds, K)
  llm.py                           Anthropic client w/ tool-use structured output
  instrumentation.py               @track_node decorator, ContextVar accumulator
  graph.py                         LangGraph wiring + routers
  main.py                          typer CLI
  evaluation/llm_judge.py          LLM-as-judge for pipeline vs Claude comparison

runs/runs.jsonl                    one RunRecord per invocation (gitignored)
runs/outputs/                      generated DOCX/PDF artifacts (gitignored)
templates/resume_template.docx     user-provided Jinja DOCX template
```

## Conventions

- Every node module exposes exactly one `*_node(state)` function decorated
  with `@track_node("...")`.
- Nodes return `dict` (state update); never mutate `state` in place.
- LLM nodes use `get_llm_client().call_structured(node_name=..., output_schema=...)`.
  The active node's tokens/cost are auto-recorded via the ContextVar set by
  `@track_node`.
- Skills, JD keywords, and `story.skills` tags use the same lowercase tag
  convention. When in doubt, lowercase before comparing.
- Routers must short-circuit on `state.outcome == "error"` to `"logger"`.

## Phase-2 swap-in (for future reference)

The fine-tuned model adapter must:
1. Implement the same `LLMClient.call_structured(node_name, system_prompt,
   user_prompt, output_schema, ...) -> Pydantic` signature.
2. Push token / cost / model into `current_node_metrics` (ContextVar) so
   instrumentation continues to work unchanged.
3. Be selectable via `get_model_for_node(node_name)` returning a model id
   that the adapter recognizes (e.g. a local Ollama/vLLM endpoint name).

The graph, schemas, and node bodies do not change in Phase 2.



# Frontend + deployment (Phase 1.5)

## Locked decisions

- **Hosting:** AWS Amplify Hosting Gen 2 on subdomain
  `resume.saichaitanyamuthyala.com` (Route 53 zone is the user's existing
  apex `saichaitanyamuthyala.com`, ACM cert auto-provisioned by Amplify).
- **Access mode:** **Option C + B combined.** Public read-only viewer for a
  curated set of past runs (B), plus a password-gated `/submit` page that
  triggers a live pipeline run (C). Same shared password gates both.
- **Cost protection:** shared password (env var, not in repo) + hard daily
  Anthropic spend cap enforced server-side + Cloudflare Turnstile or
  AWS WAF rate limit on `/api/runs`. Open access is explicitly rejected.
- **Stack:** Next.js 15 (App Router) + TypeScript + Tailwind v4 + shadcn/ui
  (components copied into repo, not vendored as a dep) + Motion +
  React Flow for the LangGraph state-machine visual.
- **Backend:** FastAPI app wrapped via Mangum, deployed as a Lambda
  Container Image behind API Gateway. Lambda is the right cost-shape for
  bursty single-user demo traffic.
- **Storage:** S3 for generated DOCX/PDF artifacts (presigned URLs for
  download, lifecycle rule deletes after 30 days); DynamoDB for run
  records (write on terminal node, read for the viewer).
- **HITL in deployed mode:** disabled. The CLI keeps full HITL behavior;
  the deployed pipeline (env `JOB_PIPELINE_DEPLOYED=true`) auto-decides
  `proceed` on every HITL invocation, treating "user submitted the JD via
  /submit" as implicit consent. The auto-decision is recorded in
  `node_metrics.extra.auto_decision_reason` so the trace stays auditable.
  A real HITL UI is deferred to a future iteration.
- **Visual direction:** clean technical / minimalist. White background with
  one accent color, mono headings, real metrics tables and code blocks
  as first-class UI elements. No animated gradient soup.
- **Repo layout:** monorepo. `frontend/` (Next.js), `backend/` (FastAPI
  Lambda handler), `infra/` (CDK), alongside the existing Python
  pipeline at `src/job_pipeline/`.

## Frontend pages

| Path | Auth | Purpose |
|---|---|---|
| `/` | public | Landing: hero, animated graph, how-it-works |
| `/login` | public | Password entry (sets HttpOnly cookie) |
| `/runs` | public | List of curated public runs (Option B) |
| `/runs/[id]` | public | Single run viewer with full metrics + downloads |
| `/submit` | password | JD form + live progress (Option C) |
| `/api/auth` | public | POST password -> set cookie |
| `/api/runs` | password | POST JD -> proxies to backend Lambda |
| `/api/runs/[id]` | password | GET run record from DynamoDB |

Public sample runs live as JSON in `frontend/public/sample-runs/`.
Real-user runs (when the live form is exercised) write to DynamoDB.

## Deployment-mode behaviors that DIFFER from CLI

- HITL node short-circuits to "skip" in deployed mode (env flag
  `JOB_PIPELINE_DEPLOYED=true`). CLI still asks the user.
- `logger_node` writes RunRecord to DynamoDB instead of (or in addition to)
  the local JSONL file when running on Lambda.
- `resume_editor` writes to `/tmp/<run_id>_resume.docx` then uploads to S3.
- `pdf_converter` uses a Lambda Layer with LibreOffice or a sidecar pattern.
  TBD; for v1 we may use a pure-Python DOCX-to-PDF path (e.g., docx2pdf
  with the `pdfkit`/`weasyprint` route from rendered HTML) to avoid
  packaging LibreOffice into the Lambda image.

## Things explicitly NOT in scope for the frontend PR

- Real-time SSE streaming of pipeline progress (poll the run record
  every 1.5s; upgrade to SSE later).
- Multi-tenant auth (Cognito). Single shared password is enough.
- Storybook / component testing harness.
- A11y deep-dive beyond shadcn primitives' built-ins.
