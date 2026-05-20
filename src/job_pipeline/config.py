"""Config loaders for YAML data and runtime constants.

Single source of truth for paths, defaults, and pricing. All node code
imports from here so that switching models/thresholds is a one-file change.
"""

from __future__ import annotations

import os
from functools import lru_cache
from pathlib import Path

import yaml

from job_pipeline.schemas import StoryBank

# ---------------------------------------------------------------------------
# Paths
# ---------------------------------------------------------------------------

PROJECT_ROOT = Path(__file__).resolve().parent.parent.parent
DATA_DIR = PROJECT_ROOT / "data"
TEMPLATES_DIR = PROJECT_ROOT / "templates"
RUNS_DIR = PROJECT_ROOT / "runs"
RUNS_OUTPUTS_DIR = RUNS_DIR / "outputs"
RUNS_JSONL = RUNS_DIR / "runs.jsonl"

# ---------------------------------------------------------------------------
# Pipeline tunables
# ---------------------------------------------------------------------------

ATS_SCORE_THRESHOLD: float = 0.75
ATS_MAX_RETRIES: int = 2

DEFAULT_BULLETS_PER_COMPANY: int = 4
PER_COMPANY_BULLET_OVERRIDES: dict[str, int] = {
    "coding.Studio()": 1,
    "JobFlow (personal project)": 1,
    "GTM Intelligence Agent (personal project)": 1,
    "Cognizant": 3,
}


def bullets_for_company(company: str) -> int:
    return PER_COMPANY_BULLET_OVERRIDES.get(company, DEFAULT_BULLETS_PER_COMPANY)


# ---------------------------------------------------------------------------
# YAML loaders (cached)
# ---------------------------------------------------------------------------


def _load_yaml(path: Path) -> dict:
    with path.open("r", encoding="utf-8") as f:
        return yaml.safe_load(f) or {}


@lru_cache(maxsize=1)
def load_story_bank() -> StoryBank:
    return StoryBank.model_validate(_load_yaml(DATA_DIR / "story_bank.yaml"))


@lru_cache(maxsize=1)
def load_personal_rules() -> dict:
    return _load_yaml(DATA_DIR / "personal_rules.yaml")


@lru_cache(maxsize=1)
def load_skill_categories() -> dict[str, list[str]]:
    return _load_yaml(DATA_DIR / "skill_categories.yaml")


@lru_cache(maxsize=1)
def load_model_pricing() -> dict:
    return _load_yaml(DATA_DIR / "model_pricing.yaml")


# ---------------------------------------------------------------------------
# Model selection
# ---------------------------------------------------------------------------


def get_model_for_node(node_name: str) -> str:
    """Resolve which model to invoke for a given node, honoring overrides."""
    env_override = os.environ.get("JOB_PIPELINE_MODEL")
    if env_override:
        return env_override
    pricing = load_model_pricing()
    overrides = pricing.get("node_model_overrides", {}) or {}
    return overrides.get(node_name) or pricing["default_model"]


def get_anthropic_api_key() -> str | None:
    return os.environ.get("ANTHROPIC_API_KEY")


def ensure_runtime_dirs() -> None:
    RUNS_DIR.mkdir(parents=True, exist_ok=True)
    RUNS_OUTPUTS_DIR.mkdir(parents=True, exist_ok=True)
