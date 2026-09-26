"use client";

import { Check } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { Diamond } from "@/components/ui/Diamond";
import { cn } from "@/lib/cn";
import type { AnalysisState } from "@/lib/types";

/**
 * Progress for a running analysis. Stage timing comes from the service; the
 * component only animates between known points and asks the server for the
 * result when the run should be done.
 */
export function AnalysisProgress({
  analysis,
  serverNow,
  repoName,
  prNumber,
  sample = false,
}: {
  analysis: AnalysisState;
  serverNow: number;
  repoName: string;
  prNumber: number;
  /** Sample workspace: the stages replay a recorded run, and the page says so. */
  sample?: boolean;
}) {
  const router = useRouter();
  const started = new Date(analysis.startedAt).getTime();
  const [elapsed, setElapsed] = useState(() => serverNow - started);
  const offset = useRef<number | null>(null);
  const refreshed = useRef(0);

  useEffect(() => {
    offset.current = serverNow - Date.now();
    let frame = 0;
    const tick = () => {
      const now = Date.now() + (offset.current ?? 0);
      setElapsed(now - started);
      frame = window.setTimeout(tick, 200);
    };
    tick();
    return () => window.clearTimeout(frame);
  }, [serverNow, started]);

  const done = elapsed >= analysis.durationMs;

  useEffect(() => {
    if (!done) return;
    // Ask the server for the finished stack; retry briefly if it isn't ready yet.
    const now = Date.now();
    if (now - refreshed.current < 1500) return;
    refreshed.current = now;
    router.refresh();
    const retry = window.setInterval(() => router.refresh(), 2000);
    return () => window.clearInterval(retry);
  }, [done, router]);

  const pct = Math.min(99, Math.max(2, Math.round((elapsed / analysis.durationMs) * 100)));

  return (
    <section aria-label="Analysis progress" className="mx-auto max-w-[560px] py-10 text-center sm:py-16">
      <div className="relative mx-auto flex size-24 items-center justify-center">
        <div aria-hidden="true" className="absolute inset-0 animate-breathe rounded-full bg-[conic-gradient(from_90deg,#b9b9f6,#f3c4da,#f7dab4,#a7cdf3,#b9b9f6)] opacity-50 blur-xl" />
        <Diamond className="relative size-11 animate-spin-slow text-accent" />
      </div>
      <h2 className="mt-8 text-[22px] font-medium tracking-[-0.01em] text-ink">Analyzing change</h2>
      <p className="mt-1 text-[14px] text-ink-3">
        {repoName} · #{prNumber}
      </p>

      <ol className="mx-auto mt-10 max-w-[380px] space-y-3.5 text-left" aria-live="polite">
        {analysis.stages.map((stage) => {
          const state = elapsed >= stage.endMs ? "done" : elapsed >= stage.startMs ? "active" : "pending";
          return (
            <li key={stage.id} className="flex items-center gap-3">
              <span
                className={cn(
                  "flex size-5 shrink-0 items-center justify-center rounded-full border transition-colors duration-300",
                  state === "done" && "border-ok bg-ok text-canvas",
                  state === "active" && "border-accent",
                  state === "pending" && "border-line-strong",
                )}
              >
                {state === "done" ? <Check className="size-3" strokeWidth={3} /> : null}
                {state === "active" ? <span className="size-2 animate-pulse rounded-full bg-accent" /> : null}
              </span>
              <span className={cn("flex-1 text-[14px]", state === "pending" ? "text-ink-3" : "text-ink")}>{stage.label}</span>
              <span className={cn("text-[12px] text-ink-3 transition-opacity", state === "pending" ? "opacity-0" : "opacity-100")}>
                {stage.detail}
              </span>
            </li>
          );
        })}
      </ol>

      <div className="mx-auto mt-10 max-w-[380px]">
        <div
          className="h-1 overflow-hidden rounded-full bg-subtle"
          role="progressbar"
          aria-valuenow={pct}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-label="Analysis progress"
        >
          <div className="h-full rounded-full bg-accent transition-[width] duration-300 ease-out" style={{ width: `${pct}%` }} />
        </div>
        <p className="mt-3 text-[13px] text-ink-3 tabular-nums">{done ? "Finishing up" : `${pct}%`}</p>
      </div>
      <p className="mt-8 text-[12px] text-ink-3">
        {sample
          ? "Sample workspace: replaying the recorded run for this pull request. You can leave this page."
          : "You can leave this page. The stack keeps its place in your list."}
      </p>
    </section>
  );
}
