import { Check, ChevronRight } from "lucide-react";
import Link from "next/link";
import { cn } from "@/lib/cn";
import { pad2, plural } from "@/lib/format";
import { routes } from "@/lib/site";
import type { Layer } from "@/lib/types";
import { HalfCircle } from "./StackStatus";

/** The change structure: ordered layers, each clickable, with a size bar. */
export function LayerTimeline({ stackId, layers }: { stackId: string; layers: Layer[] }) {
  const largest = Math.max(...layers.map((l) => l.additions + l.deletions), 1);
  return (
    <ol className="relative">
      {layers.map((layer, i) => {
        const size = layer.additions + layer.deletions;
        const last = i === layers.length - 1;
        return (
          <li key={layer.index} className="relative animate-fade-up" style={{ animationDelay: `${i * 50}ms` }}>
            {!last ? <span aria-hidden="true" className="absolute top-12 bottom-0 left-[27px] w-px bg-line" /> : null}
            <Link
              href={routes.layer(stackId, layer.index)}
              className="group flex items-center gap-4 rounded-2xl px-2 py-3 transition-colors hover:bg-subtle/70"
            >
              <span
                className={cn(
                  "relative z-10 flex size-10 shrink-0 items-center justify-center rounded-full border bg-surface font-mono text-[12px]",
                  layer.status === "pass" ? "border-line text-ink-2" : "border-warn-line text-warn",
                )}
              >
                {pad2(layer.index)}
              </span>
              <span className="min-w-0 flex-1">
                <span className="flex items-center gap-2">
                  <span className="truncate text-[15px] font-medium text-ink">{layer.name}</span>
                  {layer.status === "pass" ? (
                    <Check className="size-3.5 shrink-0 text-ok" strokeWidth={2.4} aria-label="Passes" />
                  ) : (
                    <HalfCircle className="size-3.5 shrink-0 text-warn" />
                  )}
                </span>
                <span className="mt-1 flex items-center gap-3 text-[13px] text-ink-3">
                  <span>{plural(layer.atomIds.length, "atom")}</span>
                  <span className="hidden sm:inline">{plural(layer.files.length, "file")}</span>
                  <span className="tabular-nums">
                    +{layer.additions} <span className="text-ink-3/80">−{layer.deletions}</span>
                  </span>
                </span>
              </span>
              <span className="hidden w-40 shrink-0 md:block" aria-hidden="true">
                <span className="block h-1.5 overflow-hidden rounded-full bg-subtle">
                  <span
                    className={cn("block h-full rounded-full", layer.status === "pass" ? "bg-ink/70" : "bg-warn")}
                    style={{ width: `${Math.max(6, (size / largest) * 100)}%` }}
                  />
                </span>
              </span>
              <ChevronRight className="size-4 shrink-0 text-ink-3 transition-transform group-hover:translate-x-0.5" />
            </Link>
          </li>
        );
      })}
    </ol>
  );
}
