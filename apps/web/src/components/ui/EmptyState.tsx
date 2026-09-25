import type { ReactNode } from "react";
import { cn } from "@/lib/cn";
import { Diamond } from "./Diamond";

export function EmptyState({
  title,
  description,
  action,
  className,
}: {
  title: string;
  description?: string;
  action?: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("flex flex-col items-center px-6 py-16 text-center", className)}>
      <div className="relative mb-5 flex size-14 items-center justify-center">
        <div className="absolute inset-0 rounded-full bg-accent-soft blur-md" aria-hidden="true" />
        <Diamond className="relative size-7 text-accent" />
      </div>
      <h3 className="text-[17px] font-medium tracking-[-0.01em] text-ink">{title}</h3>
      {description ? <p className="mt-1.5 max-w-sm text-sm leading-relaxed text-ink-3">{description}</p> : null}
      {action ? <div className="mt-6">{action}</div> : null}
    </div>
  );
}
