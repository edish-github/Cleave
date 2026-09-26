import type { Metadata } from "next";
import { PageContainer, PageHeader } from "@/components/layout/PageHeader";
import { LiveSplitPicker } from "@/components/split/LiveSplitPicker";
import { NewSplitForm, type PullRequestOption } from "@/components/split/NewSplitForm";
import { Card } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";
import { timeAgo } from "@/lib/format";
import { site } from "@/lib/site";
import type { PullRequest } from "@/lib/types";
import { requestNow } from "@/server/queries";
import { api } from "@/services";

export const metadata: Metadata = { title: "New split" };

const bySize = (a: PullRequest, b: PullRequest) => b.additions + b.deletions - (a.additions + a.deletions);

export default async function NewSplitPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const repoParam = typeof params.repo === "string" ? params.repo : undefined;
  const prParam = typeof params.pr === "string" ? Number.parseInt(params.pr, 10) : Number.NaN;

  const [repositories, sample] = await Promise.all([api.repositories.list(), api.isSample()]);
  const now = requestNow();
  const withLabel = (pr: PullRequest) => ({ ...pr, openedLabel: timeAgo(pr.openedAt, now) });

  if (!sample) {
    // Live: only the selected repository's pull requests are fetched from GitHub.
    const selectedRepo = repositories.find((r) => r.id === repoParam) ?? repositories[0] ?? null;
    let pullsNote: string | null = (await api.hasGitHub()) ? null : "Signed in without GitHub, so open pull requests can't be listed.";
    const prs = selectedRepo
      ? (
          await api.repositories.pullRequests(selectedRepo.id).catch((e: unknown) => {
            pullsNote = `GitHub didn't list the open pull requests: ${e instanceof Error ? e.message : "no answer"}`;
            return [];
          })
        )
          .sort(bySize)
          .map(withLabel)
      : [];
    const selectedPr = prs.find((p) => p.number === prParam) ?? null;
    const [areas, runners, recentRuns] = await Promise.all([
      selectedRepo && selectedPr ? api.repositories.pullRequestAreas(selectedRepo.id, selectedPr.number) : [],
      api.runs.runners(),
      api.runs.recent(50),
    ]);
    const latestRun =
      (selectedRepo && selectedPr && recentRuns.find((r) => r.repoId === selectedRepo.id && r.prNumber === selectedPr.number)) || null;
    return (
      <PageContainer width="wide">
        <PageHeader
          title="New split"
          description="Pick a pull request. The split runs on your machine, through your runner or in Bob IDE, and the finished run lands here with its proof."
        />
        <LiveSplitPicker
          repositories={repositories}
          selectedRepo={selectedRepo}
          pullRequests={prs}
          selectedPr={selectedPr}
          areas={areas}
          pullsNote={pullsNote}
          runners={runners}
          latestRun={latestRun}
          siteUrl={site.url}
        />
      </PageContainer>
    );
  }

  const lists = await Promise.all(repositories.map((r) => api.repositories.pullRequests(r.id)));
  const pullRequests: Record<string, PullRequestOption[]> = Object.fromEntries(
    // Largest first: the pull requests that most need splitting lead the list.
    repositories.map((r, i) => [r.id, [...(lists[i] ?? [])].sort(bySize).map(withLabel)]),
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
          sample
        />
      ) : (
        <Card className="mt-10">
          <EmptyState title="No repositories" description="The sample workspace has no repositories to split." />
        </Card>
      )}
    </PageContainer>
  );
}
