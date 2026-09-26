/**
 * GENERATED from /schemas by `npm run contracts`. Do not edit by hand.
 * These are the shapes the engine writes and POST /api/ingest/bundle accepts.
 */

/**
 * What `cleave push` sends to POST /api/ingest/bundle: one JSON document holding a finished run's manifest and artifacts. Send it gzip-encoded for large diffs.
 */
export interface Bundle {
  version: 1;
  kind: "cleave.bundle";
  /**
   * This interface was referenced by `Report`'s JSON-Schema
   * via the `definition` "run_id".
   */
  run_id: string;
  source: "ide" | "runner";
  run_kind?: "cleave" | "baseline_b1";
  title: string;
  repo: {
    full_name: string;
    default_branch?: string | null;
  };
  pull_request?: null | {
    number: number;
    url?: string | null;
    head_branch: string;
    base_branch: string;
    author?: string | null;
  };
  eval?: null | {
    group: string;
    dataset: string;
    ground_truth?: {} | null;
  };
  created_at: string;
  atoms: AtomsFile;
  graph: Graph;
  /**
   * @minItems 1
   */
  plans: [Plan, ...Plan[]];
  report: Report;
  events: Event[];
}
/**
 * atoms.json: the pull request cut into atoms. An atom is the smallest unit Cleave moves between layers: one hunk, or one whole file for new, deleted, renamed, binary or mode-only changes. Atoms are never edited.
 */
export interface AtomsFile {
  version: 1;
  /**
   * This interface was referenced by `AtomsFile`'s JSON-Schema
   * via the `definition` "sha".
   */
  base_sha: string;
  /**
   * This interface was referenced by `AtomsFile`'s JSON-Schema
   * via the `definition` "sha".
   */
  head_sha: string;
  /**
   * Tree hash of head. The last layer must reproduce it exactly.
   */
  head_tree: string;
  atoms: Atom[];
}
/**
 * This interface was referenced by `AtomsFile`'s JSON-Schema
 * via the `definition` "atom".
 */
export interface Atom {
  /**
   * First 12 hex chars of sha256(file path + NUL + patch text). Stable across runs of the same diff.
   *
   * This interface was referenced by `AtomsFile`'s JSON-Schema
   * via the `definition` "atom_id".
   */
  id: string;
  /**
   * Path in head (or in base for deleted files), relative to the repo root.
   */
  file: string;
  /**
   * Previous path for renames, else null.
   */
  old_file?: string | null;
  /**
   * This interface was referenced by `AtomsFile`'s JSON-Schema
   * via the `definition` "atom_kind".
   */
  kind: "hunk" | "new_file" | "deleted_file" | "rename" | "binary" | "mode";
  old_start?: number;
  old_len?: number;
  new_start?: number;
  new_len?: number;
  added: number;
  removed: number;
  /**
   * Verbatim diff text for this atom: the @@ hunk for text changes, or the whole-file section (including `GIT binary patch` for binary files) for whole-file atoms. Applying it with `git apply --cached --unidiff-zero` must work.
   */
  patch: string;
  is_test: boolean;
  /**
   * Names this atom defines and references, filled by the graph step.
   */
  symbols?: {
    defines?: string[];
    references?: string[];
  } | null;
}
/**
 * graph.json: which atoms need which. An edge from A to B means A needs B, so B must sit in the same or an earlier layer.
 */
export interface Graph {
  version: 1;
  edges: Edge[];
  /**
   * Forced groups: atoms in a dependency cycle (a strongly connected component) must share a layer.
   */
  groups: [string, string, ...string[]][];
}
/**
 * This interface was referenced by `Graph`'s JSON-Schema
 * via the `definition` "edge".
 */
