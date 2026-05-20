"""DynamoDB persistence for RunRecord.

Stores each record as a single JSON blob plus a few searchable top-level
attributes (run_id, timestamp, outcome, company). Cheap, schemaless,
pleasant to query for the small list/get usage we need from the frontend.

Configured via env vars:
* ``RUNS_TABLE`` - DynamoDB table name (required in deployed mode)

If unset, helpers no-op (local dev mode).
"""

from __future__ import annotations

import json
import logging
import os

import boto3

from job_pipeline.schemas import RunRecord

logger = logging.getLogger(__name__)

_table = None


def _table_handle():
    global _table
    if _table is None:
        name = os.environ.get("RUNS_TABLE")
        if not name:
            return None
        _table = boto3.resource("dynamodb").Table(name)
    return _table


def save_run_record(record: RunRecord) -> bool:
    table = _table_handle()
    if table is None:
        return False
    try:
        table.put_item(
            Item={
                "run_id": record.run_id,
                "timestamp": record.timestamp.isoformat(),
                "outcome": record.outcome,
                "company": record.company or "—",
                "role_title": record.role_title or "—",
                "record_json": record.model_dump_json(),
            }
        )
        return True
    except Exception:  # noqa: BLE001
        logger.exception("DynamoDB put_item failed for %s", record.run_id)
        return False


def load_run_record(run_id: str) -> RunRecord | None:
    table = _table_handle()
    if table is None:
        return None
    try:
        resp = table.get_item(Key={"run_id": run_id})
    except Exception:  # noqa: BLE001
        logger.exception("DynamoDB get_item failed for %s", run_id)
        return None
    item = resp.get("Item")
    if not item:
        return None
    raw = item.get("record_json")
    if not raw:
        return None
    try:
        return RunRecord.model_validate_json(raw)
    except Exception:  # noqa: BLE001
        logger.exception("Failed to validate stored record for %s", run_id)
        return None
