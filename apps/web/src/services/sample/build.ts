import type {
  ActivityEvent,
  AnalysisState,
  Atom,
  Dependency,
  Layer,
  Repair,
  Stack,
  StackSummary,
  VerificationCheck,
  VerificationIssue,
  VerificationRound,
} from "@/lib/types";
import type { LayerSpec, StackSpec } from "./spec";
import type { SampleState } from "./state";
import { repositorySpecs } from "./data/repositories";

/** How long a sample analysis takes from "Analyze change" to a result. */
export const ANALYSIS_MS = 14_000;

const MINUTE = 60_000;
const pad2 = (n: number) => String(n).padStart(2, "0");

/** FNV-1a, 32-bit. Stable ids for atoms without a real content hash. */
function hash(input: string): string {
  let h = 0x811c9dc5;
  for (let i = 0; i < input.length; i++) {
    h ^= input.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return (h >>> 0).toString(16).padStart(8, "0");
}

export function slugify(value: string): string {
  return value
    .toLowerCase()
    .replace(/&/g, "and")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export function isTestFile(path: string): boolean {
  const base = path.split("/").pop() ?? path;
  return /(^|\/)tests?\//.test(path) || base.startsWith("test_") || base === "conftest.py";
}

/** Top-level area a file belongs to, for the change summary. */
export function areaOf(path: string): string {
  const parts = path.split("/");
  const inner = parts[0] === "booking_system_backend" ? parts.slice(1) : parts;
  const first = inner[0] ?? path;
  if (isTestFile(path)) return "tests";
  if (first === "server.py" || first === "api") return "api";
  if (first.endsWith(".md")) return "docs";
  if (first.startsWith(".")) return "config";
  if (inner.length === 1) return first.replace(/\.py$/, "");
  return first;
}

interface Timeline {
  startedAt: number;
  completedAt: number;
  analyzing: boolean;
  resolvedAt: number | null;
  publishedAt: number | null;
}

function timeline(spec: StackSpec, state: SampleState, now: number): Timeline | null {
  const run = state.runs[spec.id];
  if (spec.onDemand && run === undefined) return null;
  const startedAt = run ?? now - spec.runStartedMinutesAgo * MINUTE;
  const duration = run !== undefined ? ANALYSIS_MS : spec.bob.durationSec * 1000;
  const completedAt = startedAt + duration;
  const analyzing = run !== undefined && now < completedAt;
  const resolvedAt = state.resolved[spec.id] ?? null;
  const publishedAt =
    state.published[spec.id] ??
    (spec.status === "published" && run === undefined && spec.publishedMinutesAgo !== undefined
      ? now - spec.publishedMinutesAgo * MINUTE
      : null);
  return { startedAt, completedAt, analyzing, resolvedAt, publishedAt };
}

/** Final layers, with a reviewed merge applied when the visitor accepted it. */
function finalLayers(spec: StackSpec, merged: boolean): LayerSpec[] {
  if (!merged || !spec.issue) return spec.layers;
  const { into, from, name, rationale } = spec.issue.merge;
  const target = spec.layers[into - 1];
  const source = spec.layers[from - 1];
  if (!target || !source) return spec.layers;
  const combined: LayerSpec = {
    name,
    rationale,
    atoms: [...target.atoms, ...source.atoms],
    tests: source.tests,
    durationMs: source.durationMs,
  };
  return spec.layers.flatMap((layer, i) => {
    if (i === into - 1) return [combined];
    if (i === from - 1) return [];
    return [layer];
  });
}

/** The first plan Bob proposed, reconstructed by undoing repairs. */
function initialPlan(spec: StackSpec): { name: string; atoms: string[] }[] {
  const layers = spec.layers.map((l) => ({ name: l.name, atoms: l.atoms.map((a) => a.key) }));
  for (const repair of [...spec.repairs].reverse()) {
    const to = layers[repair.to - 1];
    const from = layers[repair.from - 1];
    if (!to || !from) continue;
    to.atoms = to.atoms.filter((k) => k !== repair.atom);
    from.atoms.push(repair.atom);
  }
  return layers;
}

export interface BuiltStack {
  stack: Stack;
  activity: ActivityEvent[];
}

export function buildStack(spec: StackSpec, state: SampleState, now: number): BuiltStack | null {
  const t = timeline(spec, state, now);
  if (!t) return null;
  const repo = repositorySpecs.find((r) => r.id === spec.repoId);
  if (!repo) return null;

  const merged = t.resolvedAt !== null && spec.issue !== undefined && !t.analyzing;
  const layerSpecs = finalLayers(spec, merged);
  const rounds = merged ? [...spec.rounds, { layers: layerSpecs.length }] : spec.rounds;
  const finalRound = rounds[rounds.length - 1];
  const finalFailures = new Map((finalRound?.failures ?? []).map((f) => [f.layer, f]));

  // Atoms, keyed by spec key for dependency lookup.
  const atomByKey = new Map<string, Atom>();
  const atoms: Atom[] = [];
  layerSpecs.forEach((layer, li) => {
    for (const a of layer.atoms) {
      const atom: Atom = {
        id: hash(`${spec.id}:${a.file}:${a.summary}`).slice(0, 7),
        layerIndex: li + 1,
        file: a.file,
        summary: a.summary,
        kind: a.kind ?? "hunk",
        additions: a.add,
        deletions: a.del ?? 0,
        isTest: isTestFile(a.file),
        patch: a.patch ?? null,
        patchTruncated: a.excerpt ?? false,
      };
      atoms.push(atom);
      atomByKey.set(a.key, atom);
    }
  });

  const dependencies: Dependency[] = spec.dependencies.flatMap((d, i) => {
    const from = atomByKey.get(d.from);
    const to = atomByKey.get(d.to);
    if (!from || !to) return [];
    return [
      {
        id: `dep-${i + 1}`,
        fromAtomId: from.id,
        toAtomId: to.id,
        symbol: d.symbol,
        kind: d.kind,
        discoveredByVerification: d.discovered ?? false,
      },
    ];
  });

  const published = t.publishedAt !== null && !t.analyzing;
  const layers: Layer[] = layerSpecs.map((layer, li) => {
    const index = li + 1;
    const layerAtoms = atoms.filter((a) => a.layerIndex === index);
    const failure = finalFailures.get(index);
    const failedEarlier = rounds
      .slice(0, -1)
      .findIndex((r) => (r.failures ?? []).some((f) => f.layer === index));
    return {
      index,
      name: layer.name,
      rationale: layer.rationale,
      status: failure ? "fail" : "pass",
      atomIds: layerAtoms.map((a) => a.id),
      additions: layerAtoms.reduce((s, a) => s + a.additions, 0),
      deletions: layerAtoms.reduce((s, a) => s + a.deletions, 0),
      files: [...new Set(layerAtoms.map((a) => a.file))],
      testFiles: new Set(layerAtoms.filter((a) => a.isTest).map((a) => a.file)).size,
      dependencyCount: dependencies.filter((d) => layerAtoms.some((a) => a.id === d.fromAtomId)).length,
      branch: `cleave/${slugify(spec.title)}/${index}-${slugify(layer.name)}`,
      testsPassed: failure ? layer.tests - failure.failed : layer.tests,
      testsFailed: failure ? failure.failed : 0,
      durationMs: layer.durationMs,
      repairedInRound: !failure && failedEarlier >= 0 ? rounds.length : null,
      prNumber: published ? spec.prStart + li : null,
    };
  });

  const verificationRounds: VerificationRound[] = rounds.map((r, ri) => {
    const failures = new Map((r.failures ?? []).map((f) => [f.layer, f]));
    return {
      round: ri + 1,
      planVersion: ri + 1,
      results: Array.from({ length: r.layers }, (_, i) => {
        const f = failures.get(i + 1);
        const reference = layers[Math.min(i, layers.length - 1)];
        const tests = reference ? reference.testsPassed + reference.testsFailed : 0;
        return {
          layerIndex: i + 1,
          status: f ? ("fail" as const) : ("pass" as const),
          testsPassed: f ? tests - f.failed : tests,
          testsFailed: f ? f.failed : 0,
          durationMs: reference?.durationMs ?? 0,
          failure: f ? { test: f.test, message: f.message } : null,
        };
      }),
    };
  });

  const repairs: Repair[] = spec.repairs.map((r) => ({
    round: r.afterRound + 1,
    atomId: atomByKey.get(r.atom)?.id ?? r.atom,
    fromLayer: r.from,
    toLayer: r.to,
    reason: r.reason,
  }));

  const inReview = spec.status === "review" && !merged;
  const failing = layers.filter((l) => l.status === "fail");
  const discovered = dependencies.filter((d) => d.discoveredByVerification).length;
  const top = layers[layers.length - 1];
  const short = spec.headTree.slice(0, 7);

  const checks: VerificationCheck[] = [
    {
      id: "coverage",
      label: "Atom coverage",
      description: "Every change appears in exactly one layer.",
      state: "pass",
      value: `${atoms.length} / ${atoms.length}`,
      evidence: `${atoms.length} atoms across ${layers.length} layers, none repeated or missing`,
    },
    {
      id: "order",
      label: "Dependency order",
      description: "Nothing depends on a later layer.",
      state: "pass",
      value: `${dependencies.length} / ${dependencies.length}`,
      evidence:
        discovered > 0
          ? `${dependencies.length - discovered} found by static analysis, ${discovered} found by verification`
          : `All ${dependencies.length} found by static analysis`,
    },
    {
      id: "fidelity",
      label: "Tree fidelity",
      description: "The last layer is identical to the original pull request.",
      state: "pass",
      value: "Identical",
      evidence: `Layer ${pad2(top?.index ?? layers.length)} tree ${short} = head tree ${short}`,
    },
    {
      id: "shippability",
      label: "Layer shippability",
      description: "Each layer passes the tests on its own.",
      state: inReview ? "attention" : "pass",
      value: `${layers.length - failing.length} / ${layers.length}`,
      evidence: inReview
        ? `Layer ${pad2(failing[0]?.index ?? 0)} fails \`${spec.command}\` on its own`
        : `Every layer passes \`${spec.command}\` on its own`,
    },
    {
      id: "partition",
      label: "No new code",
      description: "Bob only moved existing changes between layers.",
      state: "pass",
      value: "0 lines",
      evidence: `${spec.bob.hookAllowed} tool calls allowed, ${spec.bob.hookBlocked} source edits blocked`,
    },
  ];

  const issue: VerificationIssue | null =
    inReview && spec.issue
      ? {
          title: spec.issue.title,
          summary: spec.issue.summary,
          layerIndex: spec.issue.layer,
          test: spec.issue.test,
          expected: spec.issue.expected,
          found: spec.issue.found,
          log: spec.issue.log,
          attempts: spec.repairs.length,
          explanation: spec.issue.explanation,
          resolution: {
            id: "merge",
            label: `Merge Layer ${pad2(spec.issue.merge.from)} into Layer ${pad2(spec.issue.merge.into)}`,
            description: `Creates “${spec.issue.merge.name}” and verifies the stack again. No code changes.`,
          },
        }
      : null;

  const additions = atoms.reduce((s, a) => s + a.additions, 0);
  const deletions = atoms.reduce((s, a) => s + a.deletions, 0);
  const filesChanged = new Set(atoms.map((a) => a.file)).size;

  const status: Stack["status"] = t.analyzing
    ? "analyzing"
    : published
      ? "published"
      : inReview
        ? "review"
        : "verified";

  const analysis: AnalysisState | null = t.analyzing
    ? {
        startedAt: new Date(t.startedAt).toISOString(),
        durationMs: ANALYSIS_MS,
        stages: [
          { id: "read", label: "Read the change", detail: `${filesChanged} files · +${additions} −${deletions}`, startMs: 0, endMs: 1200 },
          { id: "atomize", label: "Cut into atoms", detail: `${atoms.length} atoms`, startMs: 1200, endMs: 3000 },
          { id: "graph", label: "Map dependencies", detail: `${dependencies.length} dependencies`, startMs: 3000, endMs: 4800 },
          { id: "plan", label: "Plan layers with Bob", detail: `${spec.bob.subagents} read-only subagents`, startMs: 4800, endMs: 9000 },
          { id: "verify", label: "Verify every layer", detail: `${layers.length} layers · ${spec.command}`, startMs: 9000, endMs: ANALYSIS_MS },
        ],
      }
    : null;

  const updatedAt = Math.max(
    t.analyzing ? t.startedAt : t.completedAt,
    t.resolvedAt ?? 0,
    published ? (t.publishedAt ?? 0) : 0,
  );

  const stack: Stack = {
    id: spec.id,
    repoId: spec.repoId,
    repoName: repo.name,
    repoFullName: `${repo.owner}/${repo.name}`,
    repoUrl: null,
    prNumber: spec.prNumber,
    title: spec.title,
    branch: spec.branch,
    base: spec.base,
    status,
    visibility: state.visibility[spec.id] ?? spec.visibility,
    additions,
    deletions,
    filesChanged,
    layers,
    atoms,
    dependencies,
    verification: {
      state: inReview ? "review" : "verified",
      command: spec.command,
      headTree: spec.headTree,
      topTree: spec.headTree,
      foreignLines: 0,
      checks,
      rounds: verificationRounds,
      repairs,
      issue,
    },
    bob: spec.bob,
    createdAt: new Date(t.startedAt).toISOString(),
    updatedAt: new Date(updatedAt).toISOString(),
    publishedAt: published && t.publishedAt ? new Date(t.publishedAt).toISOString() : null,
    analysis,
  };

  return { stack, activity: buildActivity(spec, stack, t, now, merged) };
}

export function summarize(stack: Stack): StackSummary {
  return {
    id: stack.id,
    repoId: stack.repoId,
    repoName: stack.repoName,
    prNumber: stack.prNumber,
    title: stack.title,
    status: stack.status,
    layerCount: stack.layers.length,
    atomCount: stack.atoms.length,
    dependencyCount: stack.dependencies.length,
    additions: stack.additions,
    deletions: stack.deletions,
    updatedAt: stack.updatedAt,
  };
}

function buildActivity(
  spec: StackSpec,
  stack: Stack,
  t: Timeline,
  now: number,
  merged: boolean,
): ActivityEvent[] {
  const events: ActivityEvent[] = [];
  const span = t.completedAt - t.startedAt;
  const at = (fraction: number) => new Date(t.startedAt + span * fraction).toISOString();
  let n = 0;
  const push = (e: Omit<ActivityEvent, "id" | "stackId">) =>
    events.push({ id: `${stack.id}-e${++n}`, stackId: stack.id, ...e });

  const discovered = stack.dependencies.filter((d) => d.discoveredByVerification).length;
  const plan = initialPlan(spec);
  const firstRoundLayers = spec.rounds[0]?.layers ?? stack.layers.length;

  push({
    title: "Cleave run started",
    detail: `${spec.bob.surface} · ${spec.bob.mode} mode`,
    at: at(0),
    source: "bob",
    tone: "neutral",
    tool: null,
    fields: [
      { label: "Surface", value: spec.bob.surface },
      { label: "Mode", value: spec.bob.mode },
      { label: "Base", value: spec.base },
      { label: "Head", value: spec.branch },
    ],
    code: null,
  });
  push({
    title: "Guard active",
    detail: "Bob can read files and call Cleave's tools. It cannot edit source.",
    at: at(0.01),
    source: "hook",
    tone: "neutral",
    tool: "PreToolUse",
    fields: [
      { label: "Allowed tool calls", value: String(spec.bob.hookAllowed) },
      { label: "Blocked", value: String(spec.bob.hookBlocked) },
      { label: "Policy", value: "read · cleave MCP · explore subagents" },
    ],
    code: null,
  });
  push({
    title: "Change cut into atoms",
    detail: `${stack.atoms.length} atoms from ${stack.filesChanged} files`,
    at: at(0.06),
    source: "engine",
    tone: "neutral",
    tool: "cleave_start",
    fields: [
      { label: "Atoms", value: String(stack.atoms.length) },
      { label: "Files", value: String(stack.filesChanged) },
      { label: "Lines", value: `+${stack.additions} −${stack.deletions}` },
    ],
    code: null,
  });
  push({
    title: "Dependencies mapped",
    detail: `${stack.dependencies.length - discovered} dependencies found by static analysis`,
    at: at(0.1),
    source: "engine",
    tone: "neutral",
    tool: "cleave_start",
    fields: [
      { label: "Dependencies", value: String(stack.dependencies.length - discovered) },
      { label: "Forced groups", value: "0" },
    ],
    code: null,
  });
  push({
    title: "Subagents labeled the change",
    detail: `${spec.bob.subagents} read-only subagents read ${stack.atoms.length} atoms in parallel`,
    at: at(0.3),
    source: "bob",
    tone: "neutral",
    tool: "explore",
    fields: [
      { label: "Subagents", value: `${spec.bob.subagents} × explore` },
      { label: "Atoms per subagent", value: `~${Math.ceil(stack.atoms.length / spec.bob.subagents)}` },
    ],
    code: null,
  });
  push({
    title: "Plan proposed",
    detail: `${firstRoundLayers} layers · 0 violations`,
    at: at(0.4),
    source: "bob",
    tone: "neutral",
    tool: "cleave_propose_plan",
    fields: [
      { label: "Plan", value: "v1" },
      { label: "Layers", value: String(firstRoundLayers) },
      { label: "Violations", value: "0" },
    ],
    code: JSON.stringify(
      { layers: plan.map((l) => ({ name: l.name, atoms: l.atoms.length })) },
      null,
      2,
    ),
  });

  const roundSpan = 0.5 / Math.max(spec.rounds.length, 1);
  spec.rounds.forEach((round, ri) => {
    const base = 0.45 + ri * roundSpan;
    push({
      title: `Verification round ${ri + 1} started`,
      detail: `${round.layers} worktrees · ${spec.command}`,
      at: at(base),
      source: "engine",
      tone: "neutral",
      tool: "cleave_verify",
      fields: [
        { label: "Round", value: String(ri + 1) },
        { label: "Worktrees", value: String(round.layers) },
        { label: "Command", value: spec.command },
      ],
      code: null,
    });
    for (const f of round.failures ?? []) {
      push({
        title: `Layer ${pad2(f.layer)} failed`,
        detail: `${f.failed} failing in ${f.test}`,
        at: at(base + roundSpan * 0.45),
        source: "engine",
        tone: "attention",
        tool: "cleave_verify",
        fields: [
          { label: "Layer", value: pad2(f.layer) },
          { label: "Test", value: f.test },
        ],
        code: f.message,
      });
    }
    const repair = spec.repairs.find((r) => r.afterRound === ri);
    if (repair) {
      const atom = stack.atoms.find((a) => a.id === hash(`${spec.id}:${atomFile(spec, repair.atom)}`).slice(0, 7));
      const label = atom ? `${atom.file.split("/").pop()} · ${atom.summary}` : repair.atom;
      push({
        title: "Bob moved 1 atom",
        detail: `${label} → Layer ${pad2(repair.to)}`,
        at: at(base + roundSpan * 0.8),
        source: "bob",
        tone: "accent",
        tool: "cleave_move_atoms",
        fields: [
          { label: "Atom", value: label },
          { label: "From", value: `Layer ${pad2(repair.from)}` },
          { label: "To", value: `Layer ${pad2(repair.to)}` },
          { label: "Reason", value: repair.reason },
        ],
        code: JSON.stringify(
          { ids: [atom?.id ?? repair.atom], to_layer: repair.to, reason: repair.reason },
          null,
          2,
        ),
      });
    }
  });

  if (spec.status === "review") {
    const failing = spec.issue?.layer ?? 0;
    push({
      title: "Review required",
      detail: `Layer ${pad2(failing)} still fails after ${spec.repairs.length} repairs`,
      at: at(1),
      source: "engine",
      tone: "attention",
      tool: null,
      fields: [
        { label: "Layer", value: pad2(failing) },
        { label: "Rounds", value: String(spec.rounds.length) },
        { label: "Repairs tried", value: String(spec.repairs.length) },
      ],
      code: spec.issue?.found ?? null,
    });
  } else {
    push({
      title: "Verification passed",
      detail: `All ${stack.layers.length} layers pass on their own`,
      at: at(1),
      source: "engine",
      tone: "ok",
      tool: "cleave_verify",
      fields: [
        { label: "Layers", value: `${stack.layers.length} / ${stack.layers.length}` },
        { label: "Top tree", value: stack.verification.topTree.slice(0, 7) },
        { label: "Head tree", value: stack.verification.headTree.slice(0, 7) },
      ],
      code: null,
    });
  }

  if (merged && t.resolvedAt && spec.issue) {
    push({
      title: `Layers ${pad2(spec.issue.merge.into)} and ${pad2(spec.issue.merge.from)} merged`,
      detail: `Now one layer: ${spec.issue.merge.name}`,
      at: new Date(t.resolvedAt).toISOString(),
      source: "you",
      tone: "neutral",
      tool: null,
      fields: [{ label: "New layer", value: spec.issue.merge.name }],
      code: null,
    });
    push({
      title: "Verification passed",
      detail: `All ${stack.layers.length} layers pass on their own`,
      at: new Date(t.resolvedAt + 1500).toISOString(),
      source: "engine",
      tone: "ok",
      tool: "cleave_verify",
      fields: [{ label: "Layers", value: `${stack.layers.length} / ${stack.layers.length}` }],
      code: null,
    });
  }

  if (stack.publishedAt) {
    const first = stack.layers[0]?.prNumber;
    const last = stack.layers[stack.layers.length - 1]?.prNumber;
    push({
      title: "Stack published",
      detail: `${stack.layers.length} pull requests · #${first}–#${last}`,
      at: stack.publishedAt,
      source: "you",
      tone: "ok",
      tool: null,
      fields: stack.layers.map((l) => ({ label: `#${l.prNumber}`, value: l.name })),
      code: null,
    });
  }

  return events
    .filter((e) => new Date(e.at).getTime() <= now)
    .sort((a, b) => new Date(b.at).getTime() - new Date(a.at).getTime());
}

function atomFile(spec: StackSpec, key: string): string {
  for (const layer of spec.layers) {
    const atom = layer.atoms.find((a) => a.key === key);
    if (atom) return `${atom.file}:${atom.summary}`;
  }
  return key;
}

export { pad2 };
