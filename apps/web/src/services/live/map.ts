/**
 * Database rows (engine contracts) -> the view models pages render (src/lib/types).
 * Pure functions: no I/O, so they're easy to test and reuse for public proof pages.
 */
import type * as C from "@/lib/contracts";
import type {
  ActivityEvent,
  ActivitySource,
  ActivityTone,
  Atom,
  AtomKind,
  BobRunStats,
  Dependency,
  Layer,
  Repair,
  Repository,
  Stack,
  StackStatus,
  StackSummary,
  User,
  VerificationCheck,
  VerificationIssue,
  VerificationRound,
} from "@/lib/types";
import type { AtomRow, EventRow, LayerRow, RepositoryRow, RunRow, StackRow, UserRow } from "@/server/db/schema";

const pad2 = (n: number) => String(n).padStart(2, "0");
const iso = (d: Date | null | undefined) => (d ? d.toISOString() : null);

export function initialsOf(name: string): string {
  const parts = name.trim().split(/[\s._-]+/).filter(Boolean);
  const letters = parts.length > 1 ? [parts[0]?.[0], parts[parts.length - 1]?.[0]] : [parts[0]?.[0], parts[0]?.[1]];
  return letters.filter(Boolean).join("").toUpperCase() || "C";
}

export function toUser(row: UserRow): User {
  const name = row.name || row.login;
  return { id: row.id, name, email: row.email ?? "", githubLogin: row.login, initials: initialsOf(name) };
}

export function toRepository(row: RepositoryRow): Repository {
  const [owner = "", name = row.fullName] = row.fullName.split("/");
  const config = row.config ?? {};
  return {
    id: row.id,
    owner,
    name,
    fullName: row.fullName,
    url: `https://github.com/${row.fullName}`,
    language: row.language ?? "",
    framework: "",
    defaultBranch: row.defaultBranch,
    connection: "connected",
    lastSyncedAt: row.createdAt.toISOString(),
    config: {
      workingDirectory: config.workingDirectory ?? ".",
      setupCommand: config.setupCommand ?? "",
      checkCommand: config.checkCommand ?? "pytest -q",
      maxLayerLines: config.maxLayerLines ?? 400,
      bobcoinCap: config.bobcoinCap ?? 3,
    },
  };
}

export function toStatus(status: StackRow["status"]): StackStatus {
  if (status === "queued" || status === "running") return "analyzing";
  return status;
}

const atomKind: Record<C.Atom["kind"], AtomKind> = {
  hunk: "hunk",
  new_file: "new-file",
  deleted_file: "deleted-file",
  rename: "rename",
  binary: "binary",
  mode: "mode",
};

const kindSummary: Record<C.Atom["kind"], string> = {
  hunk: "Change",
  new_file: "New file",
  deleted_file: "Delete file",
  rename: "Rename",
  binary: "Binary file",
  mode: "File mode change",
};

function atomSummary(row: AtomRow, labels: C.Plan["labels"]): string {
  const label = labels?.[row.atomId];
  if (label?.intent) return label.intent;
  if (label?.concern) return label.concern;
  const defines = row.symbols?.defines?.slice(0, 2).join(", ");
  if (defines) return `${kindSummary[row.kind]}: ${defines}`;
  if (row.kind === "rename" && row.oldFile) return `Rename from ${row.oldFile}`;
  return `${kindSummary[row.kind]} at line ${row.newStart || row.oldStart}`;
}

export function toAtom(row: AtomRow, labels: C.Plan["labels"]): Atom {
  return {
    id: row.atomId,
    layerIndex: row.layerIndex ?? 0,
    file: row.filePath,
    summary: atomSummary(row, labels),
    kind: atomKind[row.kind],
    additions: row.added,
    deletions: row.removed,
    isTest: row.isTest,
    patch: row.patch || null,
    patchTruncated: false,
  };
}

export function toDependencies(graph: C.Graph): Dependency[] {
  return graph.edges.map((e, i) => ({
    id: `dep-${i + 1}`,
    fromAtomId: e.from,
    toAtomId: e.to,
    symbol: e.symbol ?? e.kind.replace("_", " "),
    kind: e.kind,
    discoveredByVerification: e.source === "verification",
  }));
}

