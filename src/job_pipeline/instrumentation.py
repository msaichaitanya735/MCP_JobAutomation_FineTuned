"""Per-node instrumentation: time, tokens, cost.

Each LangGraph node is wrapped with ``@track_node("name")``. The decorator:

1. Starts a stopwatch and a ``NodeMetricsAccumulator`` bound to a ContextVar.
2. Lets the node body run.
3. The LLM client (``llm.py``) reads the accumulator from the ContextVar
   and records token / model / cost when it makes API calls.
4. On exit, the decorator builds a ``NodeMetrics`` and merges it into the
   node's returned state-update dict (the LangGraph reducer appends it to
   ``state.node_metrics``).

Errors are caught and recorded as ``success=False``; the graph routes to
the logger via ``outcome='error'`` so we never lose telemetry on failure.
"""

from __future__ import annotations

import logging
from contextvars import ContextVar
from dataclasses import dataclass, field
from datetime import datetime, timezone
from functools import wraps
from typing import Callable, TypeVar

from job_pipeline.schemas import GraphState, NodeMetrics

logger = logging.getLogger(__name__)

NodeFn = Callable[[GraphState], dict]
F = TypeVar("F", bound=NodeFn)


@dataclass
class NodeMetricsAccumulator:
    """Mutable scratch space for in-flight node metrics."""

    node_name: str
    tokens_in: int = 0
    tokens_out: int = 0
    cost_usd: float = 0.0
    model: str | None = None
    extra: dict[str, object] = field(default_factory=dict)

    def record_llm_call(
        self,
        *,
        tokens_in: int,
        tokens_out: int,
        model: str,
        cost_usd: float,
    ) -> None:
        self.tokens_in += tokens_in
        self.tokens_out += tokens_out
        self.cost_usd += cost_usd
        self.model = model


current_node_metrics: ContextVar[NodeMetricsAccumulator | None] = ContextVar(
    "current_node_metrics",
    default=None,
)


def track_node(node_name: str) -> Callable[[F], F]:
    """Decorator: wrap a node fn so its metrics flow into state.node_metrics.

    Nodes return a dict of state updates; this decorator augments that dict
    with ``node_metrics`` (single-element list, appended via reducer) and
    ``path_taken`` (single-element list, appended via reducer).
    """

    def decorator(fn: F) -> F:
        @wraps(fn)
        def wrapper(state: GraphState) -> dict:
            acc = NodeMetricsAccumulator(node_name=node_name)
            ctx_token = current_node_metrics.set(acc)
            started = datetime.now(timezone.utc)
            try:
                result = fn(state)
                if not isinstance(result, dict):
                    raise TypeError(
                        f"Node {node_name!r} returned {type(result).__name__}; expected dict."
                    )
                ended = datetime.now(timezone.utc)
                metrics = NodeMetrics(
                    node_name=node_name,
                    started_at=started,
                    ended_at=ended,
                    latency_ms=(ended - started).total_seconds() * 1000.0,
                    tokens_in=acc.tokens_in,
                    tokens_out=acc.tokens_out,
                    cost_usd=acc.cost_usd,
                    model=acc.model,
                    success=True,
                    extra=acc.extra,
                )
                merged = dict(result)
                # Reducer fields: provide single-element lists so add() appends.
                merged["node_metrics"] = [*merged.get("node_metrics", []), metrics]
                merged["path_taken"] = [*merged.get("path_taken", []), node_name]
                return merged
            except Exception as exc:  # noqa: BLE001 - capture for logging
                ended = datetime.now(timezone.utc)
                logger.exception("Node %s failed", node_name)
                metrics = NodeMetrics(
                    node_name=node_name,
                    started_at=started,
                    ended_at=ended,
                    latency_ms=(ended - started).total_seconds() * 1000.0,
                    tokens_in=acc.tokens_in,
                    tokens_out=acc.tokens_out,
                    cost_usd=acc.cost_usd,
                    model=acc.model,
                    success=False,
                    error=f"{type(exc).__name__}: {exc}",
                    extra=acc.extra,
                )
                return {
                    "node_metrics": [metrics],
                    "path_taken": [node_name],
                    "outcome": "error",
                    "error_message": f"{node_name}: {exc}",
                }
            finally:
                current_node_metrics.reset(ctx_token)

        return wrapper  # type: ignore[return-value]

    return decorator


def aggregate_totals(metrics_list: list[NodeMetrics]) -> dict[str, float | int]:
    """Sum metrics across a run for the final RunRecord."""
    return {
        "total_latency_ms": sum(m.latency_ms for m in metrics_list),
        "total_tokens_in": sum(m.tokens_in for m in metrics_list),
        "total_tokens_out": sum(m.tokens_out for m in metrics_list),
        "total_cost_usd": sum(m.cost_usd for m in metrics_list),
    }
