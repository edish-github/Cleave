import { ArrowRight, GitPullRequest, Plus } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { PageContainer, PageHeader, Section } from "@/components/layout/PageHeader";
import { ActivityTimeline } from "@/components/stack/ActivityTimeline";
import { StackList } from "@/components/stack/StackList";
import { StatusMark } from "@/components/stack/StackStatus";
import { ButtonLink } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";
import { Stat } from "@/components/ui/Stat";
import { formatNumber, plural, timeAgo } from "@/lib/format";
import { routes } from "@/lib/site";
import { toTimeline } from "@/lib/timeline";
import type { StackSummary } from "@/lib/types";
import { requestNow } from "@/server/queries";
import { api } from "@/services";

export const metadata: Metadata = { title: "Overview" };

function summaryLine(stacks: StackSummary[]): string {
  const analyzing = stacks.filter((s) => s.status === "analyzing").length;
  const review = stacks.filter((s) => s.status === "review").length;
  const ready = stacks.filter((s) => s.status === "verified").length;
  const parts: string[] = [];
  if (analyzing) parts.push(`${plural(analyzing, "analysis", "analyses")} running`);
  if (review) parts.push(`${review === 1 ? "one stack needs" : `${review} stacks need`} your review`);
  if (ready) parts.push(`${ready === 1 ? "one is" : `${ready} are`} ready to publish`);
  if (!parts.length) return "Everything is published. Start a split when the next large pull request lands.";
  const sentence = parts.length > 1 ? `${parts.slice(0, -1).join(", ")} and ${parts[parts.length - 1]}` : parts[0]!;
  return `${sentence[0]!.toUpperCase()}${sentence.slice(1)}.`;
}

const attentionCopy = {
  analyzing: { action: "View progress", detail: "Analysis in progress" },
  review: { action: "Review", detail: "One layer fails on its own" },
  verified: { action: "Publish", detail: "Every layer passes" },
  failed: { action: "View", detail: "The run stopped with an error" },
} as const;

