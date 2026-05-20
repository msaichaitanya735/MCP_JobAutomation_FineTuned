"""FastAPI Lambda handler wrapping the LangGraph resume pipeline.

Endpoints
---------
``GET  /healthz``         - basic liveness probe.
``POST /runs``            - run the pipeline against a JD, return RunRecord.
``GET  /runs/{run_id}``   - fetch a previously persisted RunRecord.

Auth
----
A shared bearer token (``BACKEND_API_KEY``) gates every non-health
endpoint. The Next.js Lambda forwards it on every proxied request. If
the env var is unset, auth is skipped (used only for local dev /
container shell debugging).

Deployment notes
----------------
* HITL is disabled at runtime via ``JOB_PIPELINE_DEPLOYED=true`` set by
  the CDK stack. The pipeline node auto-decides ``proceed`` instead of
  prompting on stdin.
* Generated DOCX/PDF artifacts on ``/tmp`` are uploaded to S3 and
  presigned-URL paths are substituted into the response.
* Pipeline state is persisted to DynamoDB via ``persistence.save_run_record``.
"""

from __future__ import annotations

import logging
import os
import uuid
from datetime import datetime, timezone

from fastapi import FastAPI, Header, HTTPException
from mangum import Mangum
from pydantic import BaseModel, Field

# Imports from the vendored pipeline package and local sibling modules.
# /var/task is on sys.path inside the Lambda image.
from job_pipeline.graph import build_graph
from job_pipeline.instrumentation import aggregate_totals
from job_pipeline.schemas import GraphState, RunRecord

import persistence
import storage

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

app = FastAPI(title="agentic resume pipeline backend", version="0.1.0")

# Build the graph once per warm container; LangGraph compile is non-trivial.
GRAPH = build_graph()

JD_EXCERPT_LEN = 240


class SubmitBody(BaseModel):
    jd_text: str = Field(min_length=1, max_length=50_000)


# ---------------------------------------------------------------------------
# Routes
# ---------------------------------------------------------------------------


@app.get("/healthz")
async def healthz() -> dict[str, str]:
    return {"status": "ok", "service": "job-pipeline-backend"}


@app.post("/runs")
async def submit_run(
    body: SubmitBody,
    authorization: str | None = Header(default=None),
) -> dict:
    _check_auth(authorization)

    run_id = uuid.uuid4().hex[:12]
    initial = GraphState(
        jd_text=body.jd_text,
        base_resume_template_path=os.environ.get(
            "RESUME_TEMPLATE_PATH",
            "/var/task/templates/resume_template.docx",
        ),
        run_id=run_id,
        started_at=datetime.now(timezone.utc),
    )

    try:
        final = GRAPH.invoke(initial)
    except Exception as exc:  # noqa: BLE001
        logger.exception("graph.invoke failed for run %s", run_id)
        raise HTTPException(
            status_code=500, detail=f"pipeline error: {exc}"
        ) from exc

    state = (
        final
        if isinstance(final, GraphState)
        else GraphState.model_validate(final)
    )

    # Upload generated artifacts to S3 and replace paths with presigned URLs.
    pdf_url = storage.upload_artifact(state.rendered_pdf_path)
    docx_url = storage.upload_artifact(state.rendered_docx_path)

    record = _build_run_record(state, pdf_url=pdf_url, docx_url=docx_url)
    persisted = persistence.save_run_record(record)

    return {
        **record.model_dump(mode="json"),
        # The frontend uses this to decide whether to show the
        # "permanent link" button on the result view.
        "persisted": persisted,
    }


@app.get("/runs/{run_id}")
async def get_run(
    run_id: str,
    authorization: str | None = Header(default=None),
) -> dict:
    _check_auth(authorization)

    record = persistence.load_run_record(run_id)
    if record is None:
        raise HTTPException(status_code=404, detail="run not found")

    return {**record.model_dump(mode="json"), "persisted": True}


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------


def _check_auth(header: str | None) -> None:
    expected = os.environ.get("BACKEND_API_KEY")
    if not expected:
        # No key configured: local dev only. Production CDK sets this.
        return
    if not header or not header.lower().startswith("bearer "):
        raise HTTPException(status_code=401, detail="missing bearer token")
    provided = header.split(None, 1)[1].strip()
    # Constant-time-ish compare via hmac.compare_digest.
    import hmac

    if not hmac.compare_digest(provided, expected):
        raise HTTPException(status_code=403, detail="invalid token")


def _build_run_record(
    state: GraphState,
    *,
    pdf_url: str | None,
    docx_url: str | None,
) -> RunRecord:
    totals = aggregate_totals(state.node_metrics)
    return RunRecord(
        run_id=state.run_id,
        timestamp=datetime.now(timezone.utc),
        jd_excerpt=state.jd_text[:JD_EXCERPT_LEN].strip(),
        company=state.jd_analysis.company if state.jd_analysis else None,
        role_title=state.jd_analysis.role_title if state.jd_analysis else None,
        outcome=state.outcome or "error",
        skip_reason=state.skip_reason,
        path_taken=list(state.path_taken),
        eligibility_verdict=state.eligibility_verdict,
        hitl_triggered=state.hitl_triggered,
        hitl_decision=state.user_decision,
        rendered_pdf_path=pdf_url,
        ats_score=state.ats_score,
        node_metrics=list(state.node_metrics),
        **totals,
    )


# Mangum adapter: the value of CMD in the Dockerfile is `handler.handler`.
handler = Mangum(app, lifespan="off")
