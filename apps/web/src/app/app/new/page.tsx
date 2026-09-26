import type { Metadata } from "next";
import { Plus } from "lucide-react";
import { PageContainer, PageHeader } from "@/components/layout/PageHeader";
import { NewSplitForm, type PullRequestOption } from "@/components/split/NewSplitForm";
import { BackendRequiredButton } from "@/components/ui/BackendRequired";
import { Card } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";
import { timeAgo } from "@/lib/format";
import { requestNow } from "@/server/queries";
import { api } from "@/services";

export const metadata: Metadata = { title: "New split" };

export default async function NewSplitPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const repoParam = typeof params.repo === "string" ? params.repo : undefined;
  const prParam = typeof params.pr === "string" ? Number.parseInt(params.pr, 10) : Number.NaN;

  const repositories = await api.repositories.list();
  const now = requestNow();
  const lists = await Promise.all(repositories.map((r) => api.repositories.pullRequests(r.id)));
  const pullRequests: Record<string, PullRequestOption[]> = Object.fromEntries(
    repositories.map((r, i) => [
      r.id,
      // Largest first: the pull requests that most need splitting lead the list.
      [...(lists[i] ?? [])]
        .sort((a, b) => b.additions + b.deletions - (a.additions + a.deletions))
        .map((pr) => ({ ...pr, openedLabel: timeAgo(pr.openedAt, now) })),
    ]),
  );

  const initialRepo = repositories.find((r) => r.id === repoParam) ?? repositories[0];
  const candidate = initialRepo ? pullRequests[initialRepo.id]?.find((p) => p.number === prParam) : undefined;
  const initialPr = candidate && candidate.analyzable && !candidate.belowThreshold ? candidate.number : null;

  return (
    <PageContainer width="wide">
      <PageHeader
        title="New split"
        description="Choose a pull request. Cleave cuts it into atoms, Bob plans the layers, and every layer is tested on its own."
      />
      {initialRepo ? (
        <NewSplitForm
          repositories={repositories}
          pullRequests={pullRequests}
          initialRepoId={initialRepo.id}
          initialPr={initialPr}
          sample={api.source === "sample"}
        />
      ) : (
        <Card className="mt-10">
          <EmptyState
            title="Connect a repository first"
            description="Cleave needs read access to a repository before it can split its pull requests."
            action={
              <BackendRequiredButton variant="primary" icon={<Plus className="size-4" />}>
                Connect repository
              </BackendRequiredButton>
            }
          />
        </Card>
      )}
    </PageContainer>
  );
}