export default async function OverviewPage() {
  const [user, stacks, recent, repos] = await Promise.all([
    api.user.get(),
    api.stacks.list(),
    api.activity.recent(5),
    api.repositories.list(),
  ]);
  const pullRequests = (await Promise.all(repos.map((r) => api.repositories.pullRequests(r.id).catch(() => [])))).flat();
  const now = requestNow();

  const firstName = user.name.split(" ")[0] ?? user.name;
  const titles = new Map(stacks.map((s) => [s.id, s.title]));
  const events = toTimeline(recent, now, titles);

  const attention = stacks.filter((s) => s.status !== "published");
  const settled = stacks.filter((s) => s.status !== "analyzing");
  const layerCount = settled.reduce((sum, s) => sum + s.layerCount, 0);
  const changedLines = settled.reduce((sum, s) => sum + s.additions + s.deletions, 0);
  const avgLayer = layerCount ? Math.round(changedLines / layerCount) : 0;
  const avgPr = settled.length ? Math.round(changedLines / settled.length) : 0;

  const nextUp = pullRequests
    .filter((pr) => pr.analyzable && !pr.stackId && !pr.belowThreshold)
    .sort((a, b) => b.additions + b.deletions - (a.additions + a.deletions))[0];
  const nextRepo = nextUp ? repos.find((r) => r.id === nextUp.repoId) : undefined;

  return (
    <PageContainer width="wide">
      <PageHeader
        title={`Welcome back, ${firstName}`}
        description={stacks.length ? summaryLine(stacks) : "Split your first large pull request to get started."}
        actions={
          <ButtonLink href={routes.newSplit()} icon={<Plus className="size-4" />}>
            New split
          </ButtonLink>
        }
      />

      {stacks.length === 0 ? (
        <Card className="mt-10">
          <EmptyState
            title="No stacks yet"
            description="Pick an open pull request and Cleave splits it into layers that each pass your tests."
            action={
              <ButtonLink href={routes.newSplit()} icon={<Plus className="size-4" />}>
                Start a split
              </ButtonLink>
            }
          />
        </Card>
      ) : (
        <>
          <Card className="mt-8 grid grid-cols-2 gap-y-6 px-6 py-6 md:grid-cols-4 md:divide-x md:divide-line md:px-0">
            <Stat className="md:px-6" value={String(stacks.length)} label="Stacks" detail={`${plural(repos.length, "repository", "repositories")}`} />
            <Stat className="md:px-6" value={formatNumber(layerCount)} label="Layers verified" detail="Each passes on its own" />
            <Stat
              className="md:px-6"
              value={formatNumber(avgLayer)}
              label="Lines per layer"
              detail={`From ${formatNumber(avgPr)}-line pull requests`}
            />
            <Stat className="md:px-6" value="0" label="Lines written by Bob" detail="Bob only moves existing hunks" />
          </Card>

          {attention.length ? (
            <Section title="Needs you" className="mt-10">
              <ul className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
                {attention.map((stack) => {
                  const copy = attentionCopy[stack.status as keyof typeof attentionCopy];
                  const href =
                    stack.status === "review"
                      ? routes.verification(stack.id)
                      : stack.status === "verified"
                        ? routes.publish(stack.id)
                        : routes.stack(stack.id);
                  return (
                    <li key={stack.id}>
                      <Link
                        href={href}
                        className="group flex h-full items-start gap-4 rounded-2xl border border-line bg-surface p-4 shadow-card transition-[border-color,box-shadow] hover:border-line-strong"
                      >
                        <StatusMark status={stack.status} />
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-[15px] font-medium text-ink">{stack.title}</span>
                          <span className="mt-0.5 block text-[13px] text-ink-3">
                            {stack.repoName} · #{stack.prNumber}
                          </span>
                          <span className="mt-3 flex items-center justify-between gap-3">
                            <span className="text-[13px] text-ink-2">{copy.detail}</span>
                            <span className="inline-flex items-center gap-1 text-[13px] font-medium text-ink">
                              {copy.action}
                              <ArrowRight className="size-3.5 transition-transform group-hover:translate-x-0.5" />
                            </span>
                          </span>
                        </span>
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </Section>
          ) : null}

          <div className="mt-10 grid grid-cols-1 gap-10 lg:grid-cols-[minmax(0,1fr)_340px]">
            <div className="space-y-10">
              <Section
                title="Recent stacks"
                action={
                  <Link href={routes.stacks} className="text-[13px] text-ink-3 hover:text-ink">
                    View all
                  </Link>
                }
              >
                <StackList stacks={stacks.slice(0, 5).map((s) => ({ ...s, updatedLabel: timeAgo(s.updatedAt, now) }))} />
              </Section>

              {nextUp && nextRepo ? (
                <Section title="Largest open pull request">
                  <div className="relative overflow-hidden rounded-2xl border border-line bg-surface p-5 sm:p-6">
                    <div
                      aria-hidden="true"
                      className="pointer-events-none absolute -top-24 -right-16 size-64 rounded-full bg-[radial-gradient(circle,rgb(185_185_246/0.35),transparent_65%)]"
                    />
                    <div className="relative flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
                      <div className="flex min-w-0 items-start gap-4">
                        <span className="flex size-10 shrink-0 items-center justify-center rounded-xl border border-line bg-canvas text-ink-2">
                          <GitPullRequest className="size-4" />
                        </span>
                        <div className="min-w-0">
                          <p className="truncate text-[15px] font-medium text-ink">{nextUp.title}</p>
                          <p className="mt-0.5 text-[13px] text-ink-3">
                            {nextRepo.name} · #{nextUp.number} · {nextUp.author}
                          </p>
                          <p className="mt-3 text-[13px] text-ink-2 tabular-nums">
                            {plural(nextUp.filesChanged, "file")} · +{formatNumber(nextUp.additions)} −
                            {formatNumber(nextUp.deletions)} ·{" "}
                            {((nextUp.additions + nextUp.deletions) / nextRepo.config.maxLayerLines).toFixed(1)}× the{" "}
                            {nextRepo.config.maxLayerLines}-line layer limit
                          </p>
                        </div>
                      </div>
                      <ButtonLink
                        href={routes.newSplit(nextUp.repoId, nextUp.number)}
                        variant="secondary"
                        size="sm"
                        trailingIcon={<ArrowRight className="size-3.5" />}
                      >
                        Split it
                      </ButtonLink>
                    </div>
                  </div>
                </Section>
              ) : null}
            </div>

            <Section title="Activity">
              <Card className="px-5 pt-5 pb-2">
                {events.length ? (
                  <ActivityTimeline events={events} compact />
                ) : (
                  <p className="pb-4 text-[14px] text-ink-3">Activity from Bob and Cleave shows up here.</p>
                )}
              </Card>
              {events.length ? (
                <p className="px-1 text-[12px] text-ink-3">Latest events across all stacks. Select one for details.</p>
              ) : null}
            </Section>
          </div>
        </>
      )}
    </PageContainer>
  );
}