const checkCopy: Record<C.Check["id"], { label: string; description: string }> = {
  coverage: { label: "Atom coverage", description: "Every change appears in exactly one layer." },
  order: { label: "Dependency order", description: "Nothing depends on a later layer." },
  fidelity: { label: "Tree fidelity", description: "The last layer is identical to the original pull request." },
  shippability: { label: "Layer shippability", description: "Each layer passes the tests on its own." },
  partition: { label: "No new code", description: "Bob only moved existing changes between layers." },
};

export function toChecks(report: C.Report): VerificationCheck[] {
  return report.checks.map((c) => ({
    id: c.id,
    label: checkCopy[c.id].label,
    description: checkCopy[c.id].description,
    state: c.status,
    value: c.value,
    evidence: c.detail,
  }));
}

export function toRounds(report: C.Report): VerificationRound[] {
  return report.rounds.map((r) => ({
    round: r.round,
    planVersion: r.plan_version,
    results: r.results.map((x) => ({
      layerIndex: x.layer,
      status: x.status === "pass" ? "pass" : "fail",
      testsPassed: x.tests_passed ?? 0,
      testsFailed: x.tests_failed ?? (x.status === "pass" ? 0 : 1),
      durationMs: x.duration_ms,
      failure: x.failure ?? (x.status === "timeout" ? { test: "(timeout)", message: "The check command timed out." } : null),
    })),
  }));
}

export function toRepairs(report: C.Report): Repair[] {
  return report.repairs.map((r) => ({
    round: r.round,
    atomId: r.atom,
    fromLayer: r.from_layer,
    toLayer: r.to_layer,
    reason: r.reason,
  }));
}

function toIssue(report: C.Report): VerificationIssue | null {
  const issue = report.issue;
  if (!issue) return null;
  const { into, from, name } = issue.resolution;
  return {
    title: `Layer ${pad2(issue.layer)} fails on its own`,
    summary: issue.explanation.split(/(?<=\.)\s/)[0] ?? issue.explanation,
    layerIndex: issue.layer,
    test: issue.test,
    expected: issue.expected,
    found: issue.found,
    log: issue.log_excerpt ?? "",
    attempts: report.repairs.length,
    explanation: issue.explanation,
    resolution: {
      id: "merge",
      label: `Merge Layer ${pad2(from)} into Layer ${pad2(into)}`,
      description: `Creates “${name}” and verifies the stack again. No code changes.`,
    },
  };
}

/**
 * Bob's numbers for a run. What Bob reported wins; counts it didn't report are taken from
 * the run's own events (tool calls the hooks saw, cleave_* calls, subagents), and the
 * duration from the report's timestamps. Nothing is estimated.
 */
export function toBob(report: C.Report, counts: Record<string, number> = {}): BobRunStats {
  const bob = report.bob;
  const counted = (type: string) => (counts[type] ? counts[type] : null);
  const hookCalls = (counts["hook.allowed"] ?? 0) + (counts["hook.blocked"] ?? 0);
  const ranMs = report.finished_at ? new Date(report.finished_at).getTime() - new Date(report.started_at).getTime() : null;
  return {
    surface: bob?.surface === "bob_run" ? "bob run" : "Bob IDE",
    mode: bob?.mode ?? "✂ Cleave",
    bobcoins: bob?.bobcoins ?? null,
    tokens: bob?.tokens ?? null,
    toolCalls: bob?.tool_calls ?? (hookCalls || null),
    mcpCalls: bob?.mcp_calls ?? counted("mcp.called"),
    subagents: bob?.subagents ?? counted("subagent.spawned"),
    durationSec:
      bob?.duration_ms !== null && bob?.duration_ms !== undefined
        ? Math.round(bob.duration_ms / 1000)
        : ranMs !== null && ranMs >= 0
          ? Math.round(ranMs / 1000)
          : null,
    hookAllowed: report.hook.allowed,
    hookBlocked: report.hook.blocked,
  };
}

