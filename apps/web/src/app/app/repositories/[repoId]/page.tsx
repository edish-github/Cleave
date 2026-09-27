import { ArrowRight, GitPullRequest, Plus } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { PageContainer, PageHeader, Section } from "@/components/layout/PageHeader";
import { RunSettings } from "@/components/repository/RunSettings";
import { BackLink } from "@/components/stack/StackHeader";
import { StackList } from "@/components/stack/StackList";
import { BackendRequiredButton } from "@/components/ui/BackendRequired";
import { Badge } from "@/components/ui/Badge";
import { ButtonLink } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";
import { formatNumber, plural, timeAgo } from "@/lib/format";
import { routes } from "@/lib/site";
import { requestNow } from "@/server/queries";
import { api } from "@/services";

type Params = Promise<{ repoId: string }>;

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const { repoId } = await params;
  const repo = await api.repositories.get(repoId);
  return { title: repo?.name ?? "Repository" };
}

export default async function RepositoryPage({ params }: { params: Params }) {
  const { repoId } = await params;
  const repo = await api.repositories.get(repoId);
  if (!repo) notFound();

  const [pulls, stacks, sample, hasGitHub] = await Promise.all([
    api.repositories.pullRequests(repo.id).then(
      (list) => ({ list, error: null }),
      (e: unknown) => ({ list: [], error: e instanceof Error ? e.message : "GitHub didn't answer." }),
    ),
    api.stacks.forRepository(repo.id),
    api.isSample(),
    api.hasGitHub(),
  ]);
  const pullRequests = pulls.list;
  const pullsNote = pulls.error
    ? `GitHub didn't list the open pull requests: ${pulls.error}`
    : !sample && !hasGitHub
      ? "Signed in without GitHub, so open pull requests can't be listed."
      : null;
  const now = requestNow();
  const bySize = [...pullRequests].sort((a, b) => b.additions + b.deletions - (a.additions + a.deletions));
  const largest = Math.max(...bySize.map((p) => p.additions + p.deletions), 1);
  const { config } = repo;

  return (
    <PageContainer width="wide">
      <BackLink href={routes.repositories}>Repositories</BackLink>
      <PageHeader
        className="mt-4"
        title={
          <span className="flex flex-wrap items-center gap-3">
            {repo.name}
            {repo.connection === "sample" ? <Badge>Sample</Badge> : <Badge tone="ok" dot>Connected</Badge>}
          </span>
        }
        description={[repo.fullName, repo.language, repo.framework, `default branch ${repo.defaultBranch}`].filter(Boolean).join(" · ")}
        actions={
          <ButtonLink href={routes.newSplit(repo.id)} icon={<Plus className="size-4" />}>
            New split
          </ButtonLink>
        }
      />

      <div className="mt-10 grid grid-cols-1 gap-10 lg:grid-cols-[minmax(0,1fr)_320px]">
        <div className="space-y-10">
          <Section title={`Open pull requests · ${pullRequests.length}`}>
            {bySize.length ? (
              <ul className="divide-y divide-line overflow-hidden rounded-2xl border border-line bg-surface">
                {bySize.map((pr) => {
                  const size = pr.additions + pr.deletions;
                  return (
                    <li key={pr.number} className="flex flex-col gap-3 px-4 py-4 sm:flex-row sm:items-center sm:gap-4 sm:px-5">
                      <div className="flex min-w-0 flex-1 items-start gap-4">
                        <span className="flex size-8 shrink-0 items-center justify-center rounded-lg border border-line bg-canvas text-ink-3">
                          <GitPullRequest className="size-4" />
                        </span>
                        <div className="min-w-0 flex-1">
                          <p className="flex flex-wrap items-baseline gap-x-2">
                            <span className="font-mono text-[12px] text-ink-3">#{pr.number}</span>
                            <span className="text-[15px] font-medium text-ink">{pr.title}</span>
                          </p>
                          <p className="mt-0.5 text-[13px] text-ink-3">
                            {pr.author} · {plural(pr.filesChanged, "file")} · opened {timeAgo(pr.openedAt, now)}
                          </p>
                          <div className="mt-2.5 flex items-center gap-3">
                            <span className="h-1.5 w-full max-w-[220px] overflow-hidden rounded-full bg-subtle" aria-hidden="true">
                              <span
                                className={pr.belowThreshold ? "block h-full rounded-full bg-ink-3/50" : "block h-full rounded-full bg-accent"}
                                style={{ width: `${Math.max(4, (size / largest) * 100)}%` }}
                              />
                            </span>
                            <span className="shrink-0 font-mono text-[12px] tabular-nums">
                              <span className="text-ok">+{formatNumber(pr.additions)}</span>{" "}
                              <span className="text-bad">−{formatNumber(pr.deletions)}</span>
                            </span>
                          </div>
                        </div>
                      </div>
                      <div className="shrink-0 pl-12 sm:pl-0">
                        {pr.stackId ? (
                          <ButtonLink href={routes.stack(pr.stackId)} variant="secondary" size="sm">
                            View stack
                          </ButtonLink>
                        ) : pr.belowThreshold ? (
                          <span className="text-[12px] text-ink-3">Small enough to review as is</span>
                        ) : pr.analyzable ? (
                          <ButtonLink
                            href={routes.newSplit(repo.id, pr.number)}
                            size="sm"
                            trailingIcon={<ArrowRight className="size-3.5" />}
                          >
                            Split
                          </ButtonLink>
                        ) : (
                          <span className="text-[12px] text-ink-3">Not in the sample workspace</span>
                        )}
                      </div>
                    </li>
                  );
                })}
              </ul>
            ) : (
              <Card>
                <EmptyState
                  title={pullsNote ? "Pull requests unavailable" : "No open pull requests"}
                  description={pullsNote ?? "New pull requests appear here as soon as GitHub reports them."}
                />
              </Card>
            )}
          </Section>

          <Section title={`Stacks · ${stacks.length}`}>
            {stacks.length ? (
              <StackList stacks={stacks.map((s) => ({ ...s, updatedLabel: timeAgo(s.updatedAt, now) }))} showRepo={false} />
            ) : (
              <Card>
                <EmptyState
                  title="No stacks in this repository"
                  description="Split its largest open pull request to create the first one."
                />
              </Card>
            )}
          </Section>
        </div>

        <RunSettings
          repoId={repo.id}
          config={config}
          readOnlyAction={
            repo.connection === "sample" ? (
              <BackendRequiredButton
                variant="ghost"
                size="sm"
                title="Editing needs the backend"
                description="Run settings are stored with the repository on the Cleave backend. In the sample workspace they're read-only."
              >
                Edit
              </BackendRequiredButton>
            ) : undefined
          }
          footer={
            <>
              {repo.connection === "connected" ? `Synced with GitHub ${timeAgo(repo.lastSyncedAt, now)}.` : "Sample data."}{" "}
              <Link href={routes.bobDocs} className="text-ink-2 hover:text-ink">
                How runs use these
              </Link>
            </>
          }
        />
      </div>
    </PageContainer>
  );
}
