import "server-only";
import { and, asc, count, desc, eq, inArray, isNotNull, isNull } from "drizzle-orm";
import { cache } from "react";
import type * as C from "@/lib/contracts";
import type {
  ActivityEvent,
  CiState,
  PullRequest,
  RunJob,
  RunJobSummary,
  RunnerInfo,
  SearchItem,
  Stack,
  StackSummary,
} from "@/lib/types";
import { db, schema } from "@/server/db/client";
import { ciState, countOpenPulls, getPull, getRepo, listOpenPulls, listUserRepos, pullAreas } from "@/server/github";
import { jobEvents, newJobId, RUNNER_ONLINE_MS } from "@/server/jobs";
import type { CleaveClient } from "../types";
import { toActivity, toRepository, toStack, toSummary, toUser } from "./map";

/**
 * Live implementation of CleaveClient: the signed-in user's data in Postgres.
 * Runs arrive through POST /api/ingest/bundle (`cleave push`); actions that need a
 * runner on the user's machine explain how to do them instead of pretending.
 */

export class NeedsRunnerError extends Error {}

const labelsOf = cache(async (runId: string, version: number): Promise<C.Plan["labels"]> => {
  const rows = await db()
    .select({ plan: schema.planVersions.plan })
    .from(schema.planVersions)
    .where(eq(schema.planVersions.runId, runId))
    .orderBy(desc(schema.planVersions.version));
  // Labels usually come with the first proposal; later versions may omit them.
  const exact = rows.find((r) => r.plan.version === version && r.plan.labels);
  return exact?.plan.labels ?? rows.find((r) => r.plan.labels)?.plan.labels ?? null;
});

export interface EvalMetrics {
  runId: string;
  valid: boolean;
  green: number;
  layers: number;
  foreignLines: number;
  largestLayer: number;
  bobcoins: number | null;
}

export interface EvalRow {
  stackId: string;
  group: string;
  dataset: string;
  title: string;
  repoFullName: string;
  lines: number;
  cleave: EvalMetrics | null;
  baseline: EvalMetrics | null;
}

function metrics(run: { id: string; report: C.Report }): EvalMetrics {
  const layers = run.report.layers;
  return {
    runId: run.id,
    valid: run.report.status === "verified",
    green: layers.filter((l) => l.status === "pass").length,
    layers: layers.length,
    foreignLines: run.report.foreign_lines,
    largestLayer: Math.max(0, ...layers.map((l) => l.added + l.removed)),
    bobcoins: run.report.bob?.bobcoins ?? null,
  };
}

/** Public evaluation table: for each constructed diff, the latest B1 and Cleave run. */
export async function evalResults(): Promise<EvalRow[]> {
  const rows = await db()
    .select({ stack: schema.stacks, repo: schema.repositories, run: { id: schema.runs.id, kind: schema.runs.kind, report: schema.runs.report, createdAt: schema.runs.createdAt } })
    .from(schema.stacks)
    .innerJoin(schema.repositories, eq(schema.repositories.id, schema.stacks.repositoryId))
    .innerJoin(schema.runs, eq(schema.runs.stackId, schema.stacks.id))
    .where(and(isNotNull(schema.stacks.evalGroup), eq(schema.stacks.visibility, "public")))
    .orderBy(asc(schema.stacks.evalGroup), asc(schema.stacks.evalDataset), desc(schema.runs.createdAt));
  const out = new Map<string, EvalRow>();
  for (const { stack, repo, run } of rows) {
    let row = out.get(stack.id);
    if (!row) {
      row = {
        stackId: stack.id,
        group: stack.evalGroup ?? "",
        dataset: stack.evalDataset ?? stack.title,
        title: stack.title,
        repoFullName: repo.fullName,
        lines: 0,
        cleave: null,
        baseline: null,
      };
      out.set(stack.id, row);
    }
    // Rows arrive newest first, so the first run of each kind is the latest.
    if (run.kind === "cleave" && !row.cleave) row.cleave = metrics(run);
    if (run.kind === "baseline_b1" && !row.baseline) row.baseline = metrics(run);
    if (!row.lines) row.lines = run.report.layers.reduce((s, l) => s + l.added + l.removed, 0);
  }
  return [...out.values()];
}

