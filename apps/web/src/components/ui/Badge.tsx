import type { ReactNode } from "react";
import { cn } from "@/lib/cn";

export type Tone = "neutral" | "ok" | "attention" | "accent" | "ink";

const tones: Record<Tone, string> = {
  neutral: "bg-subtle text-ink-2 border-line",
  ok: "bg-ok-soft text-ok border-ok-line",
  attention: "bg-warn-soft text-warn border-warn-line",
  accent: "bg-accent-soft text-accent-ink border-accent-line",
  ink: "bg-ink text-canvas border-transparent",
};

const dots: Record<Tone, string> = {
  neutral: "bg-ink-3",
  ok: "bg-ok",
  attention: "bg-warn",
  accent: "bg-accent",
  ink: "bg-canvas",
};

export function Badge({
  tone = "neutral",
  dot = false,
  pulse = false,
  children,
  className,
}: {
  tone?: Tone;
  dot?: boolean;
  pulse?: boolean;
  children: ReactNode;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex h-6 items-center gap-1.5 rounded-full border px-2.5 text-[12px] font-medium whitespace-nowrap",
        tones[tone],
        className,
      )}
    >
      {dot ? (
        <span className="relative flex size-1.5">
          {pulse ? (
            <span className={cn("absolute inline-flex size-full animate-ping rounded-full opacity-60", dots[tone])} />
          ) : null}
          <span className={cn("relative inline-flex size-1.5 rounded-full", dots[tone])} />
        </span>
      ) : null}
      {children}
    </span>
  );
}
