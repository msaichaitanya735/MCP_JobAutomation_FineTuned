# Lambda container image for the agentic resume pipeline backend.
#
# Built from the AWS Lambda Python 3.11 base. The image vendors the
# `job_pipeline` package (the pipeline source) alongside the FastAPI
# handler. Triggered by API Gateway via Mangum.
#
# Build context is the REPO ROOT so we can COPY both backend/ and
# src/job_pipeline/ into the image:
#
#   docker build -f backend/Dockerfile -t job-pipeline-backend .

FROM public.ecr.aws/lambda/python:3.11

# Pipeline source (so `from job_pipeline.graph import build_graph` resolves).
COPY src/job_pipeline ${LAMBDA_TASK_ROOT}/job_pipeline

# Pipeline data (story bank, personal rules, skill categories, model pricing).
COPY data ${LAMBDA_TASK_ROOT}/data

# Backend handler files.
COPY backend/requirements.txt ${LAMBDA_TASK_ROOT}/requirements.txt
COPY backend/handler.py        ${LAMBDA_TASK_ROOT}/handler.py
COPY backend/persistence.py    ${LAMBDA_TASK_ROOT}/persistence.py
COPY backend/storage.py        ${LAMBDA_TASK_ROOT}/storage.py

# Python deps. --no-cache-dir keeps the image small.
RUN pip install --no-cache-dir -r ${LAMBDA_TASK_ROOT}/requirements.txt

# Mangum entrypoint: <module>.<callable>.
CMD ["handler.handler"]
