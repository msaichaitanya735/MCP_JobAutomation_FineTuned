# Deployment

End-to-end deployment of the agentic resume pipeline to a public,
password-gated subdomain on `saichaitanyamuthyala.com`.

This guide covers the parts I cannot do for you (clicking AWS console
buttons). Every command is meant to be copy-pasted as-is once you've
exported the variables in step 1.

## Architecture

```
                              www.saichaitanyamuthyala.com    (existing apex)
                                            │
                                            ▼
              resume.saichaitanyamuthyala.com   (new subdomain)
                                            │
                                            ▼
              ┌───────────────────────────────────────────────┐
              │  AWS Amplify Hosting   (Next.js 15 SSR)       │
              │  - frontend/   (this repo, monorepo build)    │
              │  - cookie-based password gate (HMAC session)  │
              │  - sample runs (Option B) read from           │
              │    frontend/data/sample-runs/*.json           │
              └───────────────────┬───────────────────────────┘
                                  │  POST /api/runs   (gated by middleware)
                                  ▼
              ┌───────────────────────────────────────────────┐
              │  AWS API Gateway HTTP API                     │
              │  - CORS allowlist: resume.saichaitanyamuthyala│
              │  - Forwards to Lambda; CloudWatch logs        │
              └───────────────────┬───────────────────────────┘
                                  ▼
              ┌───────────────────────────────────────────────┐
              │  AWS Lambda  (Container Image)                │
              │  - backend/Dockerfile + src/job_pipeline      │
              │  - FastAPI + LangGraph pipeline               │
              │  - Bearer auth: BACKEND_API_KEY               │
              │  - HITL auto-proceed in deployed mode         │
              └────────────┬─────────────────────┬────────────┘
                           ▼                     ▼
                  ┌────────────────┐    ┌────────────────────┐
                  │  DynamoDB      │    │  S3 (artifacts)    │
                  │  RunRecords    │    │  DOCX/PDF, 30-day  │
                  └────────────────┘    └────────────────────┘
```

## Prerequisites

- AWS account with permissions for IAM, Lambda, API Gateway, DynamoDB,
  S3, CloudFormation, and ECR (CDK pushes the Lambda image to ECR).
- `saichaitanyamuthyala.com` already in Route 53 as a hosted zone.
- An Anthropic API key (`sk-ant-...`).
- Local tooling:
  - Node 20+ (`node --version`)
  - Docker (running, for CDK to build the Lambda image)
  - Python 3.11+ (for local CLI use; not required for deployment)
  - AWS CLI v2, configured: `aws configure`
  - AWS CDK v2: `npm i -g aws-cdk`

## Step 1 — Generate secrets

Generate three random secrets locally. Treat all three like passwords;
do not commit them.

```bash
export DEMO_PASSWORD="$(openssl rand -base64 24)"
export AUTH_COOKIE_SECRET="$(openssl rand -hex 32)"
export BACKEND_API_KEY="$(openssl rand -hex 32)"
export ANTHROPIC_API_KEY="sk-ant-..."           # paste your real key
export AMPLIFY_ORIGIN="https://resume.saichaitanyamuthyala.com"
```

Save these somewhere (1Password, AWS Secrets Manager, etc.). You will
paste them into Amplify env vars in step 3, and the same values must
match between Amplify and the Lambda.

## Step 2 — Deploy the backend (CDK)

The CDK stack provisions Lambda + API Gateway + DynamoDB + S3, and
prints the URL the frontend needs.

```bash
cd infra
npm install

# First time only, in the target account/region:
npx cdk bootstrap aws://$AWS_ACCOUNT_ID/us-east-1

# Deploy. Uses ANTHROPIC_API_KEY and BACKEND_API_KEY from env.
npx cdk deploy
```

The deploy takes ~6-10 minutes (mostly the docker image build + push).

**Save the four output values printed at the end:**

```
JobPipelineBackend-prod.ApiUrl                   = https://abcd1234.execute-api.us-east-1.amazonaws.com
JobPipelineBackend-prod.RunsTableName            = JobPipelineRuns-prod
JobPipelineBackend-prod.ArtifactsBucketName      = jobpipelinebackend-prod-artifactsbucket-...
JobPipelineBackend-prod.BackendFunctionName      = JobPipelineBackend-prod
```

Quick sanity check:

```bash
curl "https://abcd1234.execute-api.us-east-1.amazonaws.com/healthz"
# {"status":"ok","service":"job-pipeline-backend"}
```

