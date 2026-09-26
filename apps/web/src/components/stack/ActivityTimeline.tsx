"use client";

import { ArrowUpRight, Bot, CircleUser, Cog, GitPullRequest, ShieldCheck } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { Drawer } from "@/components/ui/Dialog";
import { cn } from "@/lib/cn";
import type { ActivityEvent, ActivitySource } from "@/lib/types";

export interface TimelineEvent extends ActivityEvent {
  /** Pre-formatted on the server so client and server render the same text. */
  when: string;
  whenExact: string;
  stackTitle?: string;
  stackHref?: string;
}

const sourceMeta: Record<ActivitySource, { label: string; icon: React.ReactNode }> = {
  bob: { label: "Bob", icon: <Bot className="size-3.5" /> },
  engine: { label: "Cleave", icon: <Cog className="size-3.5" /> },
  hook: { label: "Hook", icon: <ShieldCheck className="size-3.5" /> },
  github: { label: "GitHub", icon: <GitPullRequest className="size-3.5" /> },
  you: { label: "You", icon: <CircleUser className="size-3.5" /> },
};

const dotTone = {
  neutral: "bg-surface border-line-strong",
  ok: "bg-ok border-ok",
  attention: "bg-warn border-warn",
  accent: "bg-accent border-accent",
} as const;

export function ActivityTimeline({ events, compact = false }: { events: TimelineEvent[]; compact?: boolean }) {
  const [selected, setSelected] = useState<TimelineEvent | null>(null);

  return (
    <>
      <ol className="relative">
        {events.map((event, i) => {
          const last = i === events.length - 1;
          return (
            <li key={event.id} className="relative pl-7">
              {!last ? <span aria-hidden="true" className="absolute top-5 bottom-0 left-[5px] w-px bg-line" /> : null}
              <span
                aria-hidden="true"
                className={cn("absolute top-[7px] left-0 size-[11px] rounded-full border-2", dotTone[event.tone])}
              />
              <button
                type="button"
                onClick={() => setSelected(event)}
                className={cn(
                  "-mx-2 -mt-1 mb-3 w-[calc(100%+1rem)] rounded-xl px-2 py-1.5 text-left transition-colors hover:bg-subtle/70",
                  compact ? "mb-2" : "mb-4",
                )}
              >
                <span className="flex items-start justify-between gap-4">
                  <span className="min-w-0">
                    <span className="block text-[14px] font-medium text-ink">{event.title}</span>
                    <span className={cn("mt-0.5 block text-[13px] text-ink-3", compact && "line-clamp-2")}>
                      {event.stackTitle ? `${event.stackTitle} · ` : ""}
                      {event.detail}
                    </span>
                  </span>
                  <span className="shrink-0 pt-0.5 text-[12px] text-ink-3">{event.when}</span>
                </span>
              </button>
            </li>
          );
        })}
      </ol>

      <Drawer
        open={selected !== null}
        onClose={() => setSelected(null)}
        title={selected?.title ?? ""}
        description={selected ? `${selected.whenExact}` : undefined}
      >
        {selected ? (
          <div className="space-y-6">
            <div className="flex flex-wrap items-center gap-2">
              <span className="inline-flex h-6 items-center gap-1.5 rounded-full border border-line bg-subtle px-2.5 text-[12px] font-medium text-ink-2">
                {sourceMeta[selected.source].icon}
                {sourceMeta[selected.source].label}
              </span>
              {selected.tool ? (
                <span className="inline-flex h-6 items-center rounded-full border border-line px-2.5 font-mono text-[11px] text-ink-3">
                  {selected.tool}
                </span>
              ) : null}
            </div>
            <p className="text-[15px] text-ink">{selected.detail}</p>
            {selected.fields.length ? (
              <dl className="divide-y divide-line rounded-xl border border-line">
                {selected.fields.map((f) => (
                  <div key={f.label} className="grid grid-cols-[120px_1fr] gap-4 px-4 py-3 text-[13px]">
                    <dt className="text-ink-3">{f.label}</dt>
                    <dd className="break-words text-ink">{f.value}</dd>
                  </div>
                ))}
              </dl>
            ) : null}
            {selected.code ? (
              <pre className="scroll-thin overflow-x-auto rounded-xl border border-line bg-sunken p-4 text-[12px] leading-relaxed text-ink-2">
                {selected.code}
              </pre>
            ) : null}
            {selected.stackHref ? (
              <Link
                href={selected.stackHref}
                onClick={() => setSelected(null)}
                className="inline-flex items-center gap-1 text-[14px] font-medium text-accent-ink hover:text-accent"
              >
                Open {selected.stackTitle} <ArrowUpRight className="size-3.5" />
              </Link>
            ) : null}
          </div>
        ) : null}
      </Drawer>
    </>
  );
}
