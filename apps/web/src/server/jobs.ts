import "server-only";
import { randomBytes } from "node:crypto";
import { and, asc, eq, inArray, sql } from "drizzle-orm";
import type * as C from "@/lib/contracts";
import { db, schema } from "./db/client";
import type { JobRow, RepositoryRow, RunnerRow } from "./db/schema";
import { IngestError, ingestBundle, type IngestResult } from "./ingest";
import { validateBundle } from "./schemas";

/**
 * The runner protocol, server side. A runner authenticates with its token, long-polls
 * for a queued job of its user, streams events while it works and completes the job
 * with a bundle, which goes through the same ingest as `cleave push`.
 *
 *   POST /api/runner/claim                 -> Job (job.schema.json) or 204
 *   POST /api/runner/heartbeat             -> 204, or 409 when its job_id isn't running
 *   POST /api/runner/runs/:id/events       -> 204 (NDJSON of event.schema.json)
 *   POST /api/runner/runs/:id/complete     -> 200 {stack_id, …} or 204 (failed)
 */

/** How long a claim waits for a job before answering 204. */
export const CLAIM_WAIT_MS = 25_000;
const CLAIM_POLL_MS = 1_500;
/** A runner counts as online when it called in within this window. */
export const RUNNER_ONLINE_MS = 2 * 60_000;
/** Most events accepted in one batch. */
export const MAX_EVENTS_PER_BATCH = 500;

export class JobError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
  }
}

/** Same shape as the engine's run ids: 20260927-101500-a1b2c3 (UTC). */
export function newJobId(now = new Date()): string {
  const p = (n: number) => String(n).padStart(2, "0");
  const date = `${now.getUTCFullYear()}${p(now.getUTCMonth() + 1)}${p(now.getUTCDate())}`;
  const time = `${p(now.getUTCHours())}${p(now.getUTCMinutes())}${p(now.getUTCSeconds())}`;
  return `${date}-${time}-${randomBytes(3).toString("hex")}`;
}

export function toJobContract(job: JobRow, repo: RepositoryRow): C.Job {
  return {
    version: 1,
    job_id: job.id,
    kind: "split",
    repo: { full_name: repo.fullName, clone_url: `https://github.com/${repo.fullName}.git`, default_branch: repo.defaultBranch },
    pull_request: {
      number: job.prNumber,
      head_branch: job.headBranch,
      base_branch: job.baseBranch,
      title: job.title,
      url: job.prUrl,
      author: job.prAuthor,
    },
    config: job.config,
    mode: "cleave",
    created_at: job.createdAt.toISOString(),
  };
}

/** Atomically hand the oldest queued job of the runner's user to this runner. */
async function claimNext(runner: RunnerRow): Promise<C.Job | null> {
  const next = sql`(select ${schema.jobs.id} from ${schema.jobs}
    where ${schema.jobs.userId} = ${runner.userId} and ${schema.jobs.status} = 'queued'
    order by ${schema.jobs.createdAt} limit 1 for update skip locked)`;
  const now = new Date();
  const [job] = await db()
    .update(schema.jobs)
    .set({ status: "running", runnerId: runner.id, claimedAt: now, lastSeenAt: now })
    .where(eq(schema.jobs.id, next))
    .returning();
  if (!job) return null;
  const [repo] = await db().select().from(schema.repositories).where(eq(schema.repositories.id, job.repositoryId)).limit(1);
  if (!repo) throw new JobError("The job's repository no longer exists.", 410);
  return toJobContract(job, repo);
}

/** Wait up to CLAIM_WAIT_MS for a job. Returns null when none arrived or the runner hung up. */
export async function claimJob(runner: RunnerRow, signal: AbortSignal, waitMs = CLAIM_WAIT_MS): Promise<C.Job | null> {
  const deadline = Date.now() + waitMs;
  for (;;) {
    const job = await claimNext(runner);
    if (job || signal.aborted || Date.now() + CLAIM_POLL_MS > deadline) return job;
    await new Promise((resolve) => setTimeout(resolve, CLAIM_POLL_MS));
  }
}

