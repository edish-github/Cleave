import type { Metadata } from "next";
import { Plus } from "lucide-react";
import { PageContainer, PageHeader } from "@/components/layout/PageHeader";
import { StacksTable } from "@/components/stack/StacksTable";
import { ButtonLink } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";
import { plural, timeAgo } from "@/lib/format";
import { routes } from "@/lib/site";
import { requestNow } from "@/server/queries";
import { api } from "@/services";

export const metadata: Metadata = { title: "Stacks" };

export default async function StacksPage() {
  const stacks = await api.stacks.list();
  const now = requestNow();
  const repoCount = new Set(stacks.map((s) => s.repoId)).size;

  return (
    <PageContainer width="wide">
      <PageHeader
        title="Stacks"
        description={
          stacks.length
            ? `${plural(stacks.length, "stack")} across ${plural(repoCount, "repository", "repositories")}.`
            : "Every pull request Cleave splits becomes a stack."
        }
        actions={
          <ButtonLink href={routes.newSplit()} icon={<Plus className="size-4" />}>
            New split
          </ButtonLink>
        }
      />
      {stacks.length ? (
        <StacksTable stacks={stacks.map((s) => ({ ...s, updatedLabel: timeAgo(s.updatedAt, now) }))} />
      ) : (
        <Card className="mt-8">
          <EmptyState
            title="No stacks yet"
            description="Choose an open pull request and Cleave turns it into layers that each pass your tests."
            action={
              <ButtonLink href={routes.newSplit()} icon={<Plus className="size-4" />}>
                Start a split
              </ButtonLink>
            }
          />
        </Card>
      )}
    </PageContainer>
  );
}
