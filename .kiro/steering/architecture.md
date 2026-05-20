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
