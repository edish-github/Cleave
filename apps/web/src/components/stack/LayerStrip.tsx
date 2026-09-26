import { cn } from "@/lib/cn";
import { pad2 } from "@/lib/format";
import type { Layer } from "@/lib/types";

/** Layers as proportional segments: the whole change, cleaved. */
export function LayerStrip({ layers, className }: { layers: Layer[]; className?: string }) {
  const total = layers.reduce((s, l) => s + l.additions + l.deletions, 0) || 1;
  return (
    <div className={cn("flex h-11 w-full gap-1", className)} role="img" aria-label={`${layers.length} layers`}>
      {layers.map((l) => (
        <div
          key={l.index}
          title={`${pad2(l.index)} ${l.name}`}
          className={cn(
            "flex min-w-9 items-center gap-2 overflow-hidden rounded-lg border px-2.5 text-[11px]",
            l.status === "pass" ? "border-ok-line bg-ok-soft text-ok" : "border-warn-line bg-warn-soft text-warn",
          )}
          style={{ flexGrow: (l.additions + l.deletions) / total, flexBasis: 0 }}
        >
          <span className="shrink-0 font-mono">{pad2(l.index)}</span>
          <span className="hidden truncate font-medium text-ink-2 sm:block">{l.name}</span>
        </div>
      ))}
    </div>
  );
}
