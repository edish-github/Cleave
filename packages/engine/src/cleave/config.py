"""Run configuration, read from ``.cleave/config.toml`` in the target repository.

``cleave init`` writes this file. Every field has a default so a bare repo works.
"""

from __future__ import annotations

import tomllib
from pathlib import Path

from pydantic import BaseModel, ConfigDict, Field


class RunConfig(BaseModel):
    model_config = ConfigDict(extra="forbid")

    check_command: str = "pytest -q"
    setup_command: str | None = None
    working_directory: str = "."
    max_layer_lines: int = Field(default=400, ge=1)
    timeout_s: int = Field(default=600, ge=1, description="Per-layer limit for setup + check.")
    parallel: int = Field(default=4, ge=1, description="Layers verified at once.")
    max_repair_rounds: int = Field(default=3, ge=0)
    bobcoin_cap: float = Field(default=3.0, gt=0)


CONFIG_PATH = Path(".cleave/config.toml")


def load_config(repo: Path) -> RunConfig:
    path = repo / CONFIG_PATH
    if not path.exists():
        return RunConfig()
    with path.open("rb") as fh:
        return RunConfig(**tomllib.load(fh).get("cleave", {}))


def render_config(config: RunConfig) -> str:
    lines = ["[cleave]"]
    for key, value in config.model_dump().items():
        if value is None:
            continue
        lines.append(f"{key} = {value!r}" if not isinstance(value, str) else f'{key} = "{value}"')
    return "\n".join(lines) + "\n"
