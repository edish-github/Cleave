import { ArrowLeft, GitBranch } from "lucide-react";
import Link from "next/link";
import type { ReactNode } from "react";
import { StatusBadge } from "./StackStatus";
import type { Stack } from "@/lib/types";

export function BackLink({ href, children }: { href: string; children: ReactNode }) {
  return (
    <Link
      href={href}
      className="-ml-1 inline-flex items-center gap-1.5 rounded-full px-1 py-0.5 text-[13px] text-ink-3 transition-colors hover:text-ink"
    >
      <ArrowLeft className="size-3.5" />
      {children}
    </Link>
  );
}

export function StackHeader({ stack, actions }: { stack: Stack; actions?: ReactNode }) {
  return (
    <header className="flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
      <div className="min-w-0">
        <BackLink href="/app/stacks">Stacks</BackLink>
        <div className="mt-3 flex flex-wrap items-center gap-3">
          <h1 className="text-[26px] leading-tight font-medium tracking-[-0.02em] text-balance text-ink">{stack.title}</h1>
          <StatusBadge status={stack.status} />
        </div>
        <p className="mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-[14px] text-ink-3">
          <Link href={`/app/repositories/${stack.repoId}`} className="hover:text-ink">
            {stack.repoName}
          </Link>
          <span aria-hidden="true">·</span>
          <span>#{stack.prNumber}</span>
          <span aria-hidden="true" className="hidden sm:inline">·</span>
          <span className="hidden items-center gap-1 font-mono text-[12px] sm:inline-flex">
            <GitBranch className="size-3.5" />
            {stack.branch} → {stack.base}
          </span>
        </p>
      </div>
      {actions ? <div className="flex shrink-0 items-center gap-2">{actions}</div> : null}
    </header>
  );
}
