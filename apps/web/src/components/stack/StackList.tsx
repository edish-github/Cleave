import { ChevronRight } from "lucide-react";
import Link from "next/link";
import { formatNumber, plural } from "@/lib/format";
import { routes } from "@/lib/site";
import type { StackSummary } from "@/lib/types";
import { StackGlyph } from "./StackGlyph";
import { StatusBadge } from "./StackStatus";

export interface StackListItem extends StackSummary {
  /** Relative time, formatted on the server. */
  updatedLabel: string;
}

export function StackList({ stacks, showRepo = true }: { stacks: StackListItem[]; showRepo?: boolean }) {
  return (
    <ul className="divide-y divide-line overflow-hidden rounded-2xl border border-line bg-surface">
      {stacks.map((stack) => (
        <li key={stack.id}>
          <Link
            href={routes.stack(stack.id)}
            className="group flex items-center gap-4 px-4 py-3.5 transition-colors hover:bg-subtle/50 sm:px-5"
          >
            <StackGlyph layers={stack.layerCount} status={stack.status} />
            <span className="min-w-0 flex-1">
              <span className="block truncate text-[15px] font-medium text-ink">{stack.title}</span>
              <span className="mt-0.5 flex flex-wrap items-center gap-x-2 text-[13px] text-ink-3">
                {showRepo ? (
                  <>
                    <span>{stack.repoName}</span>
                    <span aria-hidden="true">·</span>
                  </>
                ) : null}
                <span>#{stack.prNumber}</span>
                <span aria-hidden="true">·</span>
                <span>{stack.status === "analyzing" ? "Analyzing" : plural(stack.layerCount, "layer")}</span>
                <span aria-hidden="true" className="hidden sm:inline">
                  ·
                </span>
                <span className="hidden tabular-nums sm:inline">
                  +{formatNumber(stack.additions)} −{formatNumber(stack.deletions)}
                </span>
              </span>
            </span>
            <StatusBadge status={stack.status} className="hidden sm:inline-flex" />
            <span className="hidden w-28 shrink-0 text-right text-[13px] text-ink-3 md:block">{stack.updatedLabel}</span>
            <ChevronRight className="size-4 shrink-0 text-ink-3 transition-transform group-hover:translate-x-0.5" />
          </Link>
        </li>
      ))}
    </ul>
  );
}
