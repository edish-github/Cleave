import { ArrowRight, GitBranch } from "lucide-react";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { PageContainer, PageHeader, Section } from "@/components/layout/PageHeader";
import { AutoRefresh } from "@/components/live/AutoRefresh";
import { CancelRun } from "@/components/runs/CancelRun";
import { StackActivity } from "@/components/stack/StackActivity";
import { BackLink } from "@/components/stack/StackHeader";
import { Badge, type Tone } from "@/components/ui/Badge";
import { ButtonLink } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";
import { coinsOrDash, formatDateTime, formatNumber, timeAgo } from "@/lib/format";
import { routes } from "@/lib/site";
import { toTimeline } from "@/lib/timeline";
import type { RunJob } from "@/lib/types";
import { requestNow } from "@/server/queries";
import { api } from "@/services";

export const metadata: Metadata = { title: "Run" };

/** After this long without word from the runner, the page says so. */
const QUIET_MS = 3 * 60_000;

const statusMeta: Record<RunJob["status"], { label: string; tone: Tone }> = {
  queued: { label: "Waiting for a runner", tone: "neutral" },
  running: { label: "Running", tone: "accent" },
  succeeded: { label: "Finished", tone: "ok" },
  failed: { label: "Failed", tone: "bad" },
  cancelled: { label: "Cancelled", tone: "neutral" },
};

export default async function RunPage({ params }: { params: Promise<{ runId: string }> }) {
  const { runId } = await params;
  const run = await api.runs.get(runId);
  if (!run) notFound();
  const now = requestNow();
  const active = run.status === "queued" || run.status === "running";
  const quietFor = run.status === "running" && run.lastSeenAt ? now - new Date(run.lastSeenAt).getTime() : 0;
  const meta = statusMeta[run.status];
  const events = toTimeline(run.events, now);

  return (
    <PageContainer width="wide">
      {/* Queued and running jobs change every few seconds: re-read the page every 2 s. */}
      <AutoRefresh active={active} seconds={2} />
      <BackLink href={routes.newSplit(run.repoId, run.prNumber)}>New split</BackLink>
      <PageHeader
        className="mt-4"
        eyebrow={<Badge tone={meta.tone} dot pulse={active}>{meta.label}</Badge>}
        title={run.title}
        description={
          <span className="inline-flex flex-wrap items-center gap-x-2">
            {run.repoFullName} #{run.prNumber}
            <span className="inline-flex items-center gap-1 font-mono text-[13px]">
              <GitBranch className="size-3.5" />
              {run.headBranch} → {run.baseBranch}
            </span>
          </span>
        }
        actions={
          active ? (
            <CancelRun runId={run.id} />
          ) : run.stackId ? (
            <ButtonLink href={routes.stack(run.stackId)} trailingIcon={<ArrowRight className="size-4" />}>
              Open the stack
            </ButtonLink>
          ) : null
        }
      />

      <StatusLine run={run} now={now} quietFor={quietFor} />

      <div className="mt-10 grid grid-cols-1 gap-10 lg:grid-cols-[minmax(0,1fr)_320px]">
        <Section title="Events">
          {events.length ? (
            <StackActivity events={events} />
          ) : (
            <div className="rounded-2xl border border-line bg-surface">
              <EmptyState
                title={run.status === "queued" ? "Not started" : "No events yet"}
                description={
                  run.status === "queued"
                    ? "Events appear here once your runner claims the run."
                    : "The runner sends events as the split progresses."
                }
              />
            </div>
          )}
        </Section>
        <Section title="Settings">
          <dl className="divide-y divide-line rounded-2xl border border-line bg-surface text-[13px]">
            <Row label="Run id" value={run.id} mono />
            <Row label="Check" value={run.config.checkCommand} mono />
            <Row label="Setup" value={run.config.setupCommand ?? "—"} mono />
            <Row label="Directory" value={run.config.workingDirectory} mono />
            <Row label="Max layer" value={`${formatNumber(run.config.maxLayerLines)} lines`} />
            <Row label="Repairs" value={`up to ${formatNumber(run.config.maxRepairRounds)} rounds`} />
            <Row label="Bobcoin cap" value={coinsOrDash(run.config.bobcoinCap)} />
            <Row label="Queued" value={formatDateTime(run.createdAt)} />
            {run.claimedAt ? <Row label="Claimed" value={formatDateTime(run.claimedAt)} /> : null}
            {run.finishedAt ? <Row label="Finished" value={formatDateTime(run.finishedAt)} /> : null}
          </dl>
        </Section>
      </div>
    </PageContainer>
  );
}

function StatusLine({ run, now, quietFor }: { run: RunJob; now: number; quietFor: number }) {
  let text: string;
  let tone = "border-line bg-surface text-ink-2";
  switch (run.status) {
    case "queued":
      text = "Queued. Your runner picks it up the next time it asks for work.";
      break;
    case "running":
      text =
        quietFor > QUIET_MS
          ? `No word from ${run.runnerName ?? "the runner"} for ${timeAgo(run.lastSeenAt!, now).replace(" ago", "")}. It may have stopped; you can cancel the run.`
          : `Running on ${run.runnerName ?? "your runner"}${run.lastSeenAt ? `, last heard ${timeAgo(run.lastSeenAt, now)}` : ""}.`;
      if (quietFor > QUIET_MS) tone = "border-warn-line bg-warn-soft text-ink";
      break;
    case "succeeded":
      text = "The run finished and was stored as a run of its stack.";
      tone = "border-ok-line bg-ok-soft/60 text-ink";
      break;
    case "failed":
      text = run.error ?? "The runner reported a failure.";
      tone = "border-bad/25 bg-bad-soft text-ink";
      break;
    case "cancelled":
      text = run.error ?? "Cancelled.";
      break;
  }
  return <p className={`mt-6 rounded-xl border px-4 py-3 text-[14px] ${tone}`}>{text}</p>;
}

function Row({ label, value, mono = false }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="flex gap-4 px-4 py-2.5">
      <dt className="w-24 shrink-0 text-ink-3">{label}</dt>
      <dd className={`min-w-0 break-words text-ink ${mono ? "font-mono text-[12px]" : ""}`}>{value}</dd>
    </div>
  );
}