If you see `{"message":"Forbidden"}` you copied the URL wrong (it should
NOT have a trailing slash and should NOT include `/prod` — HTTP APIs
don't add a stage by default).

## Step 3 — Deploy the frontend (Amplify Hosting)

You'll do this once in the AWS Amplify console, then it auto-builds on
every push to your default branch.

1. Console → **AWS Amplify** → **Create new app** → **Host web app**.
2. Choose **GitHub**, authorize Amplify, pick
   `msaichaitanya735/MCP_JobAutomation_FineTuned`, branch `main`.
3. **App name:** `agentic-resume-pipeline`.
4. **Monorepo settings:** check "My app is a monorepo", **app root:** `frontend`.
5. **Build settings:** Amplify will auto-detect `frontend/amplify.yml`.
   Confirm it shows `npm ci && npm run build`.
6. **Environment variables** — paste these (the values from step 1, plus
   the API URL from step 2):

   | Key | Value |
   |---|---|
   | `DEMO_PASSWORD` | (from step 1) |
   | `AUTH_COOKIE_SECRET` | (from step 1) |
   | `BACKEND_API_KEY` | (from step 1, same as Lambda) |
   | `NEXT_PUBLIC_BACKEND_URL` | API URL from step 2 (no trailing slash) |
   | `JOB_PIPELINE_DEPLOYED` | `true` |

7. **Deploy.** First build takes ~3-5 minutes.
8. Confirm the temporary URL works
   (`https://main.<random>.amplifyapp.com`). You should see the landing
   page; `/login` should accept your `DEMO_PASSWORD`; `/submit` should
   reach the Lambda.

## Step 4 — Connect the custom domain

1. In the Amplify app sidebar → **Domain management** → **Add domain**.
2. **Domain:** `saichaitanyamuthyala.com`. Amplify auto-detects the
   Route 53 hosted zone.
3. **Subdomain configuration:**
   - Add subdomain `resume` → branch `main`.
   - Leave the apex (`@`) untouched if your existing site lives there.
4. Save. Amplify provisions an ACM cert via DNS validation in Route 53;
   the records are added automatically. Wait ~5–15 minutes for cert
   issuance and DNS propagation.
5. Verify: `https://resume.saichaitanyamuthyala.com` should serve the
   landing page over a valid cert.

## Step 5 — Lock CORS to the real origin

Right after step 4 you may want to remove `localhost:3000` from the API
Gateway CORS allowlist for production. Edit
`infra/lib/pipeline-stack.ts`:

```ts
allowOrigins: [props.amplifyOrigin],   // drop localhost
```

Then `cd infra && npx cdk deploy` to roll the change.

## Verifying the full path

1. `https://resume.saichaitanyamuthyala.com` → landing page renders, the
   pipeline graph loops through the happy path.
2. `/runs` → three sample runs visible, each clickable.
3. `/runs/01_applied_fde` → graph shows the trace path with real
   per-node latency / tokens / cost; downloads links present.
4. `/login` → enter your `DEMO_PASSWORD` → redirects to `/submit`.
5. `/submit` → paste a real JD → click **run pipeline**. Wait
   25–90 seconds. The result view appears with the new RunRecord and
   live download buttons (presigned S3 URLs).
6. Open CloudWatch Logs for the Lambda; you should see the request, the
   pipeline node-by-node logs, and the persistence + S3 upload calls.

## Operations

```bash
# Tail backend logs
aws logs tail /aws/lambda/JobPipelineBackend-prod --follow

# Inspect a run from DynamoDB
aws dynamodb get-item --table-name JobPipelineRuns-prod \
  --key '{"run_id":{"S":"<run_id>"}}'

# List artifacts
aws s3 ls "s3://<artifacts-bucket>/runs/"

# Cost check (estimated monthly spend, scoped to AI-related services)
aws ce get-cost-and-usage --time-period Start=2026-05-01,End=2026-06-01 \
  --granularity MONTHLY --metrics BlendedCost \
  --filter '{"Dimensions":{"Key":"SERVICE","Values":["Amazon API Gateway","AWS Lambda","Amazon DynamoDB","Amazon S3"]}}'
```

## Tear-down

The DynamoDB table and S3 bucket are `RemovalPolicy.RETAIN`. To fully
clean:

```bash
cd infra
npx cdk destroy

# Then manually:
aws s3 rm "s3://<artifacts-bucket>" --recursive
aws s3 rb "s3://<artifacts-bucket>"
aws dynamodb delete-table --table-name JobPipelineRuns-prod
```

In the Amplify console: delete the app and remove the `resume`
subdomain from Route 53.

## Troubleshooting

**Amplify build fails on `npm ci`.** Verify that the build settings
treat `frontend/` as the app root and that `frontend/package-lock.json`
is committed (run `npm install` once locally and commit the lockfile).

**`/login` accepts the password but `/submit` 500s.** Almost always a
mismatch in `BACKEND_API_KEY` between Amplify and the Lambda. Re-deploy
the Lambda with the same key the frontend has.

**Lambda cold start takes 15+ seconds.** Expected on the first
invocation per warm container due to image size. Set provisioned
concurrency in `infra/lib/pipeline-stack.ts` if this matters for the
demo, but it adds cost.

**`/submit` returns 502 backend_unreachable.** Check
`NEXT_PUBLIC_BACKEND_URL` in Amplify env vars; should match the API
Gateway endpoint exactly with no trailing slash.

**PDF download is missing.** The deployed Lambda has no LibreOffice
bundled, so it returns DOCX only. Add LibreOffice to the Dockerfile
(adds ~500 MB) or wire a separate PDF-conversion service if PDF in the
deployed flow is required.

## Why the architecture is what it is

If an interviewer asks (and they will): the design is documented in
[`.kiro/steering/architecture.md`](../.kiro/steering/architecture.md).
The short version is the project's guiding principle:

> AI does judgment. Code does determinism.
