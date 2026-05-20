import * as path from "node:path";
import * as cdk from "aws-cdk-lib";
import { Construct } from "constructs";
import * as lambda from "aws-cdk-lib/aws-lambda";
import * as dynamodb from "aws-cdk-lib/aws-dynamodb";
import * as s3 from "aws-cdk-lib/aws-s3";
import * as apigwv2 from "aws-cdk-lib/aws-apigatewayv2";
import * as integrations from "aws-cdk-lib/aws-apigatewayv2-integrations";
import * as logs from "aws-cdk-lib/aws-logs";

export interface PipelineBackendStackProps extends cdk.StackProps {
  stage: string;
  anthropicApiKey: string;
  backendApiKey: string;
  /** Origin allowed by CORS (the frontend Amplify URL). */
  amplifyOrigin: string;
}

export class PipelineBackendStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props: PipelineBackendStackProps) {
    super(scope, id, props);

    // -----------------------------------------------------------------------
    // DynamoDB: RunRecord storage.
    // -----------------------------------------------------------------------
    const runsTable = new dynamodb.Table(this, "RunsTable", {
      tableName: `JobPipelineRuns-${props.stage}`,
      partitionKey: { name: "run_id", type: dynamodb.AttributeType.STRING },
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      pointInTimeRecovery: true,
      removalPolicy: cdk.RemovalPolicy.RETAIN,
    });

    // -----------------------------------------------------------------------
    // S3: generated DOCX / PDF artifacts.
    // -----------------------------------------------------------------------
    const artifactsBucket = new s3.Bucket(this, "ArtifactsBucket", {
      bucketName: undefined, // let CDK choose a unique name
      encryption: s3.BucketEncryption.S3_MANAGED,
      blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
      enforceSSL: true,
      removalPolicy: cdk.RemovalPolicy.RETAIN,
      lifecycleRules: [
        {
          id: "ExpireArtifactsAfter30Days",
          enabled: true,
          expiration: cdk.Duration.days(30),
          // Sample runs are static and live in the frontend repo, so we don't
          // need to keep the live runs forever.
        },
      ],
      cors: [
        {
          allowedMethods: [s3.HttpMethods.GET],
          allowedOrigins: [props.amplifyOrigin, "http://localhost:3000"],
          allowedHeaders: ["*"],
          maxAge: 3000,
        },
      ],
    });

    // -----------------------------------------------------------------------
    // Lambda: backend container image (FastAPI + LangGraph pipeline).
    // -----------------------------------------------------------------------
    // Build context is the repo root so the Dockerfile can COPY both
    // src/job_pipeline/ and backend/.
    const repoRoot = path.resolve(__dirname, "..", "..");

    const backendFn = new lambda.DockerImageFunction(this, "BackendFn", {
      functionName: `JobPipelineBackend-${props.stage}`,
      code: lambda.DockerImageCode.fromImageAsset(repoRoot, {
        file: "backend/Dockerfile",
        // No build args for v1; add here if we need conditional inclusion.
      }),
      // Pipeline runs include sklearn + numpy; 2 GB keeps us comfortable.
      memorySize: 2048,
      timeout: cdk.Duration.minutes(5),
      logRetention: logs.RetentionDays.ONE_MONTH,
      environment: {
        // Pipeline runtime
        ANTHROPIC_API_KEY: props.anthropicApiKey,
        JOB_PIPELINE_DEPLOYED: "true",
        // Auth
        BACKEND_API_KEY: props.backendApiKey,
        // AWS resources
        RUNS_TABLE: runsTable.tableName,
        ARTIFACTS_BUCKET: artifactsBucket.bucketName,
        ARTIFACTS_PREFIX: "runs/",
      },
    });

    runsTable.grantReadWriteData(backendFn);
    artifactsBucket.grantReadWrite(backendFn);

    // -----------------------------------------------------------------------
    // API Gateway: HTTP API in front of the Lambda.
    // -----------------------------------------------------------------------
    const httpApi = new apigwv2.HttpApi(this, "BackendApi", {
      apiName: `job-pipeline-${props.stage}`,
      defaultIntegration: new integrations.HttpLambdaIntegration(
        "DefaultIntegration",
        backendFn
      ),
      corsPreflight: {
        allowMethods: [
          apigwv2.CorsHttpMethod.GET,
          apigwv2.CorsHttpMethod.POST,
          apigwv2.CorsHttpMethod.OPTIONS,
        ],
        allowHeaders: ["Content-Type", "Authorization"],
        allowOrigins: [props.amplifyOrigin, "http://localhost:3000"],
        maxAge: cdk.Duration.hours(1),
      },
    });

    // -----------------------------------------------------------------------
    // Outputs
    // -----------------------------------------------------------------------
    new cdk.CfnOutput(this, "ApiUrl", {
      value: httpApi.apiEndpoint,
      description:
        "Set this in the Amplify env as NEXT_PUBLIC_BACKEND_URL " +
        "(without trailing slash).",
    });

    new cdk.CfnOutput(this, "RunsTableName", {
      value: runsTable.tableName,
    });

    new cdk.CfnOutput(this, "ArtifactsBucketName", {
      value: artifactsBucket.bucketName,
    });

    new cdk.CfnOutput(this, "BackendFunctionName", {
      value: backendFn.functionName,
    });
  }
}
