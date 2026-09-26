CREATE TYPE "public"."run_kind" AS ENUM('cleave', 'baseline_b1');--> statement-breakpoint
CREATE TYPE "public"."run_source" AS ENUM('ide', 'runner');--> statement-breakpoint
CREATE TYPE "public"."run_status" AS ENUM('queued', 'running', 'verified', 'review', 'failed');--> statement-breakpoint
CREATE TYPE "public"."stack_status" AS ENUM('queued', 'running', 'verified', 'review', 'failed', 'published');--> statement-breakpoint
CREATE TYPE "public"."visibility" AS ENUM('private', 'public');--> statement-breakpoint
CREATE TABLE "atoms" (
	"run_id" text NOT NULL,
	"atom_id" text NOT NULL,
	"ordinal" integer NOT NULL,
	"file_path" text NOT NULL,
	"old_file" text,
	"kind" text NOT NULL,
	"old_start" integer DEFAULT 0 NOT NULL,
	"old_len" integer DEFAULT 0 NOT NULL,
	"new_start" integer DEFAULT 0 NOT NULL,
	"new_len" integer DEFAULT 0 NOT NULL,
	"added" integer NOT NULL,
	"removed" integer NOT NULL,
	"is_test" boolean NOT NULL,
	"patch" text NOT NULL,
	"symbols" jsonb,
	"layer_index" integer,
	CONSTRAINT "atoms_run_id_atom_id_pk" PRIMARY KEY("run_id","atom_id")
);
--> statement-breakpoint
CREATE TABLE "checks" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"run_id" text NOT NULL,
	"round" integer NOT NULL,
	"plan_version" integer NOT NULL,
	"layer_index" integer NOT NULL,
	"status" text NOT NULL,
	"command" text NOT NULL,
	"duration_ms" integer NOT NULL,
	"tests_passed" integer,
	"tests_failed" integer,
	"failure_test" text,
	"failure_message" text,
	"log_excerpt" text
);
--> statement-breakpoint
CREATE TABLE "events" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"run_id" text NOT NULL,
	"ts" timestamp with time zone NOT NULL,
	"source" text NOT NULL,
	"type" text NOT NULL,
	"tool" text,
	"payload" jsonb NOT NULL
);
--> statement-breakpoint
CREATE TABLE "layers" (
	"run_id" text NOT NULL,
	"index" integer NOT NULL,
	"name" text NOT NULL,
	"rationale" text,
	"atom_ids" text[] NOT NULL,
	"added" integer NOT NULL,
	"removed" integer NOT NULL,
	"files" text[] DEFAULT '{}'::text[] NOT NULL,
	"branch" text NOT NULL,
	"commit_sha" text,
	"tree_sha" text,
	"status" text NOT NULL,
	"tests_passed" integer,
	"tests_failed" integer,
	"duration_ms" integer,
	"description" text,
	"pr_number" integer,
	"pr_url" text,
	"ci_status" text,
	CONSTRAINT "layers_run_id_index_pk" PRIMARY KEY("run_id","index")
);
--> statement-breakpoint
CREATE TABLE "plan_versions" (
	"run_id" text NOT NULL,
	"version" integer NOT NULL,
	"plan" jsonb NOT NULL,
	"violations" jsonb NOT NULL,
	"author" text NOT NULL,
	"reason" text,
	CONSTRAINT "plan_versions_run_id_version_pk" PRIMARY KEY("run_id","version")
);
--> statement-breakpoint
CREATE TABLE "repositories" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"github_repo_id" bigint,
	"full_name" text NOT NULL,
	"default_branch" text DEFAULT 'main' NOT NULL,
	"language" text,
	"config" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "runners" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"name" text NOT NULL,
	"token_hash" text NOT NULL,
	"token_prefix" text NOT NULL,
	"last_seen_at" timestamp with time zone,
	"bob_version" text,
	"os" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"revoked_at" timestamp with time zone,
	CONSTRAINT "runners_token_hash_unique" UNIQUE("token_hash")
);
--> statement-breakpoint
CREATE TABLE "runs" (
	"id" text PRIMARY KEY NOT NULL,
	"stack_id" text NOT NULL,
	"kind" "run_kind" DEFAULT 'cleave' NOT NULL,
	"source" "run_source" NOT NULL,
	"status" "run_status" NOT NULL,
	"runner_id" uuid,
	"bob_task_id" text,
	"bob_stats" jsonb,
	"cost_cap" real,
	"graph" jsonb NOT NULL,
	"report" jsonb NOT NULL,
	"started_at" timestamp with time zone NOT NULL,
	"finished_at" timestamp with time zone,
	"error" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "stacks" (
	"id" text PRIMARY KEY NOT NULL,
	"repository_id" uuid NOT NULL,
	"pr_number" integer,
	"pr_url" text,
	"pr_author" text,
	"title" text NOT NULL,
	"head_branch" text,
	"base_branch" text,
	"base_sha" text NOT NULL,
	"head_sha" text NOT NULL,
	"head_tree" text NOT NULL,
	"status" "stack_status" DEFAULT 'queued' NOT NULL,
	"visibility" "visibility" DEFAULT 'private' NOT NULL,
	"featured" boolean DEFAULT false NOT NULL,
	"latest_run_id" text,
	"eval_group" text,
	"ground_truth" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"github_id" bigint NOT NULL,
	"login" text NOT NULL,
	"name" text,
	"email" text,
	"avatar_url" text,
	"settings" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "users_github_id_unique" UNIQUE("github_id")
);
--> statement-breakpoint
ALTER TABLE "atoms" ADD CONSTRAINT "atoms_run_id_runs_id_fk" FOREIGN KEY ("run_id") REFERENCES "public"."runs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "checks" ADD CONSTRAINT "checks_run_id_runs_id_fk" FOREIGN KEY ("run_id") REFERENCES "public"."runs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "events" ADD CONSTRAINT "events_run_id_runs_id_fk" FOREIGN KEY ("run_id") REFERENCES "public"."runs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "layers" ADD CONSTRAINT "layers_run_id_runs_id_fk" FOREIGN KEY ("run_id") REFERENCES "public"."runs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "plan_versions" ADD CONSTRAINT "plan_versions_run_id_runs_id_fk" FOREIGN KEY ("run_id") REFERENCES "public"."runs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "repositories" ADD CONSTRAINT "repositories_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "runners" ADD CONSTRAINT "runners_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "runs" ADD CONSTRAINT "runs_stack_id_stacks_id_fk" FOREIGN KEY ("stack_id") REFERENCES "public"."stacks"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "runs" ADD CONSTRAINT "runs_runner_id_runners_id_fk" FOREIGN KEY ("runner_id") REFERENCES "public"."runners"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "stacks" ADD CONSTRAINT "stacks_repository_id_repositories_id_fk" FOREIGN KEY ("repository_id") REFERENCES "public"."repositories"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "checks_run" ON "checks" USING btree ("run_id","round","layer_index");--> statement-breakpoint
CREATE INDEX "events_run_ts" ON "events" USING btree ("run_id","ts");--> statement-breakpoint
CREATE UNIQUE INDEX "repositories_user_full_name" ON "repositories" USING btree ("user_id","full_name");--> statement-breakpoint
CREATE INDEX "runs_stack" ON "runs" USING btree ("stack_id","created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "stacks_repo_base_head" ON "stacks" USING btree ("repository_id","base_sha","head_sha");--> statement-breakpoint
CREATE INDEX "stacks_public" ON "stacks" USING btree ("visibility","featured");