/** The newest public, verified or published live stack: what the landing page links to. */
export async function featuredLiveStack(): Promise<{ id: string; title: string; repoFullName: string; prNumber: number | null } | null> {
  const [row] = await db()
    .select({ id: schema.stacks.id, title: schema.stacks.title, fullName: schema.repositories.fullName, prNumber: schema.stacks.prNumber })
    .from(schema.stacks)
    .innerJoin(schema.repositories, eq(schema.repositories.id, schema.stacks.repositoryId))
    // Evaluation stacks live on /results; the landing page features a real pull request.
    .where(and(eq(schema.stacks.visibility, "public"), inArray(schema.stacks.status, ["verified", "published"]), isNull(schema.stacks.evalGroup)))
    .orderBy(desc(schema.stacks.featured), desc(schema.stacks.updatedAt))
    .limit(1);
  return row ? { id: row.id, title: row.title, repoFullName: row.fullName, prNumber: row.prNumber } : null;
}

/** True when a live stack with this id exists, whoever owns it and whatever its visibility. */
export async function liveStackExists(stackId: string): Promise<boolean> {
  const rows = await db().select({ id: schema.stacks.id }).from(schema.stacks).where(eq(schema.stacks.id, stackId)).limit(1);
  return rows.length > 0;
}

/** A full stack by id. `userId` null = public read (proof pages): only public stacks. */
export const loadStack = cache(async (stackId: string, userId: string | null): Promise<Stack | null> => {
  const [found] = await db()
    .select({ stack: schema.stacks, repo: schema.repositories })
    .from(schema.stacks)
    .innerJoin(schema.repositories, eq(schema.repositories.id, schema.stacks.repositoryId))
    .where(eq(schema.stacks.id, stackId))
    .limit(1);
  if (!found) return null;
  if (userId ? found.repo.userId !== userId : found.stack.visibility !== "public") return null;

  const runId = found.stack.latestRunId;
  const [run] = runId ? await db().select().from(schema.runs).where(eq(schema.runs.id, runId)).limit(1) : [];
  const [atoms, layers] = run
    ? await Promise.all([
        db().select().from(schema.atoms).where(eq(schema.atoms.runId, run.id)).orderBy(asc(schema.atoms.ordinal)),
        db().select().from(schema.layers).where(eq(schema.layers.runId, run.id)).orderBy(asc(schema.layers.index)),
      ])
    : [[], []];
  const [labels, counts] = run
    ? await Promise.all([
        labelsOf(run.id, run.report.plan_version),
        db()
          .select({ type: schema.events.type, n: count() })
          .from(schema.events)
          .where(eq(schema.events.runId, run.id))
          .groupBy(schema.events.type),
      ])
    : [null, []];
  const eventCounts = Object.fromEntries(counts.map((c) => [c.type, Number(c.n)]));
  return toStack({ stack: found.stack, repo: found.repo, run: run ?? null, atoms, layers, labels, eventCounts });
});

export class NeedsGitHubError extends Error {}

function jobSummary(job: typeof schema.jobs.$inferSelect, repoFullName: string): RunJobSummary {
  return {
    id: job.id,
    repoId: job.repositoryId,
    repoFullName,
    prNumber: job.prNumber,
    title: job.title,
    status: job.status,
    createdAt: job.createdAt.toISOString(),
    finishedAt: job.finishedAt?.toISOString() ?? null,
    stackId: job.stackId,
  };
}

