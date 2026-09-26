"""Publish a verified stack: push the ``cleave/*`` branches and open one pull request per layer.

Uses ``gh``. Stacked PRs when available (``gh stack``), else each PR's base is the previous
layer's branch ("chained"). Writes the result into ``report.publish``.
"""

from __future__ import annotations

from pathlib import Path

from .models import Publish, Report


def publish(repo: Path, report: Report, remote: str = "origin", method: str = "auto") -> Publish:
    raise NotImplementedError
