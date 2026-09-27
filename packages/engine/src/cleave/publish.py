"""Publish a verified stack: push the ``cleave/*`` branches and open one pull request per layer.

Chained, which every repository supports: layer 1's pull request targets the base branch
and layer n's targets layer n-1's branch, so each shows only its own layer. Stacked PRs
(gh-stack) wait for open check C6; ``has_gh_stack`` reports whether the extension is there.

Only ``git push`` of explicit refspecs and ``gh`` are used: the working tree, the index and
HEAD are never touched. Spec: tests/test_publish.py.
"""

from __future__ import annotations

import json
import re
import subprocess
from datetime import datetime, timezone
from pathlib import Path

from .gitio import git
from .models import LayerResult, Publish, PublishedPullRequest, Report

_PR_URL = re.compile(r"https?://\S+/pull/(\d+)")


class PublishError(RuntimeError):
    """``gh`` or ``git push`` failed; the message says which layer and why."""


def _gh(repo: Path, *args: str) -> str:
    try:
        out = subprocess.run(["gh", *args], cwd=repo, capture_output=True, text=True, check=False)
    except FileNotFoundError as e:
        raise PublishError("The GitHub CLI `gh` isn't installed. Install it and run `gh auth login`.") from e
    if out.returncode != 0:
        raise PublishError(f"gh {' '.join(args[:2])} failed: {(out.stderr or out.stdout).strip()[:500]}")
    return out.stdout


def has_gh_stack(repo: Path) -> bool:
    try:
        return "gh-stack" in _gh(repo, "extension", "list")
    except PublishError:
        return False


def _open_pr(repo: Path, branch: str) -> tuple[int, str, str] | None:
    """The open pull request whose head is ``branch``: (number, url, base), if there is one."""
    out = _gh(repo, "pr", "list", "--head", branch, "--state", "open", "--json", "number,url,baseRefName")
    try:
        found = json.loads(out) if out.strip() else []
    except json.JSONDecodeError:
        return None
    if not found:
        return None
    first = found[0]
    return int(first["number"]), str(first["url"]), str(first.get("baseRefName", ""))


def _title(layer: LayerResult, total: int) -> str:
    return f"{layer.index}/{total} · {layer.name}"


def _body(layer: LayerResult, total: int, report: Report) -> str:
    about = layer.description or layer.rationale or layer.name
    tests = f"{layer.tests_passed} tests pass" if layer.tests_passed is not None else "the check passes"
    return (
        f"{about}\n\n"
        f"+{layer.added} −{layer.removed} across {len(layer.files)} file{'s' if len(layer.files) != 1 else ''}; "
        f"`{report.command}`: {tests} on this layer alone.\n\n"
        f"Part {layer.index} of {total} of a stack split by Cleave; every layer passes the tests on its own, "
        f"and the last one is byte-identical to the original change (run `{report.run_id}`)."
    )


def publish(repo: Path, report: Report, base_branch: str, remote: str = "origin", method: str = "auto") -> Publish:
    """Push every layer branch and open its pull request. Returns what was opened."""
    if report.status != "verified":
        raise ValueError(f"Only a verified stack can be published; this run is {report.status!r}.")
    if method not in ("auto", "chained", "stacked"):
        raise ValueError(f"Unknown method {method!r}: use auto, chained or stacked.")
    layers = sorted(report.layers, key=lambda layer: layer.index)
    if not layers:
        raise ValueError("The report has no layers to publish.")

    if method == "stacked":
        # gh-stack's commands aren't confirmed yet (open check C6). Chained PRs give reviewers the
        # same one-layer-per-PR view, so "auto" publishes chained until C6 settles the commands.
        raise ValueError("Stacked PRs need open check C6 settled; use --method chained (or auto).")

    refspecs = [f"refs/heads/{layer.branch}:refs/heads/{layer.branch}" for layer in layers]
    try:
        git(repo, "push", "--force-with-lease", remote, *refspecs)
    except Exception as e:  # GitError carries git's message
        raise PublishError(f"git push to {remote} failed: {e}") from e

    total = len(layers)
    opened: list[PublishedPullRequest] = []
    base = base_branch
    for layer in layers:
        existing = _open_pr(repo, layer.branch)
        if existing:
            # A rerun (say, after gh failed halfway): keep the open PR, point it at the right base.
            number, url, current_base = existing
            if current_base != base:
                _gh(repo, "pr", "edit", str(number), "--base", base)
        else:
            out = _gh(
                repo,
                "pr",
                "create",
                "--head",
                layer.branch,
                "--base",
                base,
                "--title",
                _title(layer, total),
                "--body",
                _body(layer, total, report),
            )
            match = _PR_URL.search(out)
            if not match:
                raise PublishError(f"gh didn't print a pull request URL for layer {layer.index}: {out.strip()[:200]}")
            number, url = int(match.group(1)), match.group(0)
        opened.append(PublishedPullRequest(layer=layer.index, number=number, url=url, base=base))
        base = layer.branch

    return Publish(published_at=datetime.now(timezone.utc), method="chained", pull_requests=opened)
