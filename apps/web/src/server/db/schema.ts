/**
 * Postgres schema: the ten tables from the routes doc, section 9.
 *
 * A stack is one base -> head split of a pull request. A run is one execution of it
 * (a Cleave run or a baseline), so re-runs and baselines sit side by side. The values
 * of the five checks live in runs.report, validated by /schemas/report.schema.json.
 *
 * Change this file, then `npm run db:generate` to write a migration into ./drizzle.
 */
import { sql } from "drizzle-orm";
import {
  bigint,
  bigserial,
  boolean,
  index,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  primaryKey,
  real,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";
import type * as C from "@/lib/contracts";

const createdAt = () => timestamp("created_at", { withTimezone: true }).notNull().defaultNow();

export const stackStatus = pgEnum("stack_status", ["queued", "running", "verified", "review", "failed", "published"]);
export const visibility = pgEnum("visibility", ["private", "public"]);
export const runKind = pgEnum("run_kind", ["cleave", "baseline_b1"]);
export const runSource = pgEnum("run_source", ["ide", "runner"]);
export const runStatus = pgEnum("run_status", ["queued", "running", "verified", "review", "failed"]);

export interface UserSettings {
  bobcoinCap?: number;
  maxLayerLines?: number;
}

export interface RepoConfig {
  setupCommand?: string | null;
  checkCommand?: string;
  workingDirectory?: string;
  maxLayerLines?: number;
  bobcoinCap?: number;
}

export const users = pgTable("users", {
  id: uuid("id").primaryKey().defaultRandom(),
  githubId: bigint("github_id", { mode: "number" }).notNull().unique(),
  login: text("login").notNull(),
  name: text("name"),
  email: text("email"),
  avatarUrl: text("avatar_url"),
  settings: jsonb("settings").$type<UserSettings>().notNull().default({}),
  createdAt: createdAt(),
});

export const repositories = pgTable(
  "repositories",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    githubRepoId: bigint("github_repo_id", { mode: "number" }),
    fullName: text("full_name").notNull(),
    defaultBranch: text("default_branch").notNull().default("main"),
    language: text("language"),
    config: jsonb("config").$type<RepoConfig>().notNull().default({}),
    createdAt: createdAt(),
  },
  (t) => [uniqueIndex("repositories_user_full_name").on(t.userId, t.fullName)],
);

export const stacks = pgTable(
  "stacks",
  {
    id: text("id").primaryKey(),
    repositoryId: uuid("repository_id")
      .notNull()
      .references(() => repositories.id, { onDelete: "cascade" }),
    prNumber: integer("pr_number"),
    prUrl: text("pr_url"),
    prAuthor: text("pr_author"),
    title: text("title").notNull(),
    headBranch: text("head_branch"),
    baseBranch: text("base_branch"),
    baseSha: text("base_sha").notNull(),
    headSha: text("head_sha").notNull(),
    headTree: text("head_tree").notNull(),
    status: stackStatus("status").notNull().default("queued"),
    visibility: visibility("visibility").notNull().default("private"),
    featured: boolean("featured").notNull().default(false),
    latestRunId: text("latest_run_id"),
    evalGroup: text("eval_group"),
    evalDataset: text("eval_dataset"),
    groundTruth: jsonb("ground_truth"),
    createdAt: createdAt(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex("stacks_repo_base_head").on(t.repositoryId, t.baseSha, t.headSha),
    index("stacks_public").on(t.visibility, t.featured),
  ],
);

export const runners = pgTable("runners", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  tokenHash: text("token_hash").notNull().unique(),
  tokenPrefix: text("token_prefix").notNull(),
  lastSeenAt: timestamp("last_seen_at", { withTimezone: true }),
  bobVersion: text("bob_version"),
  os: text("os"),
  createdAt: createdAt(),
  revokedAt: timestamp("revoked_at", { withTimezone: true }),
});

export const runs = pgTable(
  "runs",
  {
    /** The engine's run id (e.g. 20260927-061502-a1b2c3). */
    id: text("id").primaryKey(),
    stackId: text("stack_id")
      .notNull()
      .references(() => stacks.id, { onDelete: "cascade" }),
    kind: runKind("kind").notNull().default("cleave"),
    source: runSource("source").notNull(),
    status: runStatus("status").notNull(),
    runnerId: uuid("runner_id").references(() => runners.id, { onDelete: "set null" }),
    bobTaskId: text("bob_task_id"),
    bobStats: jsonb("bob_stats").$type<C.BobStats | null>(),
    costCap: real("cost_cap"),
    graph: jsonb("graph").$type<C.Graph>().notNull(),
    report: jsonb("report").$type<C.Report>().notNull(),
    startedAt: timestamp("started_at", { withTimezone: true }).notNull(),
    finishedAt: timestamp("finished_at", { withTimezone: true }),
    error: text("error"),
    createdAt: createdAt(),
  },
  (t) => [index("runs_stack").on(t.stackId, t.createdAt)],
);

