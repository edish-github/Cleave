"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/cn";
import { routes } from "@/lib/site";

export function StackTabs({ stackId, layerCount, eventCount }: { stackId: string; layerCount: number; eventCount: number }) {
  const pathname = usePathname();
  const tabs = [
    { href: routes.stack(stackId), label: "Overview", exact: true },
    { href: routes.layers(stackId), label: "Layers", count: layerCount },
    { href: routes.verification(stackId), label: "Verification" },
    { href: routes.activity(stackId), label: "Activity", count: eventCount },
  ];

  return (
    <nav aria-label="Stack sections" className="-mb-px flex gap-6 overflow-x-auto border-b border-line">
      {tabs.map((tab) => {
        const active = tab.exact ? pathname === tab.href : pathname.startsWith(tab.href);
        return (
          <Link
            key={tab.href}
            href={tab.href}
            aria-current={active ? "page" : undefined}
            className={cn(
              "relative flex h-11 shrink-0 items-center gap-1.5 text-[14px] transition-colors",
              active ? "font-medium text-ink" : "text-ink-3 hover:text-ink",
            )}
          >
            {tab.label}
            {tab.count !== undefined ? <span className="text-[12px] text-ink-3 tabular-nums">{tab.count}</span> : null}
            {active ? <span className="absolute inset-x-0 -bottom-px h-0.5 rounded-full bg-ink" /> : null}
          </Link>
        );
      })}
    </nav>
  );
}
