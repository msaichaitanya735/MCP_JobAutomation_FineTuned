# infra

AWS CDK (TypeScript) stack for the agentic resume pipeline backend.

## What it provisions

| Resource | Purpose |
|---|---|
| Lambda (Container Image) | `backend/Dockerfile`. FastAPI + LangGraph pipeline. |
| API Gateway HTTP API | Public HTTPS endpoint, CORS allowlisted to the Amplify origin. |
| DynamoDB table | RunRecord persistence. Pay-per-request, PITR on. |
| S3 bucket | Generated DOCX / PDF artifacts. SSE, block-public, 30-day lifecycle. |
| CloudWatch Logs (1 month) | Lambda logs. |

The Lambda's env vars `BACKEND_API_KEY`, `ANTHROPIC_API_KEY`, `RUNS_TABLE`,
`ARTIFACTS_BUCKET`, and `JOB_PIPELINE_DEPLOYED=true` are set by the stack.

## Prerequisites

- AWS CDK v2 CLI (`npm i -g aws-cdk`)
- Docker (CDK builds the Lambda image locally)
- AWS account bootstrapped: `npx cdk bootstrap aws://ACCOUNT/REGION`

## Deploy

```bash
cd infra
npm install

# Pass secrets via env or --context. Don't commit them.
export ANTHROPIC_API_KEY=sk-ant-...
export BACKEND_API_KEY="$(openssl rand -hex 32)"
# Optional: override CORS origin
export AMPLIFY_ORIGIN=https://resume.saichaitanyamuthyala.com

npx cdk deploy
```

The deploy prints four outputs:

- `ApiUrl` — set as `NEXT_PUBLIC_BACKEND_URL` in Amplify env.
- `RunsTableName` — for monitoring / manual reads.
- `ArtifactsBucketName` — for monitoring / manual reads.
- `BackendFunctionName` — for log tailing: `aws logs tail /aws/lambda/<name> --follow`.

## Update vs replace

`runsTable` and `artifactsBucket` use `RemovalPolicy.RETAIN`, so a `cdk
destroy` will NOT delete persisted runs or artifacts. To clean fully,
empty the bucket and delete the table by hand after destroy.

## CORS / origin notes

The HTTP API only allows `AMPLIFY_ORIGIN` and `http://localhost:3000`.
Add additional origins in `lib/pipeline-stack.ts > corsPreflight.allowOrigins`
if you need preview URLs.
