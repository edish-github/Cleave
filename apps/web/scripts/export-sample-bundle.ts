/**
 * Test fixture: export a sample-workspace stack as a push bundle, so ingest and the live
 * pages can be exercised before the engine produces real runs. The output is sample data
 * and is labelled as such (run id starts with the date and "sample").
 *
 *   npx tsx scripts/export-sample-bundle.ts galaxium-travels-184 > test/fixtures/sample-bundle.json
 */
import { createHash } from "node:crypto";
import type * as C from "../src/lib/contracts";
import { buildStack } from "../src/services/sample/build";
import { stackSpecs } from "../src/services/sample/data/stacks";

const id = process.argv[2] ?? "galaxium-travels-184";
const spec = stackSpecs.find((s) => s.id === id);
if (!spec) throw new Error(`No sample stack ${id}`);
const built = buildStack(spec, { runs: {}, published: {}, resolved: {}, visibility: {}, profileName: null }, Date.now());
if (!built) throw new Error("Stack didn't build");
const { stack, activity } = built;

const hex = (s: string, n: number) => createHash("sha256").update(s).digest("hex").slice(0, n);
const atomId = new Map(stack.atoms.map((a) => [a.id, hex(`${a.file}\0${a.summary}`, 12)]));
const aid = (x: string) => atomId.get(x) ?? hex(x, 12);
const baseSha = hex(`${id}:base`, 40);
const headSha = hex(`${id}:head`, 40);
const headTree = /^[0-9a-f]{40}$/.test(stack.verification.headTree) ? stack.verification.headTree : hex(`${id}:tree`, 40);
const runId = `20260927-sample-${stack.prNumber}`;
const kind: Record<string, C.Atom["kind"]> = { hunk: "hunk", "new-file": "new_file", "deleted-file": "deleted_file" };

// Plan versions: undo repairs from the final plan to get v0, then replay them.
const finalLayers = stack.layers.map((l) => ({ name: l.name, rationale: l.rationale, atoms: l.atomIds.map(aid) }));
const repairs = stack.verification.repairs;
const v0 = finalLayers.map((l) => ({ ...l, atoms: [...l.atoms] }));
for (const r of [...repairs].reverse()) {
  const a = aid(r.atomId);
  v0[r.toLayer - 1]!.atoms = v0[r.toLayer - 1]!.atoms.filter((x) => x !== a);
  v0[r.fromLayer - 1]!.atoms.push(a);
}
const labels = Object.fromEntries(stack.atoms.map((a) => [aid(a.id), { concern: stack.layers[a.layerIndex - 1]?.name ?? "change", intent: a.summary.slice(0, 200) }]));
const plans: C.Plan[] = [{ version: 0, author: "bob", reason: null, layers: v0 as C.Plan["layers"], labels, violations: [] }];
let current = v0.map((l) => ({ ...l, atoms: [...l.atoms] }));
repairs.forEach((r, i) => {
  const a = aid(r.atomId);
  current = current.map((l) => ({ ...l, atoms: l.atoms.filter((x) => x !== a) }));
  current[r.toLayer - 1]!.atoms.push(a);
  plans.push({ version: i + 1, author: "bob", reason: r.reason, layers: current.map((l) => ({ ...l, atoms: [...l.atoms] })) as C.Plan["layers"], labels: null, violations: [] });
});

const report: C.Report = {
  version: 1,
  run_id: runId,
  status: stack.verification.state === "failed" ? "failed" : stack.verification.state,
  error: null,
  command: stack.verification.command,
  setup_command: "pip install -r requirements.txt",
  working_directory: "booking_system_backend",
  base_sha: baseSha,
  head_sha: headSha,
  head_tree: headTree,
  top_tree: headTree,
  foreign_lines: 0,
  plan_version: plans.length - 1,
  checks: stack.verification.checks.map((c) => ({ id: c.id, status: c.state, value: c.value, detail: c.evidence })) as C.Report["checks"],
  layers: stack.layers.map((l) => ({
    index: l.index,
    name: l.name,
    rationale: l.rationale,
    atoms: l.atomIds.map(aid),
    added: l.additions,
    removed: l.deletions,
    files: l.files,
    branch: l.branch,
    commit_sha: null,
    tree_sha: null,
    status: l.status,
    tests_passed: l.testsPassed,
    tests_failed: l.testsFailed,
    duration_ms: l.durationMs,
    description: null,
  })),
  rounds: stack.verification.rounds.map((r) => ({
    round: r.round,
    plan_version: r.round - 1,
    results: r.results.map((x) => ({
      layer: x.layerIndex,
      status: x.status,
      tests_passed: x.testsPassed,
      tests_failed: x.testsFailed,
      duration_ms: x.durationMs,
      failure: x.failure,
      log_excerpt: null,
    })),
  })),
  repairs: repairs.map((r) => ({ round: r.round, atom: aid(r.atomId), from_layer: r.fromLayer, to_layer: r.toLayer, reason: r.reason })),
  issue: null,
  hook: { allowed: stack.bob.hookAllowed, blocked: stack.bob.hookBlocked },
  bob: {
    surface: stack.bob.surface === "bob run" ? "bob_run" : "ide",
    mode: stack.bob.mode,
    task_id: null,
    bobcoins: stack.bob.bobcoins,
    tokens: stack.bob.tokens,
    tool_calls: stack.bob.toolCalls,
    mcp_calls: stack.bob.mcpCalls,
    subagents: stack.bob.subagents,
    duration_ms: stack.bob.durationSec === null ? null : stack.bob.durationSec * 1000,
  },
  publish: null,
  started_at: stack.createdAt,
  finished_at: stack.updatedAt,
};

const sourceMap: Record<string, C.Event["source"]> = { bob: "bob", engine: "engine", hook: "hook", github: "engine", you: "engine" };
const bundle: C.Bundle = {
  version: 1,
  kind: "cleave.bundle",
  run_id: runId,
  source: "ide",
  run_kind: "cleave",
  title: stack.title,
  repo: { full_name: stack.repoFullName, default_branch: stack.base },
  pull_request: { number: stack.prNumber, url: null, head_branch: stack.branch, base_branch: stack.base, author: null },
  eval: null,
  created_at: new Date().toISOString(),
  atoms: {
    version: 1,
    base_sha: baseSha,
    head_sha: headSha,
    head_tree: headTree,
    atoms: stack.atoms.map((a) => ({
      id: aid(a.id),
      file: a.file,
      old_file: null,
      kind: kind[a.kind] ?? "hunk",
      old_start: 0,
      old_len: 0,
      new_start: 0,
      new_len: 0,
      added: a.additions,
      removed: a.deletions,
      patch: a.patch ?? "",
      is_test: a.isTest,
      symbols: null,
    })),
  },
  graph: {
    version: 1,
    edges: stack.dependencies.map((d) => ({ from: aid(d.fromAtomId), to: aid(d.toAtomId), kind: d.kind, symbol: d.symbol, source: d.discoveredByVerification ? "verification" : "static" })),
    groups: [],
  },
  plans: plans as C.Bundle["plans"],
  report,
  events: [...activity].reverse().map((e) => ({
    ts: e.at,
    source: sourceMap[e.source] ?? "engine",
    type: "sample.event",
    run_id: runId,
    tool: e.tool,
    payload: { title: e.title, detail: e.detail, tone: e.tone, ...Object.fromEntries(e.fields.map((f) => [f.label.toLowerCase().replace(/\s+/g, "_"), f.value])), ...(e.code ? { code: e.code } : {}) },
  })),
};

process.stdout.write(JSON.stringify(bundle, null, 2) + "\n");