export const atoms = pgTable(
  "atoms",
  {
    runId: text("run_id")
      .notNull()
      .references(() => runs.id, { onDelete: "cascade" }),
    atomId: text("atom_id").notNull(),
    ordinal: integer("ordinal").notNull(),
    filePath: text("file_path").notNull(),
    oldFile: text("old_file"),
    kind: text("kind").$type<C.Atom["kind"]>().notNull(),
    oldStart: integer("old_start").notNull().default(0),
    oldLen: integer("old_len").notNull().default(0),
    newStart: integer("new_start").notNull().default(0),
    newLen: integer("new_len").notNull().default(0),
    added: integer("added").notNull(),
    removed: integer("removed").notNull(),
    isTest: boolean("is_test").notNull(),
    patch: text("patch").notNull(),
    symbols: jsonb("symbols").$type<C.Atom["symbols"]>(),
    layerIndex: integer("layer_index"),
  },
  (t) => [primaryKey({ columns: [t.runId, t.atomId] })],
);

export const planVersions = pgTable(
  "plan_versions",
  {
    runId: text("run_id")
      .notNull()
      .references(() => runs.id, { onDelete: "cascade" }),
    version: integer("version").notNull(),
    plan: jsonb("plan").$type<C.Plan>().notNull(),
    violations: jsonb("violations").$type<C.Plan["violations"]>().notNull(),
    author: text("author").$type<C.Plan["author"]>().notNull(),
    reason: text("reason"),
  },
  (t) => [primaryKey({ columns: [t.runId, t.version] })],
);

export const layers = pgTable(
  "layers",
  {
    runId: text("run_id")
      .notNull()
      .references(() => runs.id, { onDelete: "cascade" }),
    index: integer("index").notNull(),
    name: text("name").notNull(),
    rationale: text("rationale"),
    atomIds: text("atom_ids").array().notNull(),
    added: integer("added").notNull(),
    removed: integer("removed").notNull(),
    files: text("files").array().notNull().default(sql`'{}'::text[]`),
    branch: text("branch").notNull(),
    commitSha: text("commit_sha"),
    treeSha: text("tree_sha"),
    status: text("status").$type<"pass" | "fail">().notNull(),
    testsPassed: integer("tests_passed"),
    testsFailed: integer("tests_failed"),
    durationMs: integer("duration_ms"),
    description: text("description"),
    prNumber: integer("pr_number"),
    prUrl: text("pr_url"),
    ciStatus: text("ci_status"),
  },
  (t) => [primaryKey({ columns: [t.runId, t.index] })],
);

export const checks = pgTable(
  "checks",
  {
    id: bigserial("id", { mode: "number" }).primaryKey(),
    runId: text("run_id")
      .notNull()
      .references(() => runs.id, { onDelete: "cascade" }),
    round: integer("round").notNull(),
    planVersion: integer("plan_version").notNull(),
    layerIndex: integer("layer_index").notNull(),
    status: text("status").$type<"pass" | "fail" | "error" | "timeout">().notNull(),
    command: text("command").notNull(),
    durationMs: integer("duration_ms").notNull(),
    testsPassed: integer("tests_passed"),
    testsFailed: integer("tests_failed"),
    failureTest: text("failure_test"),
    failureMessage: text("failure_message"),
    logExcerpt: text("log_excerpt"),
  },
  (t) => [index("checks_run").on(t.runId, t.round, t.layerIndex)],
);

export const events = pgTable(
  "events",
  {
    id: bigserial("id", { mode: "number" }).primaryKey(),
    runId: text("run_id")
      .notNull()
      .references(() => runs.id, { onDelete: "cascade" }),
    ts: timestamp("ts", { withTimezone: true }).notNull(),
    source: text("source").$type<C.Event["source"]>().notNull(),
    type: text("type").notNull(),
    tool: text("tool"),
    payload: jsonb("payload").$type<Record<string, unknown>>().notNull(),
  },
  (t) => [index("events_run_ts").on(t.runId, t.ts)],
);

export type UserRow = typeof users.$inferSelect;
export type RepositoryRow = typeof repositories.$inferSelect;
export type StackRow = typeof stacks.$inferSelect;
export type RunRow = typeof runs.$inferSelect;
export type AtomRow = typeof atoms.$inferSelect;
export type LayerRow = typeof layers.$inferSelect;
export type CheckRow = typeof checks.$inferSelect;
export type EventRow = typeof events.$inferSelect;
export type RunnerRow = typeof runners.$inferSelect;