export function createLiveClient(
  userId: string,
  sessionUser: { name: string; email: string },
  githubToken: string | null,
): CleaveClient {
  const token = () => {
    if (!githubToken) throw new NeedsGitHubError("This needs GitHub access. Sign in with GitHub.");
    return githubToken;
  };

  const userRow = cache(async () => {
    const [row] = await db().select().from(schema.users).where(eq(schema.users.id, userId)).limit(1);
    if (!row) throw new Error("Signed-in user not found");
    return row;
  });

  const repoRows = cache(async () =>
    db().select().from(schema.repositories).where(eq(schema.repositories.userId, userId)).orderBy(asc(schema.repositories.fullName)),
  );

  const stackSummaries = cache(async (): Promise<StackSummary[]> => {
    const rows = await db()
      .select({ stack: schema.stacks, repo: schema.repositories, report: schema.runs.report, graph: schema.runs.graph })
      .from(schema.stacks)
      .innerJoin(schema.repositories, eq(schema.repositories.id, schema.stacks.repositoryId))
      .leftJoin(schema.runs, eq(schema.runs.id, schema.stacks.latestRunId))
      .where(eq(schema.repositories.userId, userId))
      .orderBy(desc(schema.stacks.updatedAt));
    return rows.map((r) => toSummary(r.stack, r.repo, r.report && r.graph ? { report: r.report, graph: r.graph } : null));
  });

  const eventsFor = cache(async (stackIds: string[], limit: number): Promise<ActivityEvent[]> => {
    if (!stackIds.length) return [];
    const rows = await db()
      .select({ event: schema.events, stackId: schema.runs.stackId })
      .from(schema.events)
      .innerJoin(schema.runs, eq(schema.runs.id, schema.events.runId))
      .innerJoin(schema.stacks, and(eq(schema.stacks.id, schema.runs.stackId), eq(schema.stacks.latestRunId, schema.runs.id)))
      .where(inArray(schema.runs.stackId, stackIds))
      .orderBy(desc(schema.events.ts), desc(schema.events.id))
      .limit(limit);
    return rows.map((r) => toActivity(r.event, r.stackId));
  });

  const ownsStack = async (stackId: string) => Boolean(await loadStack(stackId, userId));

  return {
    source: "api",

    session: {
      async get() {
        return sessionUser;
      },
      async signIn() {
        throw new Error("Sign in with GitHub.");
      },
      async signInWithGitHub() {
        throw new Error("Use the GitHub sign-in action.");
      },
      async signUp() {
        throw new Error("Accounts come from GitHub.");
      },
      async signOut() {},
    },

    user: {
      async get() {
        return toUser(await userRow());
      },
      async updateProfile({ name }) {
        const [row] = await db().update(schema.users).set({ name: name.trim() }).where(eq(schema.users.id, userId)).returning();
        if (!row) throw new Error("User not found");
        return toUser(row);
      },
    },

    repositories: {
      async list() {
        const [repos, stacks] = await Promise.all([repoRows(), stackSummaries()]);
        const open = await Promise.all(
          repos.map((r) => (githubToken ? countOpenPulls(githubToken, r.fullName).catch(() => 0) : Promise.resolve(0))),
        );
        return repos.map((r, i) => {
          const own = stacks.filter((s) => s.repoId === r.id);
          return {
            ...toRepository(r),
            openPullRequests: open[i] ?? 0,
            stackCount: own.length,
            lastStackAt: own[0]?.updatedAt ?? null,
          };
        });
      },
      async get(repoId) {
        const row = (await repoRows()).find((r) => r.id === repoId);
        return row ? toRepository(row) : null;
      },
      async pullRequests(repoId): Promise<PullRequest[]> {
        const repo = (await repoRows()).find((r) => r.id === repoId);
        if (!repo || !githubToken) return [];
        const [pulls, stacks] = await Promise.all([
          listOpenPulls(githubToken, repo.fullName),
          stackSummaries(),
        ]);
        const limit = toRepository(repo).config.maxLayerLines;
        return pulls.map((p) => {
          const size = (p.additions ?? 0) + (p.deletions ?? 0);
          return {
            repoId,
            number: p.number,
            title: p.title,
            author: p.user?.login ?? "unknown",
            branch: p.head.ref,
            base: p.base.ref,
            additions: p.additions ?? 0,
            deletions: p.deletions ?? 0,
            filesChanged: p.changed_files ?? 0,
            areas: [],
            openedAt: p.created_at,
            stackId: stacks.find((s) => s.repoId === repoId && s.prNumber === p.number)?.id ?? null,
            belowThreshold: size < limit,
            analyzable: true,
          };
        });
      },
      async pullRequestAreas(repoId, prNumber) {
        const repo = (await repoRows()).find((r) => r.id === repoId);
        if (!repo || !githubToken) return [];
        return pullAreas(githubToken, repo.fullName, prNumber).catch(() => []);
      },
      async available() {
        if (!githubToken) return [];
        const [remote, local] = await Promise.all([listUserRepos(githubToken), repoRows()]);
        const connected = new Set(local.map((r) => r.fullName.toLowerCase()));
        return remote.map((r) => ({
          fullName: r.full_name,
          language: r.language,
          private: r.private,
          pushedAt: r.pushed_at,
          connected: connected.has(r.full_name.toLowerCase()),
        }));
      },
      async connect(fullName) {
        const remote = await getRepo(token(), fullName);
        const [row] = await db()
          .insert(schema.repositories)
          .values({
            userId,
            fullName: remote.full_name,
            githubRepoId: remote.id,
            defaultBranch: remote.default_branch,
            language: remote.language,
          })
          .onConflictDoUpdate({
            target: [schema.repositories.userId, schema.repositories.fullName],
            set: { githubRepoId: remote.id, defaultBranch: remote.default_branch, language: remote.language },
          })
          .returning({ id: schema.repositories.id });
        if (!row) throw new Error("Couldn't connect the repository.");
        return { repoId: row.id };
      },
      async updateConfig(repoId, config) {
        const row = (await repoRows()).find((r) => r.id === repoId);
        if (!row) throw new Error("Repository not found.");
        await db()
          .update(schema.repositories)
          .set({
            config: {
              ...row.config,
              checkCommand: config.checkCommand,
              setupCommand: config.setupCommand || null,
              workingDirectory: config.workingDirectory || ".",
              maxLayerLines: config.maxLayerLines,
              bobcoinCap: config.bobcoinCap,
            },
          })
          .where(and(eq(schema.repositories.id, repoId), eq(schema.repositories.userId, userId)));
      },
    },

    stacks: {
      list: stackSummaries,
      async get(stackId) {
        return loadStack(stackId, userId);
      },
      async getPublic(stackId) {
        return loadStack(stackId, null);
      },
      async layer(stackId, index) {
        const stack = await loadStack(stackId, userId);
        const layer = stack?.layers.find((l) => l.index === index);
        return stack && layer ? { stack, layer } : null;
      },
      async forRepository(repoId) {
        return (await stackSummaries()).filter((s) => s.repoId === repoId);
      },
      async start() {
        throw new NeedsRunnerError(
          "Live splits run on your machine: start one from New split with `cleave runner` running, or in Bob IDE with ✂ Cleave followed by `cleave push`.",
        );
      },
      async publish() {
        throw new NeedsRunnerError(
          "Publishing runs on your machine with your GitHub credentials: run `cleave publish` in the repository, then `cleave push` to update this page.",
        );
      },
      async resolveReview(stackId) {
        const stack = await loadStack(stackId, userId);
        const issue = stack?.verification.issue;
        throw new NeedsRunnerError(
          issue
            ? `Merging layers re-runs verification on your machine. In Bob IDE, ask ✂ Cleave to ${issue.resolution.label.toLowerCase()}, then run \`cleave push\`.`
            : "This stack has nothing to review.",
        );
      },
      async ciStatus(stackId) {
        const stack = await loadStack(stackId, userId);
        if (!stack || !githubToken) return {};
        const published = stack.layers.filter((l) => l.prNumber);
        const states = await Promise.all(
          published.map((l) => ciState(githubToken, stack.repoFullName, l.branch).catch((): CiState => "none")),
        );
        return Object.fromEntries(published.map((l, i) => [l.index, states[i] ?? "none"]));
      },
      async setVisibility(stackId, visibility) {
        if (!(await ownsStack(stackId))) throw new Error("Stack not found");
        await db().update(schema.stacks).set({ visibility }).where(eq(schema.stacks.id, stackId));
      },
    },

    runs: {
      async start({ repoId, prNumber }) {
        const repo = (await repoRows()).find((r) => r.id === repoId);
        if (!repo) throw new Error("Repository not found.");
        const pull = await getPull(token(), repo.fullName, prNumber);
        if (pull.state && pull.state !== "open") throw new Error(`Pull request #${prNumber} is ${pull.state}.`);
        const config = toRepository(repo).config;
        const id = newJobId();
        await db()
          .insert(schema.jobs)
          .values({
            id,
            userId,
            repositoryId: repo.id,
            prNumber,
            prUrl: pull.html_url,
            prAuthor: pull.user?.login ?? null,
            title: pull.title,
            headBranch: pull.head.ref,
            baseBranch: pull.base.ref,
            config: {
              check_command: config.checkCommand,
              setup_command: config.setupCommand || null,
              working_directory: config.workingDirectory || ".",
              max_layer_lines: config.maxLayerLines,
              max_repair_rounds: 3,
              bobcoin_cap: config.bobcoinCap,
            },
          });
        return { runId: id };
      },
      async get(runId): Promise<RunJob | null> {
        const [row] = await db()
          .select({ job: schema.jobs, repo: schema.repositories, runnerName: schema.runners.name })
          .from(schema.jobs)
          .innerJoin(schema.repositories, eq(schema.repositories.id, schema.jobs.repositoryId))
          .leftJoin(schema.runners, eq(schema.runners.id, schema.jobs.runnerId))
          .where(and(eq(schema.jobs.id, runId), eq(schema.jobs.userId, userId)))
          .limit(1);
        if (!row) return null;
        const { job, repo } = row;
        const events = await jobEvents(job.id);
        return {
          ...jobSummary(job, repo.fullName),
          headBranch: job.headBranch,
          baseBranch: job.baseBranch,
          runnerName: row.runnerName ?? null,
          claimedAt: job.claimedAt?.toISOString() ?? null,
          lastSeenAt: job.lastSeenAt?.toISOString() ?? null,
          error: job.error,
          config: {
            checkCommand: job.config.check_command,
            setupCommand: job.config.setup_command ?? null,
            workingDirectory: job.config.working_directory,
            maxLayerLines: job.config.max_layer_lines,
            maxRepairRounds: job.config.max_repair_rounds,
            bobcoinCap: job.config.bobcoin_cap,
          },
          // Newest first, like the stack's Activity tab.
          events: events.map((e) => toActivity(e, job.stackId ?? job.id)).reverse(),
        };
      },
      async recent(limit): Promise<RunJobSummary[]> {
        const rows = await db()
          .select({ job: schema.jobs, fullName: schema.repositories.fullName })
          .from(schema.jobs)
          .innerJoin(schema.repositories, eq(schema.repositories.id, schema.jobs.repositoryId))
          .where(eq(schema.jobs.userId, userId))
          .orderBy(desc(schema.jobs.createdAt))
          .limit(limit);
        return rows.map((r) => jobSummary(r.job, r.fullName));
      },
      async cancel(runId) {
        const [row] = await db()
          .update(schema.jobs)
          .set({ status: "cancelled", finishedAt: new Date(), error: "Cancelled from the browser." })
          .where(and(eq(schema.jobs.id, runId), eq(schema.jobs.userId, userId), inArray(schema.jobs.status, ["queued", "running"])))
          .returning({ id: schema.jobs.id });
        if (!row) throw new Error("This run has already finished.");
      },
      async runners(): Promise<RunnerInfo[]> {
        const rows = await db()
          .select()
          .from(schema.runners)
          .where(and(eq(schema.runners.userId, userId), isNull(schema.runners.revokedAt)))
          .orderBy(desc(schema.runners.lastSeenAt));
        const now = Date.now();
        return rows.map((r) => ({
          id: r.id,
          name: r.name,
          lastSeenAt: r.lastSeenAt?.toISOString() ?? null,
          bobVersion: r.bobVersion,
          os: r.os,
          online: Boolean(r.lastSeenAt && now - r.lastSeenAt.getTime() < RUNNER_ONLINE_MS),
        }));
      },
    },

    activity: {
      async forStack(stackId) {
        if (!(await ownsStack(stackId))) return [];
        return eventsFor([stackId], 2000);
      },
      async recent(limit) {
        const stacks = await stackSummaries();
        return eventsFor(
          stacks.map((s) => s.id),
          limit,
        );
      },
    },

    search: {
      async index(): Promise<SearchItem[]> {
        const [stacks, repos] = await Promise.all([stackSummaries(), repoRows()]);
        const pages: SearchItem[] = [
          { id: "go-overview", group: "Go to", label: "Overview", hint: "Home", href: "/app" },
          { id: "go-new", group: "Go to", label: "New split", hint: "Split a pull request", href: "/app/new" },
          { id: "go-stacks", group: "Go to", label: "Stacks", hint: "All stacks", href: "/app/stacks" },
          { id: "go-repos", group: "Go to", label: "Repositories", hint: "Connected repositories", href: "/app/repositories" },
          { id: "go-runners", group: "Go to", label: "Bob & runners", hint: "Runner tokens, cleave push", href: "/app/settings/runners" },
          { id: "go-bob", group: "Go to", label: "Bob IDE setup", hint: "Install the Cleave mode", href: "/docs/bob" },
        ];
        return [
          ...pages,
          ...stacks.map((s) => ({ id: `stack-${s.id}`, group: "Stacks" as const, label: s.title, hint: `${s.repoName} · #${s.prNumber}`, href: `/app/stacks/${s.id}` })),
          ...repos.map((r) => ({ id: `repo-${r.id}`, group: "Repositories" as const, label: r.fullName.split("/")[1] ?? r.fullName, hint: r.fullName, href: `/app/repositories/${r.id}` })),
        ];
      },
    },
  };
}
