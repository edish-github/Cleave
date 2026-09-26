import "server-only";
import { and, eq } from "drizzle-orm";
import type { Bundle } from "@/lib/contracts";
import { db, schema, type Db } from "./db/client";

export class IngestError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
  }
}

export interface IngestResult {
  stackId: string;
  runId: string;
  status: string;
  created: boolean;
}

type Tx = Parameters<Parameters<Db["transaction"]>[0]>[0];

function slug(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 48);
}

function chunk<T>(items: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < items.length; i += size) out.push(items.slice(i, i + size));
  return out;
}

/** Stack ids are readable (`galaxium-travels-1`) and globally unique. */
async function allocateStackId(tx: Tx, repoName: string, bundle: Bundle): Promise<string> {
  const base = slug(`${repoName}-${bundle.pull_request?.number ?? bundle.atoms.head_sha.slice(0, 7)}`) || "stack";
  const taken = await tx.select({ id: schema.stacks.id }).from(schema.stacks).where(eq(schema.stacks.id, base)).limit(1);
  if (!taken.length) return base;
  return `${base}-${bundle.atoms.head_sha.slice(0, 6)}`;
}

function stackStatus(bundle: Bundle): (typeof schema.stackStatus.enumValues)[number] {
  if (bundle.report.publish) return "published";
  return bundle.report.status;
}

/**
 * Store a validated bundle: repository, stack, run, and the run's atoms, plan versions,
 * layers, checks and events. Re-pushing the same run replaces it. Baseline runs attach to
 * the stack without changing its status.
 */