function toLayers(report: C.Report, rows: LayerRow[], edges: C.Graph["edges"]): Layer[] {
  const byIndex = new Map(rows.map((r) => [r.index, r]));
  const lastRound = report.rounds[report.rounds.length - 1];
  return report.layers.map((l) => {
    const row = byIndex.get(l.index);
    const inLayer = new Set(l.atoms);
    const failedEarlier = report.rounds
      .slice(0, -1)
      .some((r) => r.results.some((x) => x.layer === l.index && x.status !== "pass"));
    const last = lastRound?.results.find((x) => x.layer === l.index);
    return {
      index: l.index,
      name: l.name,
      rationale: l.rationale ?? "",
      status: l.status,
      atomIds: l.atoms,
      additions: l.added,
      deletions: l.removed,
      files: l.files,
      testFiles: l.files.filter((f) => /(^|\/)tests?\/|(^|\/)test_[^/]*$|_test\.py$|conftest\.py$/.test(f)).length,
      dependencyCount: edges.filter((e) => inLayer.has(e.from)).length,
      branch: l.branch,
      testsPassed: l.tests_passed ?? last?.tests_passed ?? 0,
      testsFailed: l.tests_failed ?? last?.tests_failed ?? 0,
      durationMs: l.duration_ms ?? last?.duration_ms ?? 0,
      repairedInRound: l.status === "pass" && failedEarlier ? report.rounds.length : null,
      prNumber: row?.prNumber ?? null,
      prUrl: row?.prUrl ?? null,
    };
  });
}

export interface StackRows {
  stack: StackRow;
  repo: RepositoryRow;
  run: RunRow | null;
  atoms: AtomRow[];
  layers: LayerRow[];
  labels: C.Plan["labels"];
  /** Number of the run's events per type, for stats Bob didn't report. */
  eventCounts?: Record<string, number>;
}

export function toStack({ stack, repo, run, atoms, layers, labels, eventCounts }: StackRows): Stack {
  const [, repoName = repo.fullName] = repo.fullName.split("/");
  const report = run?.report;
  const graph = run?.graph ?? { version: 1 as const, edges: [], groups: [] };
  const uiAtoms = atoms.map((a) => toAtom(a, labels));
  const status = toStatus(stack.status);
  return {
    id: stack.id,
    repoId: repo.id,
    repoName,
    repoFullName: repo.fullName,
    repoUrl: `https://github.com/${repo.fullName}`,
    prNumber: stack.prNumber ?? 0,
    title: stack.title,
    branch: stack.headBranch ?? stack.headSha.slice(0, 7),
    base: stack.baseBranch ?? stack.baseSha.slice(0, 7),
    status,
    visibility: stack.visibility,
    additions: uiAtoms.reduce((s, a) => s + a.additions, 0),
    deletions: uiAtoms.reduce((s, a) => s + a.deletions, 0),
    filesChanged: new Set(uiAtoms.map((a) => a.file)).size,
    layers: report ? toLayers(report, layers, graph.edges) : [],
    atoms: uiAtoms,
    dependencies: toDependencies(graph),
    verification: {
      state: report?.status ?? "failed",
      command: report?.command ?? "",
      headTree: report?.head_tree ?? stack.headTree,
      topTree: report?.top_tree ?? "",
      foreignLines: report?.foreign_lines ?? 0,
      checks: report ? toChecks(report) : [],
      rounds: report ? toRounds(report) : [],
      repairs: report ? toRepairs(report) : [],
      issue: report ? toIssue(report) : null,
    },
    bob: report
      ? toBob(report, eventCounts)
      : { surface: "Bob IDE", mode: "✂ Cleave", bobcoins: null, tokens: null, toolCalls: null, mcpCalls: null, subagents: null, durationSec: null, hookAllowed: 0, hookBlocked: 0 },
    createdAt: stack.createdAt.toISOString(),
    updatedAt: stack.updatedAt.toISOString(),
    publishedAt: report?.publish?.published_at ?? (stack.status === "published" ? iso(stack.updatedAt) : null),
    analysis: null,
    error: report?.error ?? run?.error ?? null,
    runId: run?.id ?? null,
  };
}

