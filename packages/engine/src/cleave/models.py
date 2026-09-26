"""Typed mirror of the JSON Schemas in /schemas.

Every file the engine writes (atoms.json, graph.json, plan.vN.json, report.json,
events.ndjson, the push bundle) is one of these models dumped with
``model_dump(mode="json", exclude_none=False)``. ``tests/test_models.py`` validates
dumps against the schemas, so a field added here must be added there too.
"""

from __future__ import annotations

from datetime import datetime
from typing import Annotated, Any, Literal

from pydantic import BaseModel, ConfigDict, Field

Sha = Annotated[str, Field(pattern=r"^[0-9a-f]{40}$")]
AtomId = Annotated[str, Field(pattern=r"^[0-9a-f]{12}$")]
RunId = Annotated[str, Field(pattern=r"^[a-z0-9][a-z0-9-]{5,63}$")]

AtomKind = Literal["hunk", "new_file", "deleted_file", "rename", "binary", "mode"]
EdgeKind = Literal["import", "call", "model", "fixture", "file_order", "runtime"]
CheckId = Literal["coverage", "order", "fidelity", "shippability", "partition"]
EventSource = Literal["engine", "bob", "hook", "runner", "mcp"]


class _Model(BaseModel):
    model_config = ConfigDict(extra="forbid", populate_by_name=True)


# --- atom.schema.json -------------------------------------------------------


class Symbols(_Model):
    defines: list[str] = Field(default_factory=list)
    references: list[str] = Field(default_factory=list)


class Atom(_Model):
    id: AtomId
    file: str = Field(min_length=1)
    old_file: str | None = None
    kind: AtomKind
    old_start: int = Field(default=0, ge=0)
    old_len: int = Field(default=0, ge=0)
    new_start: int = Field(default=0, ge=0)
    new_len: int = Field(default=0, ge=0)
    added: int = Field(ge=0)
    removed: int = Field(ge=0)
    patch: str
    is_test: bool
    symbols: Symbols | None = None


class AtomsFile(_Model):
    version: Literal[1] = 1
    base_sha: Sha
    head_sha: Sha
    head_tree: Sha
    atoms: list[Atom]

    def by_id(self) -> dict[str, Atom]:
        return {a.id: a for a in self.atoms}


# --- graph.schema.json ------------------------------------------------------


class Edge(_Model):
    """``from_`` needs ``to``: ``to`` must sit in the same or an earlier layer."""

    from_: AtomId = Field(alias="from")
    to: AtomId
    kind: EdgeKind
    symbol: str | None = None
    source: Literal["static", "verification"] = "static"


class Graph(_Model):
    version: Literal[1] = 1
    edges: list[Edge] = Field(default_factory=list)
    groups: list[list[AtomId]] = Field(default_factory=list)


# --- plan.schema.json -------------------------------------------------------


class PlanLayer(_Model):
    name: str = Field(min_length=1, max_length=80)
    rationale: str | None = None
    atoms: list[AtomId] = Field(min_length=1)


class Label(_Model):
    concern: str = Field(max_length=60)
    intent: str = Field(max_length=200)


ViolationKind = Literal[
    "missing_atom", "duplicate_atom", "unknown_atom", "order", "group_split", "empty_layer", "layer_too_large"
]


class Violation(_Model):
    kind: ViolationKind
    atom: str | None = None
    layer: int | None = Field(default=None, ge=1)
    detail: str


class Plan(_Model):
    version: int = Field(ge=0)
    author: Literal["bob", "engine"]
    reason: str | None = None
    layers: list[PlanLayer] = Field(min_length=1)
    labels: dict[str, Label] | None = None
    violations: list[Violation] = Field(default_factory=list)

    def layer_of(self) -> dict[str, int]:
        """Atom id -> 1-based layer index."""
        return {atom: i + 1 for i, layer in enumerate(self.layers) for atom in layer.atoms}


# --- report.schema.json -----------------------------------------------------


class Check(_Model):
    id: CheckId
    status: Literal["pass", "attention"]
    value: str
    detail: str


class LayerResult(_Model):
    index: int = Field(ge=1)
    name: str
    rationale: str | None = None
    atoms: list[AtomId]
    added: int = Field(ge=0)
    removed: int = Field(ge=0)
    files: list[str]
    branch: str
    commit_sha: Sha | None = None
    tree_sha: Sha | None = None
    status: Literal["pass", "fail"]
    tests_passed: int | None = Field(default=None, ge=0)
    tests_failed: int | None = Field(default=None, ge=0)
    duration_ms: int | None = Field(default=None, ge=0)
    description: str | None = None