export async function ingestBundle(bundle: Bundle, userId: string, runnerId: string | null): Promise<IngestResult> {
  const { report, atoms, graph } = bundle;
  if (atoms.head_tree !== report.head_tree || atoms.base_sha !== report.base_sha || atoms.head_sha !== report.head_sha) {
    throw new IngestError("atoms.json and report.json describe different commits.", 422);
  }
  const known = new Set(atoms.atoms.map((a) => a.id));
  for (const layer of report.layers) {
    for (const id of layer.atoms) {
      if (!known.has(id)) throw new IngestError(`Layer ${layer.index} lists unknown atom ${id}.`, 422);
    }
  }

  const [, name = bundle.repo.full_name] = bundle.repo.full_name.split("/");
  const isBaseline = (bundle.run_kind ?? "cleave") !== "cleave";

  return db().transaction(async (tx) => {
    // Repository: one row per user and full name. Run settings follow the latest run.
    const config = {
      checkCommand: report.command,
      setupCommand: report.setup_command ?? null,
      workingDirectory: report.working_directory ?? ".",
    };
    const [repo] = await tx
      .insert(schema.repositories)
      .values({ userId, fullName: bundle.repo.full_name, defaultBranch: bundle.repo.default_branch ?? "main", config })
      .onConflictDoUpdate({
        target: [schema.repositories.userId, schema.repositories.fullName],
        set: { config, ...(bundle.repo.default_branch ? { defaultBranch: bundle.repo.default_branch } : {}) },
      })
      .returning();
    if (!repo) throw new IngestError("Couldn't store the repository.", 500);

    // A run id belongs to one user. Re-pushing it replaces the old copy.
    const [existingRun] = await tx
      .select({ id: schema.runs.id, repositoryId: schema.stacks.repositoryId })
      .from(schema.runs)
      .innerJoin(schema.stacks, eq(schema.stacks.id, schema.runs.stackId))
      .where(eq(schema.runs.id, bundle.run_id))
      .limit(1);
    if (existingRun && existingRun.repositoryId !== repo.id) {
      throw new IngestError(`Run ${bundle.run_id} already belongs to another repository.`, 409);
    }
    if (existingRun) await tx.delete(schema.runs).where(eq(schema.runs.id, bundle.run_id));

    // Stack: one per repository and base..head.
    let [stack] = await tx
      .select()
      .from(schema.stacks)
      .where(
        and(
          eq(schema.stacks.repositoryId, repo.id),
          eq(schema.stacks.baseSha, atoms.base_sha),
          eq(schema.stacks.headSha, atoms.head_sha),
        ),
      )
      .limit(1);
    const created = !stack;
    if (!stack) {
      [stack] = await tx
        .insert(schema.stacks)
        .values({
          id: await allocateStackId(tx, name, bundle),
          repositoryId: repo.id,
          prNumber: bundle.pull_request?.number ?? null,
          prUrl: bundle.pull_request?.url ?? null,
          prAuthor: bundle.pull_request?.author ?? null,
          title: bundle.title,
          headBranch: bundle.pull_request?.head_branch ?? null,
          baseBranch: bundle.pull_request?.base_branch ?? null,
          baseSha: atoms.base_sha,
          headSha: atoms.head_sha,
          headTree: atoms.head_tree,
          status: isBaseline ? "queued" : stackStatus(bundle),
          evalGroup: bundle.eval?.group ?? null,
          evalDataset: bundle.eval?.dataset ?? null,
          groundTruth: bundle.eval?.ground_truth ?? null,
          // Evaluation runs back the public /results table, so their proofs are public.
          visibility: bundle.eval ? "public" : "private",
        })
        .returning();
    }
    if (!stack) throw new IngestError("Couldn't store the stack.", 500);

    await tx.insert(schema.runs).values({
      id: bundle.run_id,
      stackId: stack.id,
      kind: bundle.run_kind ?? "cleave",
      source: bundle.source,
      status: report.status,
      runnerId,
      bobTaskId: report.bob?.task_id ?? null,
      bobStats: report.bob ?? null,
      costCap: null,
      graph,
      report,
      startedAt: new Date(report.started_at),
      finishedAt: new Date(report.finished_at),
      error: report.error ?? null,
    });

    const ordinal = new Map(atoms.atoms.map((a, i) => [a.id, i]));
    const layerOf = new Map<string, number>();
    for (const layer of report.layers) for (const id of layer.atoms) layerOf.set(id, layer.index);

    for (const rows of chunk(atoms.atoms, 200)) {
      await tx.insert(schema.atoms).values(
        rows.map((a) => ({
          runId: bundle.run_id,
          atomId: a.id,
          ordinal: ordinal.get(a.id) ?? 0,
          filePath: a.file,
          oldFile: a.old_file ?? null,
          kind: a.kind,
          oldStart: a.old_start ?? 0,
          oldLen: a.old_len ?? 0,
          newStart: a.new_start ?? 0,
          newLen: a.new_len ?? 0,
          added: a.added,
          removed: a.removed,
          isTest: a.is_test,
          patch: a.patch,
          symbols: a.symbols ?? null,
          layerIndex: layerOf.get(a.id) ?? null,
        })),
      );
    }

    await tx.insert(schema.planVersions).values(
      bundle.plans.map((p) => ({
        runId: bundle.run_id,
        version: p.version,
        plan: p,
        violations: p.violations,
        author: p.author,
        reason: p.reason ?? null,
      })),
    );

    const prByLayer = new Map((report.publish?.pull_requests ?? []).map((pr) => [pr.layer, pr]));
    if (report.layers.length) {
      await tx.insert(schema.layers).values(
        report.layers.map((l) => ({
          runId: bundle.run_id,
          index: l.index,
          name: l.name,
          rationale: l.rationale ?? null,
          atomIds: l.atoms,
          added: l.added,
          removed: l.removed,
          files: l.files,
          branch: l.branch,
          commitSha: l.commit_sha ?? null,
          treeSha: l.tree_sha ?? null,
          status: l.status,
          testsPassed: l.tests_passed ?? null,
          testsFailed: l.tests_failed ?? null,
          durationMs: l.duration_ms ?? null,
          description: l.description ?? null,
          prNumber: prByLayer.get(l.index)?.number ?? null,
          prUrl: prByLayer.get(l.index)?.url ?? null,
        })),
      );
    }

    const checkRows = report.rounds.flatMap((round) =>
      round.results.map((r) => ({
        runId: bundle.run_id,
        round: round.round,
        planVersion: round.plan_version,
        layerIndex: r.layer,
        status: r.status,
        command: report.command,
        durationMs: r.duration_ms,
        testsPassed: r.tests_passed ?? null,
        testsFailed: r.tests_failed ?? null,
        failureTest: r.failure?.test ?? null,
        failureMessage: r.failure?.message ?? null,
        logExcerpt: r.log_excerpt ?? null,
      })),
    );
    for (const rows of chunk(checkRows, 200)) await tx.insert(schema.checks).values(rows);

    for (const rows of chunk(bundle.events, 500)) {
      await tx.insert(schema.events).values(
        rows.map((e) => ({
          runId: bundle.run_id,
          ts: new Date(e.ts),
          source: e.source,
          type: e.type,
          tool: e.tool ?? null,
          payload: e.payload,
        })),
      );
    }

    // Either kind of evaluation run marks an existing stack as part of the public evaluation.
    if (bundle.eval && !created) {
      await tx
        .update(schema.stacks)
        .set({
          evalGroup: bundle.eval.group,
          evalDataset: bundle.eval.dataset,
          groundTruth: bundle.eval.ground_truth ?? null,
          visibility: "public",
        })
        .where(eq(schema.stacks.id, stack.id));
    }

    if (!isBaseline) {
      await tx
        .update(schema.stacks)
        .set({
          status: stackStatus(bundle),
          latestRunId: bundle.run_id,
          headTree: atoms.head_tree,
          title: bundle.title,
          ...(bundle.pull_request
            ? {
                prNumber: bundle.pull_request.number,
                prUrl: bundle.pull_request.url ?? null,
                prAuthor: bundle.pull_request.author ?? null,
                headBranch: bundle.pull_request.head_branch,
                baseBranch: bundle.pull_request.base_branch,
              }
            : {}),
          updatedAt: new Date(),
        })
        .where(eq(schema.stacks.id, stack.id));
    }

    return { stackId: stack.id, runId: bundle.run_id, status: isBaseline ? stack.status : stackStatus(bundle), created };
  });
}