export function toSummary(stack: StackRow, repo: RepositoryRow, run: Pick<RunRow, "report" | "graph"> | null): StackSummary {
  const [, repoName = repo.fullName] = repo.fullName.split("/");
  const layers = run?.report.layers ?? [];
  return {
    id: stack.id,
    repoId: repo.id,
    repoName,
    prNumber: stack.prNumber ?? 0,
    title: stack.title,
    status: toStatus(stack.status),
    layerCount: layers.length,
    atomCount: layers.reduce((s, l) => s + l.atoms.length, 0),
    dependencyCount: run?.graph.edges.length ?? 0,
    additions: layers.reduce((s, l) => s + l.added, 0),
    deletions: layers.reduce((s, l) => s + l.removed, 0),
    updatedAt: stack.updatedAt.toISOString(),
  };
}

// --- Activity ---------------------------------------------------------------

const sourceOf: Record<C.Event["source"], ActivitySource> = {
  engine: "engine",
  bob: "bob",
  mcp: "bob",
  hook: "hook",
  runner: "engine",
};

type Payload = Record<string, unknown>;
const num = (p: Payload, k: string) => (typeof p[k] === "number" ? (p[k] as number) : null);
const str = (p: Payload, k: string) => (typeof p[k] === "string" ? (p[k] as string) : null);

function plural(n: number | null, one: string, many = `${one}s`) {
  return n === null ? many : `${n} ${n === 1 ? one : many}`;
}

/** Title, detail and tone for known event types. Payload `title`/`detail` override them. */
function describeEvent(type: string, p: Payload, tool: string | null): { title: string; detail: string; tone: ActivityTone } {
  const layer = num(p, "layer");
  const round = num(p, "round");
  switch (type) {
    case "run.started":
      return { title: "Cleave run started", detail: str(p, "head_branch") ?? str(p, "head") ?? "Splitting the change", tone: "accent" };
    case "run.finished":
    case "run.completed":
      return { title: "Run finished", detail: str(p, "status") ?? "", tone: str(p, "status") === "verified" ? "ok" : "neutral" };
    case "atoms.cut":
      return { title: "Change cut into atoms", detail: `${plural(num(p, "atoms"), "atom")} from ${plural(num(p, "files"), "file")}`, tone: "neutral" };
    case "graph.built":
      return { title: "Dependencies mapped", detail: `${plural(num(p, "edges"), "dependency", "dependencies")} found by static analysis`, tone: "neutral" };
    case "slices.written":
      return { title: "Slices prepared for subagents", detail: plural(num(p, "slices"), "slice"), tone: "neutral" };
    case "subagent.spawned":
      return { title: "Subagent started", detail: str(p, "slice") ?? "Read-only explore subagent", tone: "neutral" };
    case "subagent.finished":
      return { title: "Subagent labeled the change", detail: `${plural(num(p, "atoms"), "atom")} labeled`, tone: "neutral" };
    case "plan.proposed":
    case "plan.checked": {
      const violations = num(p, "violations") ?? (Array.isArray(p.violations) ? p.violations.length : null);
      return {
        title: type === "plan.proposed" ? `Plan v${num(p, "version") ?? 0} proposed` : "Plan checked",
        detail: `${plural(num(p, "layers"), "layer")} · ${plural(violations, "violation")}`,
        tone: violations ? "attention" : "neutral",
      };
    }
    case "verify.started":
      return { title: `Verification round ${round ?? ""} started`.replace("  ", " "), detail: plural(num(p, "layers"), "worktree"), tone: "neutral" };
    case "layer.passed":
      return { title: `Layer ${pad2(layer ?? 0)} passed`, detail: plural(num(p, "tests_passed") ?? num(p, "tests"), "test") + " passed", tone: "ok" };
    case "layer.failed":
      return { title: `Layer ${pad2(layer ?? 0)} failed`, detail: str(p, "test") ?? str(p, "message") ?? "Check command failed", tone: "attention" };
    case "verify.passed":
      return { title: "Verification passed", detail: "Every layer passes on its own", tone: "ok" };
    case "atoms.moved": {
      const count = Array.isArray(p.atoms) ? p.atoms.length : num(p, "count");
      return { title: `Bob moved ${plural(count, "atom")}`, detail: str(p, "reason") ?? `To layer ${pad2(num(p, "to_layer") ?? 0)}`, tone: "accent" };
    }
    case "review.required":
      return { title: "Review required", detail: `Layer ${pad2(layer ?? 0)} can't pass on its own`, tone: "attention" };
    case "layers.merged":
      return { title: "Layers merged", detail: str(p, "name") ?? "", tone: "accent" };
    case "layer.described":
      return { title: `Layer ${pad2(layer ?? 0)} described`, detail: str(p, "title") ?? "", tone: "neutral" };
    case "hook.allowed":
      return { title: `Guard allowed ${tool ?? "a tool call"}`, detail: "Read-only or Cleave tool", tone: "neutral" };
    case "hook.blocked":
      return { title: `Guard blocked ${tool ?? "a tool call"}`, detail: str(p, "reason") ?? "Writes are blocked while a run is active", tone: "attention" };
    case "mcp.called":
      return { title: `Bob called ${tool ?? str(p, "tool") ?? "a Cleave tool"}`, detail: str(p, "summary") ?? "", tone: "neutral" };
    case "stack.published":
      return { title: "Stack published", detail: plural(num(p, "pull_requests"), "pull request"), tone: "ok" };
    default: {
      const words = type.replace(/[._]/g, " ");
      return { title: words[0]!.toUpperCase() + words.slice(1), detail: "", tone: "neutral" };
    }
  }
}

