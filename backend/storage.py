"""S3 helpers for the deployed pipeline.

Generated DOCX (and PDF when LibreOffice is available locally) live on
``/tmp`` inside the Lambda. After the pipeline finishes we upload them to
S3 and substitute presigned URLs into the ``RunRecord`` so the frontend
``Download`` buttons work.

Configured via two env vars:
* ``ARTIFACTS_BUCKET``  - bucket to upload to (required in deployed mode)
* ``ARTIFACTS_PREFIX``  - optional key prefix, e.g. ``runs/`` (default ``runs/``)

If ``ARTIFACTS_BUCKET`` is not set, helpers no-op (local dev mode).
"""

from __future__ import annotations

import logging
import os
from pathlib import Path

import boto3

logger = logging.getLogger(__name__)

PRESIGNED_TTL_SEC = 60 * 60 * 24 * 7  # 7 days

_s3 = None


def _client():
    global _s3
    if _s3 is None:
        _s3 = boto3.client("s3")
    return _s3


def _bucket() -> str | None:
    return os.environ.get("ARTIFACTS_BUCKET")


def _prefix() -> str:
    return os.environ.get("ARTIFACTS_PREFIX", "runs/").rstrip("/") + "/"


def upload_artifact(local_path: str | None) -> str | None:
    """Upload a /tmp file to S3 and return a presigned GET URL.

    Returns the input path unchanged when S3 is not configured, so local
    dev keeps working with file:// paths.
    """
    if not local_path:
        return None
    bucket = _bucket()
    if not bucket:
        return local_path

    src = Path(local_path)
    if not src.exists() or not src.is_file():
        logger.warning("storage.upload_artifact: %s does not exist", local_path)
        return None

    key = f"{_prefix()}{src.name}"
    try:
        _client().upload_file(str(src), bucket, key)
    except Exception as exc:  # noqa: BLE001
        logger.exception("S3 upload failed for %s -> s3://%s/%s", src, bucket, key)
        return None

    try:
        url = _client().generate_presigned_url(
            "get_object",
            Params={"Bucket": bucket, "Key": key},
            ExpiresIn=PRESIGNED_TTL_SEC,
        )
    except Exception as exc:  # noqa: BLE001
        logger.exception("Could not presign s3://%s/%s", bucket, key)
        return None

    return url
