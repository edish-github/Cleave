import { ArrowUpRight, Check, GitPullRequestArrow, Info } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { PageContainer } from "@/components/layout/PageHeader";
import { BackLink } from "@/components/stack/StackHeader";
import { BackendRequiredButton } from "@/components/ui/BackendRequired";
import { ButtonLink } from "@/components/ui/Button";
import { formatDateTime, formatNumber, pad2 } from "@/lib/format";
import { routes } from "@/lib/site";
import type { CiState } from "@/lib/types";
import { requireStack } from "@/server/queries";
import { api } from "@/services";

export const metadata: Metadata = { title: "Published" };

export default async function PublishedPage({ params }: { params: Promise<{ stackId: string }> }) {
  const { stackId } = await params;
  const stack = await requireStack(stackId);
  if (stack.status === "analyzing") redirect(routes.stack(stack.id));
  if (stack.status !== "published") redirect(routes.publish(stack.id));
  const sample = await api.isSample();
  const ci = await api.stacks.ciStatus(stack.id).catch(() => ({}) as Record<number, CiState>);
  const { layers } = stack;

  return (
    <PageContainer width="narrow">
      <BackLink href={routes.stack(stack.id)}>{stack.title}</BackLink>

      <div className="mt-8 text-center">
        <span className="mx-auto flex size-16 animate-pop-in items-center justify-center rounded-full bg-ok-soft text-ok ring-1 ring-ok-line">
          <svg viewBox="0 0 24 24" className="size-7" aria-hidden="true">
            <path
              d="M5 12.5l4.5 4.5L19 7.5"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.4"
              strokeLinecap="round"
              strokeLinejoin="round"
              pathLength={1}
              className="check-draw"
            />
          </svg>
        </span>
        <h1 className="mt-6 font-display text-[40px] leading-[1.05] tracking-[-0.01em] text-ink">Stack published</h1>
        <p className="mx-auto mt-3 max-w-[460px] text-[15px] text-ink-3">
          {layers.length} pull requests on {stack.repoFullName}, stacked on {stack.base}.
          {stack.publishedAt ? ` ${formatDateTime(stack.publishedAt)}.` : ""}
        </p>
      </div>

      {sample ? (
        <p className="mt-8 flex gap-3 rounded-2xl border border-accent-line bg-accent-soft/60 px-4 py-3.5 text-[13px] leading-relaxed text-ink-2">
          <Info className="mt-0.5 size-4 shrink-0 text-accent-ink" />
          <span>
            Sample workspace: these are the pull requests Cleave would open, numbered as GitHub would number them. With
            GitHub connected, each links to the real pull request and its CI checks.
          </span>
        </p>
      ) : null}

      <ol className="mt-6 divide-y divide-line overflow-hidden rounded-2xl border border-line bg-surface">
        {layers.map((layer, i) => (
          <li key={layer.index} className="flex items-center gap-4 px-4 py-3.5 sm:px-5">
            <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-subtle text-ink-2">
              <GitPullRequestArrow className="size-4" />
            </span>
            <div className="min-w-0 flex-1">
              <p className="flex items-baseline gap-2">
                <span className="font-mono text-[12px] text-ink-3">#{layer.prNumber ?? "—"}</span>
                <span className="truncate text-[15px] font-medium text-ink">{layer.name}</span>
              </p>
              <p className="mt-0.5 truncate text-[12px] text-ink-3">
                {i === 0 ? `into ${stack.base}` : `into #${layers[i - 1]?.prNumber ?? pad2(i)}`} · +
                {formatNumber(layer.additions)} −{formatNumber(layer.deletions)}
              </p>
            </div>
            {sample ? (
              <span className="hidden shrink-0 items-center gap-1 text-[12px] text-ok sm:flex">
                <Check className="size-3.5" strokeWidth={2.6} /> Verified
              </span>
            ) : (
              <CiBadge state={ci[layer.index] ?? "none"} />
            )}
            {layer.prUrl ? (
              <a
                href={layer.prUrl}
                target="_blank"
                rel="noreferrer"
                aria-label={`Open pull request #${layer.prNumber}`}
                className="rounded-full p-1.5 text-ink-3 hover:bg-subtle hover:text-ink"
              >
                <ArrowUpRight className="size-4" />
              </a>
            ) : null}
          </li>
        ))}
      </ol>

      <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:justify-center">
        {!sample && stack.repoUrl ? (
          <ButtonLink href={`${stack.repoUrl}/pulls`} target="_blank" rel="noreferrer" trailingIcon={<ArrowUpRight className="size-4" />}>
            Open on GitHub
          </ButtonLink>
        ) : (
          <BackendRequiredButton
            variant="primary"
            icon={<ArrowUpRight className="size-4" />}
            title="GitHub isn't connected"
            description="Pull request links open once the Cleave backend is connected to GitHub. In the sample workspace there are no real pull requests to open."
          >
            Open on GitHub
          </BackendRequiredButton>
        )}
        <ButtonLink href={routes.stack(stack.id)} variant="secondary">
          Back to stack
        </ButtonLink>
      </div>

      {stack.visibility === "public" ? (
        <p className="mt-6 text-center text-[13px] text-ink-3">
          Reviewers can check the evidence on the{" "}
          <Link href={routes.proof(stack.id)} className="text-ink-2 underline-offset-2 hover:text-ink hover:underline">
            public proof page
          </Link>
          .
        </p>
      ) : null}
    </PageContainer>
  );
}

const ciCopy: Record<CiState, { label: string; className: string }> = {
  success: { label: "Checks pass", className: "text-ok" },
  failure: { label: "Checks fail", className: "text-bad" },
  pending: { label: "Checks running", className: "text-warn" },
  none: { label: "No checks", className: "text-ink-3" },
};

function CiBadge({ state }: { state: CiState }) {
  const copy = ciCopy[state];
  return (
    <span className={`hidden shrink-0 items-center gap-1.5 text-[12px] sm:flex ${copy.className}`}>
      <span className="size-1.5 rounded-full bg-current" aria-hidden="true" />
      {copy.label}
    </span>
  );
}
