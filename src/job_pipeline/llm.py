"""Anthropic client with structured-output mode and usage capture.

Uses Anthropic's tool-use facility to force the model to emit a payload
matching a Pydantic schema, then validates and returns a typed instance.

Token usage and cost are pushed into the active node's
``NodeMetricsAccumulator`` (set by the ``@track_node`` decorator) so every
LLM call is automatically reflected in per-node telemetry.

Phase 2 plan: swap ``LLMClient`` for a fine-tuned local-model adapter that
implements the same ``call_structured`` signature. The graph and nodes do
not change.
"""

from __future__ import annotations

import logging
from typing import TypeVar

from anthropic import Anthropic
from pydantic import BaseModel

from job_pipeline.config import (
    get_anthropic_api_key,
    get_model_for_node,
    load_model_pricing,
)
from job_pipeline.instrumentation import current_node_metrics

logger = logging.getLogger(__name__)

T = TypeVar("T", bound=BaseModel)


class LLMClient:
    """Thin wrapper around the Anthropic SDK with schema-enforced output."""

    def __init__(self, api_key: str | None = None) -> None:
        key = api_key or get_anthropic_api_key()
        if not key:
            logger.warning(
                "ANTHROPIC_API_KEY not set; LLMClient will fail on first call."
            )
        self._client = Anthropic(api_key=key) if key else None

    def call_structured(
        self,
        *,
        node_name: str,
        system_prompt: str,
        user_prompt: str,
        output_schema: type[T],
        max_tokens: int = 4096,
        temperature: float = 0.0,
    ) -> T:
        """Force the model to emit JSON matching ``output_schema`` and parse it."""
        if self._client is None:
            raise RuntimeError(
                "LLMClient is not configured. Set ANTHROPIC_API_KEY in the environment."
            )

        model = get_model_for_node(node_name)
        tool_name = _camel_to_snake(output_schema.__name__)
        tool_def = {
            "name": tool_name,
            "description": (
                f"Emit a {output_schema.__name__} payload conforming exactly "
                f"to the schema. Do not add fields. Do not return prose."
            ),
            "input_schema": output_schema.model_json_schema(),
        }

        response = self._client.messages.create(
            model=model,
            max_tokens=max_tokens,
            temperature=temperature,
            system=system_prompt,
            tools=[tool_def],
            tool_choice={"type": "tool", "name": tool_name},
            messages=[{"role": "user", "content": user_prompt}],
        )

        tool_use = next(
            (b for b in response.content if getattr(b, "type", None) == "tool_use"),
            None,
        )
        if tool_use is None or tool_use.name != tool_name:
            raise RuntimeError(
                f"Expected tool_use block for {tool_name!r}; got {response.content!r}"
            )

        result = output_schema.model_validate(tool_use.input)

        # Record usage on the active node's accumulator.
        usage = response.usage
        cost = self._compute_cost(model, usage.input_tokens, usage.output_tokens)
        acc = current_node_metrics.get()
        if acc is not None:
            acc.record_llm_call(
                tokens_in=usage.input_tokens,
                tokens_out=usage.output_tokens,
                model=model,
                cost_usd=cost,
            )
        else:
            logger.debug(
                "LLM call from node %s outside @track_node; usage not recorded.",
                node_name,
            )

        return result

    @staticmethod
    def _compute_cost(model: str, tokens_in: int, tokens_out: int) -> float:
        pricing = load_model_pricing().get("models", {}).get(model)
        if not pricing:
            return 0.0
        return (tokens_in / 1000.0) * pricing["input_per_1k"] + (
            tokens_out / 1000.0
        ) * pricing["output_per_1k"]


_singleton: LLMClient | None = None


def get_llm_client() -> LLMClient:
    """Process-level singleton."""
    global _singleton
    if _singleton is None:
        _singleton = LLMClient()
    return _singleton


def _camel_to_snake(name: str) -> str:
    out: list[str] = []
    for i, ch in enumerate(name):
        if ch.isupper() and i > 0 and not name[i - 1].isupper():
            out.append("_")
        out.append(ch.lower())
    return "".join(out)
