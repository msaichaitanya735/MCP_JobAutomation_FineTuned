#!/usr/bin/env node
import "source-map-support/register";
import * as cdk from "aws-cdk-lib";
import { PipelineBackendStack } from "../lib/pipeline-stack";

const app = new cdk.App();

/**
 * Single stack for the Lambda backend + supporting AWS resources.
 *
 * Required context / env vars (pass via `--context key=value` or env):
 *   ANTHROPIC_API_KEY     (required at deploy time; injected as Lambda env)
 *   BACKEND_API_KEY       (required; bearer token shared with frontend)
 *   AMPLIFY_ORIGIN        (optional; CORS origin, defaults to localhost+
 *                          resume.saichaitanyamuthyala.com)
 *   STAGE                 (optional; defaults to "prod")
 */

const stage = app.node.tryGetContext("STAGE") ?? process.env.STAGE ?? "prod";
const anthropicKey =
  app.node.tryGetContext("ANTHROPIC_API_KEY") ?? process.env.ANTHROPIC_API_KEY;
const backendKey =
  app.node.tryGetContext("BACKEND_API_KEY") ?? process.env.BACKEND_API_KEY;
const amplifyOrigin =
  app.node.tryGetContext("AMPLIFY_ORIGIN") ??
  process.env.AMPLIFY_ORIGIN ??
  "https://resume.saichaitanyamuthyala.com";

if (!anthropicKey) {
  throw new Error(
    "ANTHROPIC_API_KEY must be set. Pass --context ANTHROPIC_API_KEY=... or export the env var."
  );
}
if (!backendKey) {
  throw new Error(
    "BACKEND_API_KEY must be set. Pass --context BACKEND_API_KEY=... or export the env var."
  );
}

new PipelineBackendStack(app, `JobPipelineBackend-${stage}`, {
  env: {
    account: process.env.CDK_DEFAULT_ACCOUNT,
    region: process.env.CDK_DEFAULT_REGION ?? "us-east-1",
  },
  stage,
  anthropicApiKey: anthropicKey,
  backendApiKey: backendKey,
  amplifyOrigin,
  description:
    "Agentic resume pipeline: Lambda + API Gateway + DynamoDB + S3.",
});
