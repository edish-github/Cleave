"use client";

import { ChevronRight, Search } from "lucide-react";
import Link from "next/link";
import { useMemo, useState } from "react";
import { Button } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";
import { SegmentedControl } from "@/components/ui/SegmentedControl";
import { cn } from "@/lib/cn";
import { formatNumber } from "@/lib/format";
import { routes } from "@/lib/site";
import type { StackStatus } from "@/lib/types";
import { StackGlyph } from "./StackGlyph";
import type { StackListItem } from "./StackList";
import { StatusBadge, statusLabel } from "./StackStatus";

type Filter = "all" | StackStatus;

export function StacksTable({ stacks }: { stacks: StackListItem[] }) {
  const [filter, setFilter] = useState<Filter>("all");
  const [query, setQuery] = useState("");

  const count = (status: StackStatus) => stacks.filter((s) => s.status === status).length;
  const options = [
    { value: "all" as const, label: "All", count: stacks.length },
    { value: "review" as const, label: "Needs review", count: count("review") },
    { value: "verified" as const, label: "Verified", count: count("verified") },
    { value: "published" as const, label: "Published", count: count("published") },
    ...(count("analyzing") ? [{ value: "analyzing" as const, label: "Analyzing", count: count("analyzing") }] : []),
  ];

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    return stacks.filter(
      (s) =>
        (filter === "all" || s.status === filter) &&
        (!q || `${s.title} ${s.repoName} #${s.prNumber}`.toLowerCase().includes(q)),
    );
  }, [stacks, filter, query]);

  return (
    <div className="mt-8">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="scroll-thin -mx-1 overflow-x-auto px-1 pb-1">
          <SegmentedControl label="Filter by status" value={filter} onChange={setFilter} options={options} />
        </div>
        <label className="relative block sm:w-64">
          <span className="sr-only">Search stacks</span>
          <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-ink-3" />
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search by title or repository"
            className="h-9 w-full rounded-full border border-line bg-surface pr-3 pl-9 text-[13px] text-ink outline-none placeholder:text-ink-3 hover:border-line-strong focus:border-accent focus:ring-4 focus:ring-accent-soft"
          />
        </label>
      </div>

      {visible.length ? (
        <div className="mt-5 overflow-hidden rounded-2xl border border-line bg-surface">
          <div
            className="hidden grid-cols-[minmax(0,1fr)_140px_80px_120px_110px_20px] items-center gap-4 border-b border-line bg-canvas/50 px-5 py-2.5 text-[12px] text-ink-3 md:grid"
            aria-hidden="true"
          >
            <span>Stack</span>
            <span>Status</span>
            <span className="text-right">Layers</span>
            <span className="text-right">Lines</span>
            <span className="text-right">Updated</span>
            <span />
          </div>
          <ul className="divide-y divide-line">
            {visible.map((s) => (
              <li key={s.id}>
                <Link
                  href={routes.stack(s.id)}
                  className="group grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-4 px-4 py-3.5 transition-colors hover:bg-subtle/50 sm:px-5 md:grid-cols-[minmax(0,1fr)_140px_80px_120px_110px_20px]"
                >
                  <span className="contents md:flex md:min-w-0 md:items-center md:gap-4">
                    <StackGlyph layers={s.layerCount} status={s.status} />
                    <span className="min-w-0">
                      <span className="block truncate text-[15px] font-medium text-ink">{s.title}</span>
                      <span className="mt-0.5 block truncate text-[13px] text-ink-3">
                        {s.repoName} · #{s.prNumber}
                        <span className="md:hidden"> · {statusLabel(s.status)}</span>
                      </span>
                    </span>
                  </span>
                  <span className="hidden md:block">
                    <StatusBadge status={s.status} />
                  </span>
                  <span className="hidden text-right text-[14px] text-ink-2 tabular-nums md:block">
                    {s.status === "analyzing" ? "—" : s.layerCount}
                  </span>
                  <span className="hidden text-right font-mono text-[12px] tabular-nums md:block">
                    <span className="text-ok">+{formatNumber(s.additions)}</span>{" "}
                    <span className="text-bad">−{formatNumber(s.deletions)}</span>
                  </span>
                  <span className="hidden text-right text-[13px] text-ink-3 md:block">{s.updatedLabel}</span>
                  <span className={cn("flex items-center justify-end gap-2")}>
                    <ChevronRight className="size-4 text-ink-3 transition-transform group-hover:translate-x-0.5" />
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </div>
      ) : (
        <div className="mt-5 rounded-2xl border border-line bg-surface">
          <EmptyState
            title="No stacks match"
            description={query ? `Nothing matches “${query}”${filter === "all" ? "" : " with this status"}.` : "No stacks have this status yet."}
            action={
              <Button
                variant="secondary"
                size="sm"
                onClick={() => {
                  setFilter("all");
                  setQuery("");
                }}
              >
                Clear filters
              </Button>
            }
          />
        </div>
      )}
    </div>
  );
}
