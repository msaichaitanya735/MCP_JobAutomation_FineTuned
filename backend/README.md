# backend

FastAPI handler that wraps the LangGraph resume pipeline and runs as a
Lambda Container Image.

## Layout

```
backend/
├── handler.py          FastAPI app + Mangum entrypoint
├── persistence.py      DynamoDB save / load (RunRecord)
├── storage.py          S3 upload + presigned URLs for artifacts
├── requirements.txt    Pinned deps for the Lambda image
└── Dockerfile          Lambda Python 3.11 base; vendors src/job_pipeline
```

The Dockerfile expects to be built from the **repo root** so it can
COPY both `backend/` and `src/job_pipeline/`:

```bash
docker build -f backend/Dockerfile -t job-pipeline-backend .
```

## Endpoints

| Method | Path             | Auth     | Description |
|--------|------------------|----------|-------------|
| GET    | `/healthz`       | none     | Liveness probe. |
| POST   | `/runs`          | bearer   | Run pipeline against `{jd_text}`. Returns `RunRecord & {persisted:bool}`. |
| GET    | `/runs/{run_id}` | bearer   | Fetch persisted RunRecord by id. |

Auth is a shared bearer token in `BACKEND_API_KEY`. The Next.js
`/api/runs` route forwards it on every proxied request.

## Env vars

| Name | Required? | Purpose |
|---|---|---|
| `BACKEND_API_KEY` | prod | Bearer token gate for the API. |
| `ANTHROPIC_API_KEY` | prod | Pipeline LLM calls. |
| `RUNS_TABLE` | prod | DynamoDB table name for run records. |
| `ARTIFACTS_BUCKET` | prod | S3 bucket for generated DOCX / PDF. |
| `ARTIFACTS_PREFIX` | optional | Key prefix (default `runs/`). |
| `JOB_PIPELINE_DEPLOYED` | prod | `true` disables stdin HITL; HITL auto-proceeds. |
| `RESUME_TEMPLATE_PATH` | optional | Override default `/var/task/templates/resume_template.docx`. |

All set automatically by the CDK stack in `infra/`.

## Local invocation

```bash
pip install -r requirements.txt
uvicorn handler:app --reload --port 8080

# Then from another shell:
curl -X POST http://localhost:8080/runs \
  -H 'content-type: application/json' \
  -d '{"jd_text": "AI Engineer ... Python, LangGraph, ..."}'
```

Without `RUNS_TABLE` / `ARTIFACTS_BUCKET` set the handler runs end-to-end
locally — DynamoDB and S3 helpers no-op and the response just includes
the in-memory RunRecord.
