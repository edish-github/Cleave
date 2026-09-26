import { ArrowRight, Check, GitBranch, Info } from "lucide-react";
import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { PageContainer } from "@/components/layout/PageHeader";
import { PublishAction } from "@/components/stack/PublishAction";
import { BackLink } from "@/components/stack/StackHeader";
import { HalfCircle } from "@/components/stack/StackStatus";
import { ButtonLink } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { formatNumber, pad2, plural, shortHash } from "@/lib/format";
import { routes } from "@/lib/site";
import { requireStack } from "@/server/queries";
import { api } from "@/services";

export const metadata: Metadata = { title: "Publish" };

export default async function PublishPage({ params }: { params: Promise<{ stackId: string }> }) {
  const { stackId } = await params;
  const stack = await requireStack(stackId);
  if (stack.status === "analyzing") redirect(routes.stack(stack.id));
  if (stack.status === "published") redirect(routes.published(stack.id));
  const sample = api.source === "sample";

  if (stack.status === "review") {
    return (
      <PageContainer width="narrow">
        <BackLink href={routes.stack(stack.id)}>{stack.title}</BackLink>
        <Card className="mt-6 px-6 py-10 text-center sm:px-10">
          <span className="mx-auto flex size-12 items-center justify-center rounded-full bg-warn-soft text-warn ring-1 ring-warn-line">
            <HalfCircle className="size-5" />
          </span>
          <h1 className="mt-5 text-[20px] font-medium tracking-[-0.01em] text-ink">Resolve the review first</h1>
          <p className="mx-auto mt-2 max-w-[420px] text-[14px] text-ink-3">
            Only stacks where every layer passes on its own can be published. One decision is waiting on the
            Verification tab.
          </p>
          <ButtonLink
            href={routes.verification(stack.id)}
            className="mt-6"
            size="sm"
            trailingIcon={<ArrowRight className="size-3.5" />}
          >
            Open verification
          </ButtonLink>
        </Card>
      </PageContainer>
    );
  }

  const { verification, layers } = stack;

  return (
    <PageContainer width="narrow">
      <BackLink href={routes.stack(stack.id)}>{stack.title}</BackLink>
      <h1 className="mt-4 text-[26px] leading-tight font-medium tracking-[-0.02em] text-ink">Publish stack</h1>
      <p className="mt-2 text-[15px] leading-relaxed text-ink-3">
        Cleave opens {plural(layers.length, "pull request")} on {stack.repoFullName}. Each is based on the one before it,
        so reviewers read and merge them in order.
      </p>

      <section aria-label="Pull requests to open" className="mt-8">
        <ol className="relative space-y-2">
          {layers.map((layer, i) => (
            <li key={layer.index} className="relative flex gap-4">
              <div className="flex flex-col items-center">
                <span className="flex size-8 shrink-0 items-center justify-center rounded-full border border-line bg-surface font-mono text-[11px] text-ink-2">
                  {pad2(layer.index)}
                </span>
                {i < layers.length - 1 ? <span aria-hidden="true" className="w-px flex-1 bg-line" /> : null}
              </div>
              <div className="mb-2 min-w-0 flex-1 rounded-2xl border border-line bg-surface px-4 py-3.5">
                <div className="flex items-center justify-between gap-3">
                  <p className="truncate text-[15px] font-medium text-ink">{layer.name}</p>
                  <span className="flex shrink-0 items-center gap-1 text-[12px] text-ok">
                    <Check className="size-3.5" strokeWidth={2.6} /> {layer.testsPassed} passed
                  </span>
                </div>
                <p className="mt-1.5 flex items-center gap-1.5 font-mono text-[12px] text-ink-3">
                  <GitBranch className="size-3.5 shrink-0" />
                  <span className="truncate">{layer.branch}</span>
                </p>
                <p className="mt-1 text-[12px] text-ink-3 tabular-nums">
                  Base {i === 0 ? stack.base : `layer ${pad2(layer.index - 1)}`} · +{formatNumber(layer.additions)} −
                  {formatNumber(layer.deletions)} · {plural(layer.files.length, "file")}
                </p>
              </div>
            </li>
          ))}
        </ol>
      </section>

      <Card className="mt-6">
        <ul className="divide-y divide-line text-[14px]">
          <CheckRow>
            {verification.checks.filter((c) => c.state === "pass").length} of {verification.checks.length} checks pass
          </CheckRow>
          <CheckRow>
            Layer {pad2(layers.length)} is identical to #{stack.prNumber} (tree {shortHash(verification.topTree)})
          </CheckRow>
          <CheckRow>Bob wrote {verification.foreignLines} lines of code</CheckRow>
        </ul>
      </Card>

      {sample ? (
        <p className="mt-6 flex gap-3 rounded-2xl border border-accent-line bg-accent-soft/60 px-4 py-3.5 text-[13px] leading-relaxed text-ink-2">
          <Info className="mt-0.5 size-4 shrink-0 text-accent-ink" />
          <span>
            Sample workspace: publishing marks this stack as published and shows the pull requests Cleave would open.
            Nothing is sent to GitHub.
          </span>
        </p>
      ) : null}

      <div className="mt-8 flex flex-col-reverse gap-3 sm:flex-row sm:items-center sm:justify-between">
        <ButtonLink href={routes.stack(stack.id)} variant="ghost">
          Cancel
        </ButtonLink>
        <PublishAction stackId={stack.id} layerCount={layers.length} label={sample ? "Publish stack" : "Publish to GitHub"} />
      </div>
    </PageContainer>
  );
}

function CheckRow({ children }: { children: React.ReactNode }) {
  return (
    <li className="flex items-center gap-3 px-5 py-3">
      <span className="flex size-5 shrink-0 items-center justify-center rounded-full bg-ok-soft text-ok">
        <Check className="size-3" strokeWidth={2.8} />
      </span>
      <span className="text-ink">{children}</span>
    </li>
  );
}
