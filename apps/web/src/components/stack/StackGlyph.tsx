import { cn } from "@/lib/cn";
import type { StackStatus } from "@/lib/types";

const barTone: Record<StackStatus, string> = {
  verified: "bg-ok",
  review: "bg-warn",
  analyzing: "bg-accent",
  published: "bg-ink-2",
};

/** A small picture of the stack: one bar per layer, tinted by status. */
export function StackGlyph({ layers, status, className }: { layers: number; status: StackStatus; className?: string }) {
  const count = Math.min(Math.max(layers, 1), 6);
  return (
    <span
      aria-hidden="true"
      className={cn(
        "flex size-10 shrink-0 flex-col justify-center gap-[3px] rounded-xl border border-line bg-canvas px-2.5",
        className,
      )}
    >
      {Array.from({ length: count }, (_, i) => (
        <span
          key={i}
          className={cn("h-[3px] rounded-full", barTone[status], status === "analyzing" && "animate-pulse")}
          style={{ width: `${58 + ((i * 29 + 11) % 42)}%`, opacity: 0.4 + ((i + 1) / count) * 0.6 }}
        />
      ))}
    </span>
  );
}