export async function recordHeartbeat(runner: RunnerRow, beat: C.RunnerHeartbeat): Promise<void> {
  await db()
    .update(schema.runners)
    .set({
      lastSeenAt: new Date(),
      ...(beat.bob_version ? { bobVersion: beat.bob_version.slice(0, 80) } : {}),
      ...(beat.os ? { os: beat.os.slice(0, 80) } : {}),
    })
    .where(eq(schema.runners.id, runner.id));
  if (beat.job_id) {
    // Throws 409 when the job was cancelled or finished, so an idle runner learns to stop.
    const job = await runningJobFor(runner, beat.job_id);
    await db().update(schema.jobs).set({ lastSeenAt: new Date() }).where(eq(schema.jobs.id, job.id));
  }
}

/**
 * The job, if this runner holds it and it's still running. A cancelled job answers 409,
 * which tells the runner to stop.
 */
export async function runningJobFor(runner: RunnerRow, jobId: string): Promise<JobRow> {
  const [job] = await db()
    .select()
    .from(schema.jobs)
    .where(and(eq(schema.jobs.id, jobId), eq(schema.jobs.userId, runner.userId)))
    .limit(1);
  if (!job) throw new JobError(`No job ${jobId} for this runner's account.`, 404);
  if (job.runnerId !== runner.id) throw new JobError("Another runner holds this job.", 409);
  if (job.status !== "running") throw new JobError(`The job is ${job.status}; stop working on it.`, 409);
  return job;
}

export async function appendJobEvents(job: JobRow, events: C.Event[]): Promise<void> {
  if (events.length) {
    await db()
      .insert(schema.jobEvents)
      .values(
        events.map((e) => ({
          jobId: job.id,
          ts: new Date(e.ts),
          source: e.source,
          type: e.type,
          tool: e.tool ?? null,
          payload: e.payload as Record<string, unknown>,
        })),
      );
  }
  await db().update(schema.jobs).set({ lastSeenAt: new Date() }).where(eq(schema.jobs.id, job.id));
}

/** Finish a job. A succeeded job's bundle is validated and stored like a `cleave push`. */
export async function completeJob(runner: RunnerRow, job: JobRow, completion: C.JobCompletion): Promise<IngestResult | null> {
  const finish = (set: Partial<JobRow>) =>
    db()
      .update(schema.jobs)
      .set({ ...set, finishedAt: new Date(), lastSeenAt: new Date() })
      .where(and(eq(schema.jobs.id, job.id), inArray(schema.jobs.status, ["running"])));

  if (completion.status === "failed") {
    await finish({ status: "failed", error: (completion.error ?? "The runner reported a failure without a reason.").slice(0, 4000) });
    return null;
  }

  const checked = validateBundle(completion.bundle);
  if (!checked.ok) throw new JobError(`Bundle doesn't match /schemas/bundle.schema.json: ${checked.errors.join("; ")}`, 422);
  const bundle = checked.bundle;
  if (bundle.run_id !== job.id) throw new JobError(`Bundle run_id ${bundle.run_id} isn't this job (${job.id}).`, 422);
  if (bundle.source !== "runner") throw new JobError('A runner bundle must have source "runner".', 422);
  const [repo] = await db().select().from(schema.repositories).where(eq(schema.repositories.id, job.repositoryId)).limit(1);
  if (!repo || repo.fullName.toLowerCase() !== bundle.repo.full_name.toLowerCase()) {
    throw new JobError(`Bundle is for ${bundle.repo.full_name}, the job for ${repo?.fullName ?? "a removed repository"}.`, 422);
  }

  try {
    const stored = await ingestBundle(bundle, runner.userId, runner.id);
    await finish({ status: "succeeded", stackId: stored.stackId, error: null });
    return stored;
  } catch (e) {
    if (e instanceof IngestError) throw new JobError(e.message, e.status);
    throw e;
  }
}

/** Events of one job, oldest first. */
export async function jobEvents(jobId: string, limit = 2000) {
  return db().select().from(schema.jobEvents).where(eq(schema.jobEvents.jobId, jobId)).orderBy(asc(schema.jobEvents.id)).limit(limit);
}
