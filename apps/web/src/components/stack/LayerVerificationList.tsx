import { Check, ChevronRight } from "lucide-react";
import Link from "next/link";
import { cn } from "@/lib/cn";
import { formatDuration, pad2 } from "@/lib/format";
import { routes } from "@/lib/site";
import type { Layer } from "@/lib/types";
import { HalfCircle } from "./StackStatus";

export function LayerVerificationList({ stackId, layers, command }: { stackId: string; layers: Layer[]; command: string }) {
  return (
    <ul className="divide-y divide-line rounded-2xl border border-line bg-surface">
      {layers.map((layer) => (
        <li key={layer.index}>
          <Link
            href={routes.layer(stackId, layer.index)}
            className="group flex items-center gap-4 px-5 py-3.5 transition-colors hover:bg-subtle/50"
          >
            <span
              className={cn(
                "flex size-6 shrink-0 items-center justify-center rounded-full",
                layer.status === "pass" ? "bg-ok-soft text-ok" : "bg-warn-soft text-warn",
              )}
            >
              {layer.status === "pass" ? <Check className="size-3.5" strokeWidth={2.6} /> : <HalfCircle className="size-3.5" />}
            </span>
            <span className="w-7 shrink-0 font-mono text-[12px] text-ink-3">{pad2(layer.index)}</span>
            <span className="min-w-0 flex-1">
              <span className="block truncate text-[14px] font-medium text-ink">{layer.name}</span>
              {layer.repairedInRound ? (
                <span className="block text-[12px] text-accent-ink">Passed after a repair</span>
              ) : null}
            </span>
            <span className="hidden text-right text-[13px] text-ink-3 tabular-nums sm:block">
              {layer.status === "pass" ? (
                <>
                  {layer.testsPassed} passed · {formatDuration(layer.durationMs)}
                </>
              ) : (
                <span className="text-warn">
                  {layer.testsFailed} failing · {layer.testsPassed} passed
                </span>
              )}
            </span>
            <ChevronRight className="size-4 shrink-0 text-ink-3 transition-transform group-hover:translate-x-0.5" />
          </Link>
        </li>
      ))}
      <li className="px-5 py-3 text-[12px] text-ink-3">
        Each layer ran <code className="rounded bg-subtle px-1 py-0.5 text-ink-2">{command}</code> in its own worktree, with
        every earlier layer applied.
      </li>
    </ul>
  );
}