export interface Edge {
  /**
   * First 12 hex chars of sha256(file path + NUL + patch text). Stable across runs of the same diff.
   *
   * This interface was referenced by `AtomsFile`'s JSON-Schema
   * via the `definition` "atom_id".
   */
  from: string;
  /**
   * First 12 hex chars of sha256(file path + NUL + patch text). Stable across runs of the same diff.
   *
   * This interface was referenced by `AtomsFile`'s JSON-Schema
   * via the `definition` "atom_id".
   */
  to: string;
  /**
   * import/call/model: Python AST. fixture: pytest fixture by name. file_order: create-before-edit or same-file order. runtime: found only when a layer failed its check.
   *
   * This interface was referenced by `Graph`'s JSON-Schema
   * via the `definition` "edge_kind".
   */
  kind: "import" | "call" | "model" | "fixture" | "file_order" | "runtime";
  symbol?: string | null;
  source: "static" | "verification";
}
/**
 * plan.vN.json: one version of the layer plan. Bob proposes and revises plans only through the Cleave MCP tools; the engine checks each version and records its violations.
 */
export interface Plan {
  version: number;
  author: "bob" | "engine";
  /**
   * Why this version exists, e.g. the failing test that caused an atom move.
   */
  reason?: string | null;
  /**
   * @minItems 1
   */
  layers: [Layer, ...Layer[]];
  /**
   * Concern label and intent per atom id, from the explore subagents.
   */
  labels?: {
    [k: string]: Label;
  } | null;
  violations: Violation[];
}
/**
 * This interface was referenced by `Plan`'s JSON-Schema
 * via the `definition` "layer".
 */
export interface Layer {
  name: string;
  rationale?: string | null;
  /**
   * @minItems 1
   *
   * Items: First 12 hex chars of sha256(file path + NUL + patch text). Stable across runs of the same diff.
   *
   * This interface was referenced by `AtomsFile`'s JSON-Schema
   * via the `definition` "atom_id".
   */
  atoms: [string, ...string[]];
}
/**
 * This interface was referenced by `Plan`'s JSON-Schema
 * via the `definition` "label".
 */
export interface Label {
  concern: string;
  intent: string;
}
/**
 * This interface was referenced by `Plan`'s JSON-Schema
 * via the `definition` "violation".
 */
export interface Violation {
  kind:
    "missing_atom" | "duplicate_atom" | "unknown_atom" | "order" | "group_split" | "empty_layer" | "layer_too_large";
  atom?: string | null;
  layer?: number | null;
  detail: string;
}
/**
 * report.json: the outcome of one run. The overview, the proof page and /results all read the checks from here.
 */
export interface Report {
  version: 1;
  /**
   * This interface was referenced by `Report`'s JSON-Schema
   * via the `definition` "run_id".
   */
  run_id: string;
  /**
   * verified: all five checks pass. review: a layer can't pass on its own after the repair limit. failed: the run stopped with an error.
   */
  status: "verified" | "review" | "failed";
  error?: string | null;
  /**
   * Check command every layer ran, e.g. `pytest -q`.
   */
  command: string;
  setup_command?: string | null;
  working_directory?: string | null;
  /**
   * This interface was referenced by `AtomsFile`'s JSON-Schema
   * via the `definition` "sha".
   */
  base_sha: string;
  /**
   * This interface was referenced by `AtomsFile`'s JSON-Schema
   * via the `definition` "sha".
   */
  head_sha: string;
  /**
   * This interface was referenced by `AtomsFile`'s JSON-Schema
   * via the `definition` "sha".
   */
  head_tree: string;
  /**
   * Tree of the last layer. Equal to head_tree when fidelity holds.
   */
  top_tree: string | null;
  /**
   * Lines in the stack that are not in the original diff. Must be 0.
   */
  foreign_lines: number;
  /**
   * The plan version this report verifies.
   */
  plan_version: number;
  /**
   * @minItems 5
   * @maxItems 5
   */
  checks: [Check, Check, Check, Check, Check];
  layers: LayerResult[];
  rounds: Round[];
  repairs: Repair[];
  issue?: null | Issue;
  hook: {
    allowed: number;
    blocked: number;
  };
  bob?: null | BobStats;
  publish?: null | Publish;
  started_at: string;
  finished_at: string;
}
/**
 * This interface was referenced by `Report`'s JSON-Schema
 * via the `definition` "check".
 */
