import { ChevronRight, FolderGit2, Plus } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { PageContainer, PageHeader } from "@/components/layout/PageHeader";
import { ConnectRepository } from "@/components/repository/ConnectRepository";
import { BackendRequiredButton } from "@/components/ui/BackendRequired";
import { Badge } from "@/components/ui/Badge";
import { Card } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";
import { plural, timeAgo } from "@/lib/format";
import { routes } from "@/lib/site";
import { requestNow } from "@/server/queries";
import { api } from "@/services";

export const metadata: Metadata = { title: "Repositories" };

const connectCopy = {
  title: "Connect a repository",
  description:
    "Repositories come from a GitHub account. The sample workspace has three sample repositories; sign in with GitHub to connect your own.",
};

export default async function RepositoriesPage() {
  const [repositories, sample] = await Promise.all([api.repositories.list(), api.isSample()]);
  const available = sample ? [] : await api.repositories.available().catch(() => []);
  const now = requestNow();
  const connect = (variant: "primary" | "secondary") =>
    sample ? (
      <BackendRequiredButton variant={variant} icon={<Plus className="size-4" />} {...connectCopy}>
        Connect repository
      </BackendRequiredButton>
    ) : (
      <ConnectRepository available={available} variant={variant} />
    );

  return (
    <PageContainer width="wide">
      <PageHeader
        title="Repositories"
        description="Where Cleave reads pull requests and opens stacked ones."
        actions={connect("secondary")}
      />

      {repositories.length ? (
        <ul className="mt-8 grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
          {repositories.map((repo, i) => (
            <li key={repo.id} className="animate-fade-up" style={{ animationDelay: `${i * 50}ms` }}>
              <Link
                href={routes.repository(repo.id)}
                className="group flex h-full flex-col rounded-2xl border border-line bg-surface p-5 transition-[border-color,box-shadow] duration-150 hover:border-line-strong hover:shadow-card"
              >
                <div className="flex items-start justify-between gap-3">
                  <span className="flex size-10 items-center justify-center rounded-xl border border-line bg-canvas text-ink-2">
                    <FolderGit2 className="size-[18px]" />
                  </span>
                  {repo.connection === "sample" ? <Badge>Sample</Badge> : <Badge tone="ok" dot>Connected</Badge>}
                </div>
                <p className="mt-5 truncate text-[16px] font-medium text-ink">{repo.name}</p>
                <p className="mt-0.5 truncate text-[13px] text-ink-3">
                  {[repo.owner, repo.language, repo.framework].filter(Boolean).join(" · ")}
                </p>
                <dl className="mt-6 grid grid-cols-3 gap-3 border-t border-line pt-4 text-[13px]">
                  <div>
                    <dt className="text-ink-3">Open PRs</dt>
                    <dd className="mt-0.5 text-ink tabular-nums">{repo.openPullRequests}</dd>
                  </div>
                  <div>
                    <dt className="text-ink-3">Stacks</dt>
                    <dd className="mt-0.5 text-ink tabular-nums">{repo.stackCount}</dd>
                  </div>
                  <div>
                    <dt className="text-ink-3">Last stack</dt>
                    <dd className="mt-0.5 truncate text-ink">{repo.lastStackAt ? timeAgo(repo.lastStackAt, now) : "None"}</dd>
                  </div>
                </dl>
                <span className="mt-4 flex items-center justify-between text-[12px] text-ink-3">
                  {repo.connection === "connected" ? `Synced ${timeAgo(repo.lastSyncedAt, now)}` : "Sample data"}
                  <ChevronRight className="size-4 transition-transform group-hover:translate-x-0.5" />
                </span>
              </Link>
            </li>
          ))}
        </ul>
      ) : (
        <Card className="mt-8">
          <EmptyState
            title="No repositories yet"
            description="Connect GitHub and choose the repositories Cleave may read and open pull requests on."
            action={connect("primary")}
          />
        </Card>
      )}
      {repositories.length ? (
        <p className="mt-6 text-[13px] text-ink-3">{plural(repositories.length, "repository", "repositories")} in this workspace.</p>
      ) : null}
    </PageContainer>
  );
}