class Failure(_Model):
    test: str
    message: str


class CheckResult(_Model):
    layer: int = Field(ge=1)
    status: Literal["pass", "fail", "error", "timeout"]
    tests_passed: int | None = Field(default=None, ge=0)
    tests_failed: int | None = Field(default=None, ge=0)
    duration_ms: int = Field(ge=0)
    failure: Failure | None = None
    log_excerpt: str | None = Field(default=None, max_length=8000)


class Round(_Model):
    round: int = Field(ge=1)
    plan_version: int = Field(ge=0)
    results: list[CheckResult]


class Repair(_Model):
    round: int = Field(ge=1)
    atom: AtomId
    from_layer: int = Field(ge=1)
    to_layer: int = Field(ge=1)
    reason: str


class Resolution(_Model):
    kind: Literal["merge"] = "merge"
    into: int = Field(ge=1)
    from_: int = Field(ge=1, alias="from")
    name: str


class Issue(_Model):
    layer: int = Field(ge=1)
    test: str
    expected: str
    found: str
    log_excerpt: str | None = Field(default=None, max_length=8000)
    explanation: str
    resolution: Resolution


class HookCounts(_Model):
    allowed: int = Field(default=0, ge=0)
    blocked: int = Field(default=0, ge=0)


class BobStats(_Model):
    surface: Literal["ide", "bob_run"]
    mode: str
    task_id: str | None = None
    bobcoins: float | None = Field(default=None, ge=0)
    tokens: int | None = Field(default=None, ge=0)
    tool_calls: int | None = Field(default=None, ge=0)
    mcp_calls: int | None = Field(default=None, ge=0)
    subagents: int | None = Field(default=None, ge=0)
    duration_ms: int | None = Field(default=None, ge=0)


class PublishedPullRequest(_Model):
    layer: int = Field(ge=1)
    number: int = Field(ge=1)
    url: str
    base: str


class Publish(_Model):
    published_at: datetime
    method: Literal["stacked", "chained"]
    pull_requests: list[PublishedPullRequest]


class Report(_Model):
    version: Literal[1] = 1
    run_id: RunId
    status: Literal["verified", "review", "failed"]
    error: str | None = None
    command: str
    setup_command: str | None = None
    working_directory: str | None = None
    base_sha: Sha
    head_sha: Sha
    head_tree: Sha
    top_tree: Sha | None = None
    foreign_lines: int = Field(ge=0)
    plan_version: int = Field(ge=0)
    checks: list[Check] = Field(min_length=5, max_length=5)
    layers: list[LayerResult]
    rounds: list[Round]
    repairs: list[Repair] = Field(default_factory=list)
    issue: Issue | None = None
    hook: HookCounts = Field(default_factory=HookCounts)
    bob: BobStats | None = None
    publish: Publish | None = None
    started_at: datetime
    finished_at: datetime


# --- event.schema.json ------------------------------------------------------


class Event(_Model):
    ts: datetime
    source: EventSource
    type: str = Field(pattern=r"^[a-z_]+(\.[a-z_]+)+$")
    run_id: str | None = None
    tool: str | None = None
    payload: dict[str, Any] = Field(default_factory=dict)


# --- bundle.schema.json -----------------------------------------------------


class RepoRef(_Model):
    full_name: str = Field(pattern=r"^[A-Za-z0-9_.-]+/[A-Za-z0-9_.-]+$")
    default_branch: str | None = None


class PullRequestRef(_Model):
    number: int = Field(ge=1)
    url: str | None = None
    head_branch: str
    base_branch: str
    author: str | None = None


class EvalRef(_Model):
    group: str
    dataset: str
    ground_truth: dict[str, Any] | None = None


class Bundle(_Model):
    version: Literal[1] = 1
    kind: Literal["cleave.bundle"] = "cleave.bundle"
    run_id: RunId
    source: Literal["ide", "runner"]
    run_kind: Literal["cleave", "baseline_b1"] = "cleave"
    title: str = Field(min_length=1, max_length=200)
    repo: RepoRef
    pull_request: PullRequestRef | None = None
    eval: EvalRef | None = None
    created_at: datetime
    atoms: AtomsFile
    graph: Graph
    plans: list[Plan] = Field(min_length=1)
    report: Report
    events: list[Event]


def dump(model: BaseModel) -> dict[str, Any]:
    """JSON-ready dict using schema field names (``from``, not ``from_``)."""
    return model.model_dump(mode="json", by_alias=True)