export interface Check {
  /**
   * coverage: every atom in exactly one layer. order: no edge points to a later layer. fidelity: top tree = head tree. shippability: every prefix passes the check command. partition: no new code (foreign_lines = 0, no source edit allowed by the hook).
   *
   * This interface was referenced by `Report`'s JSON-Schema
   * via the `definition` "check_id".
   */
  id: "coverage" | "order" | "fidelity" | "shippability" | "partition";
  status: "pass" | "attention";
  /**
   * Short value shown beside the check, e.g. `37 / 37` or `Identical`.
   */
  value: string;
  /**
   * One line of evidence.
   */
  detail: string;
}
/**
 * This interface was referenced by `Report`'s JSON-Schema
 * via the `definition` "layer_result".
 */
export interface LayerResult {
  index: number;
  name: string;
  rationale?: string | null;
  /**
   * Items: First 12 hex chars of sha256(file path + NUL + patch text). Stable across runs of the same diff.
   *
   * This interface was referenced by `AtomsFile`'s JSON-Schema
   * via the `definition` "atom_id".
   */
  atoms: string[];
  added: number;
  removed: number;
  files: string[];
  /**
   * cleave/<slug>/<index>-<layer-slug>
   */
  branch: string;
  commit_sha?: string | null;
  tree_sha?: string | null;
  status: "pass" | "fail";
  tests_passed?: number | null;
  tests_failed?: number | null;
  duration_ms?: number | null;
  /**
   * Pull request text for this layer.
   */
  description?: string | null;
}
/**
 * This interface was referenced by `Report`'s JSON-Schema
 * via the `definition` "round".
 */
export interface Round {
  round: number;
  plan_version: number;
  results: CheckResult[];
}
/**
 * This interface was referenced by `Report`'s JSON-Schema
 * via the `definition` "check_result".
 */
export interface CheckResult {
  layer: number;
  status: "pass" | "fail" | "error" | "timeout";
  tests_passed?: number | null;
  tests_failed?: number | null;
  duration_ms: number;
  failure?: null | {
    test: string;
    message: string;
  };
  log_excerpt?: string | null;
}
/**
 * This interface was referenced by `Report`'s JSON-Schema
 * via the `definition` "repair".
 */
export interface Repair {
  /**
   * The round that verified this repair.
   */
  round: number;
  /**
   * First 12 hex chars of sha256(file path + NUL + patch text). Stable across runs of the same diff.
   *
   * This interface was referenced by `AtomsFile`'s JSON-Schema
   * via the `definition` "atom_id".
   */
  atom: string;
  from_layer: number;
  to_layer: number;
  reason: string;
}
/**
 * This interface was referenced by `Report`'s JSON-Schema
 * via the `definition` "issue".
 */
export interface Issue {
  layer: number;
  test: string;
  expected: string;
  found: string;
  log_excerpt?: string | null;
  explanation: string;
  resolution: {
    kind: "merge";
    into: number;
    from: number;
    name: string;
  };
}
/**
 * This interface was referenced by `Report`'s JSON-Schema
 * via the `definition` "bob_stats".
 */
export interface BobStats {
  surface: "ide" | "bob_run";
  mode: string;
  task_id?: string | null;
  bobcoins?: number | null;
  tokens?: number | null;
  tool_calls?: number | null;
  mcp_calls?: number | null;
  subagents?: number | null;
  duration_ms?: number | null;
}
/**
 * This interface was referenced by `Report`'s JSON-Schema
 * via the `definition` "publish".
 */
export interface Publish {
  published_at: string;
  method: "stacked" | "chained";
  pull_requests: {
    layer: number;
    number: number;
    url: string;
    base: string;
  }[];
}
/**
 * One line of events.ndjson. Engine steps, Bob's MCP calls, hook decisions and runner messages all land here, and the Activity tab is built from them.
 */
export interface Event {
  ts: string;
  source: "engine" | "bob" | "hook" | "runner" | "mcp";
  /**
   * Known types: run.started, run.finished, atoms.cut, graph.built, slices.written, subagent.spawned, subagent.finished, plan.proposed, plan.checked, verify.started, layer.passed, layer.failed, verify.passed, atoms.moved, review.required, layers.merged, layer.described, hook.allowed, hook.blocked, mcp.called, stack.published. Unknown types are shown generically.
   */
  type: string;
  run_id?: string | null;
  /**
   * Tool or command behind the event, e.g. cleave_move_atoms.
   */
  tool?: string | null;
  payload: {};
}
