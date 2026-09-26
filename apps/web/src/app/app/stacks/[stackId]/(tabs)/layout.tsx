import { ArrowRight, GitPullRequestArrow } from "lucide-react";
import type { Metadata } from "next";
import type { ReactNode } from "react";
import { PageContainer } from "@/components/layout/PageHeader";
import { AnalysisProgress } from "@/components/stack/AnalysisProgress";
import { ShareProof } from "@/components/stack/ShareProof";
import { StackHeader } from "@/components/stack/StackHeader";
import { StackTabs } from "@/components/stack/StackTabs";
import { ButtonLink } from "@/components/ui/Button";
import { routes, site } from "@/lib/site";
import { requestNow, requireStack } from "@/server/queries";
import { api } from "@/services";

type Params = Promise<{ stackId: string }>;

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const { stackId } = await params;
  const stack = await api.stacks.get(stackId);
  return { title: stack?.title ?? "Stack" };
}

export default async function StackLayout({ children, params }: { children: ReactNode; params: Params }) {
  const { stackId } = await params;
  const stack = await requireStack(stackId);
  const events = await api.activity.forStack(stackId);
  const analyzing = stack.status === "analyzing" && stack.analysis !== null;

  return (
    <PageContainer width="wide">
      <StackHeader
        stack={stack}
        actions={
          <>
            <ShareProof
              stackId={stack.id}
              visibility={stack.visibility}
              proofUrl={`${site.url}${routes.proof(stack.id)}`}
              disabled={analyzing}
            />
            {stack.status === "verified" ? (
              <ButtonLink href={routes.publish(stack.id)} size="sm" trailingIcon={<ArrowRight className="size-3.5" />}>
                Publish
              </ButtonLink>
            ) : null}
            {stack.status === "published" ? (
              <ButtonLink
                href={routes.published(stack.id)}
                variant="secondary"
                size="sm"
                icon={<GitPullRequestArrow className="size-3.5" />}
              >
                Pull requests
              </ButtonLink>
            ) : null}
          </>
        }
      />

      {analyzing && stack.analysis ? (
        <AnalysisProgress
          analysis={stack.analysis}
          serverNow={requestNow()}
          repoName={stack.repoName}
          prNumber={stack.prNumber}
          sample={api.source === "sample"}
        />
      ) : (
        <>
          <div className="mt-8">
            <StackTabs stackId={stack.id} layerCount={stack.layers.length} eventCount={events.length} />
          </div>
          <div className="pt-8">{children}</div>
        </>
      )}
    </PageContainer>
  );
}