/** One line for a cleave_* call, from its arguments. */
function callSummary(tool: string | null, a: Payload): string {
  switch (tool) {
    case "cleave_start":
      return str(a, "head") && str(a, "base") ? `${str(a, "head")} onto ${str(a, "base")}` : "";
    case "cleave_propose_plan":
      return Array.isArray(a.layers) ? plural(a.layers.length, "layer") : "";
    case "cleave_move_atoms":
      return str(a, "reason") ?? (Array.isArray(a.ids) ? `${plural(a.ids.length, "atom")} to layer ${num(a, "to_layer") ?? ""}` : "");
    case "cleave_describe_layer":
      return num(a, "n") !== null ? `Layer ${pad2(num(a, "n")!)}: ${str(a, "title") ?? ""}` : "";
    case "cleave_read_log":
      return num(a, "layer") !== null ? `Layer ${pad2(num(a, "layer")!)}, round ${num(a, "round") ?? "latest"}` : "";
    case "cleave_verify_status":
      return num(a, "round") !== null ? `Round ${num(a, "round")}` : "";
    default:
      return "";
  }
}

function fieldsOf(p: Payload): { label: string; value: string }[] {
  return Object.entries(p)
    .filter(([k, v]) => !["title", "detail", "code", "tone"].includes(k) && v !== null && ["string", "number", "boolean"].includes(typeof v))
    .slice(0, 8)
    .map(([k, v]) => ({ label: k.replace(/_/g, " ").replace(/^./, (c) => c.toUpperCase()), value: String(v) }));
}

export function toActivity(row: Pick<EventRow, "id" | "ts" | "source" | "type" | "tool" | "payload">, stackId: string): ActivityEvent {
  const raw = row.payload ?? {};
  // mcp.called payloads are Bob's tool arguments (older engines put them at the top level):
  // show them as fields, never as the event's title or detail.
  const isCall = row.type === "mcp.called";
  // For these types a payload `title` is data (the layer's title), not the event's heading.
  const titleIsData = row.type === "layer.described";
  const args = isCall ? ((typeof raw.arguments === "object" && raw.arguments ? raw.arguments : raw) as Payload) : null;
  const p: Payload = isCall ? { summary: callSummary(row.tool, args ?? {}) } : raw;
  const described = describeEvent(row.type, p, row.tool);
  const tone = ["neutral", "ok", "attention", "accent"].includes(String(p.tone)) ? (p.tone as ActivityTone) : described.tone;
  const code =
    typeof p.code === "string"
      ? p.code
      : typeof p.plan === "object" && p.plan
        ? JSON.stringify(p.plan, null, 2)
        : args && Array.isArray(args.layers)
          ? JSON.stringify({ layers: args.layers }, null, 2)
          : null;
  return {
    id: String(row.id),
    stackId,
    title: (!titleIsData && str(p, "title")) || described.title,
    detail: (!titleIsData && str(p, "detail")) || described.detail,
    at: row.ts.toISOString(),
    source: sourceOf[row.source],
    tone,
    tool: row.tool,
    fields: fieldsOf(args ?? p),
    code,
  };
}
