import type { ReactNode } from "react";
import { cn } from "@/lib/cn";

export function PageHeader({
  title,
  description,
  actions,
  eyebrow,
  className,
}: {
  title: ReactNode;
  description?: ReactNode;
  actions?: ReactNode;
  eyebrow?: ReactNode;
  className?: string;
}) {
  return (
    <header className={cn("flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between", className)}>
      <div className="min-w-0">
        {eyebrow ? <div className="mb-3">{eyebrow}</div> : null}
        <h1 className="text-[26px] leading-tight font-medium tracking-[-0.02em] text-balance text-ink">{title}</h1>
        {description ? <p className="mt-1.5 text-[15px] text-ink-3">{description}</p> : null}
      </div>
      {actions ? <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div> : null}
    </header>
  );
}

export function Section({
  title,
  action,
  children,
  className,
}: {
  title: string;
  action?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section className={cn("space-y-4", className)} aria-label={title}>
      <div className="flex items-center justify-between gap-4">
        <h2 className="text-[15px] font-medium text-ink">{title}</h2>
        {action}
      </div>
      {children}
    </section>
  );
}

export function PageContainer({ children, className, width = "default" }: { children: ReactNode; className?: string; width?: "default" | "narrow" | "wide" }) {
  return (
    <div
      className={cn(
        "mx-auto w-full px-5 pt-8 pb-16 sm:px-8 lg:px-10 lg:pt-10",
        width === "narrow" ? "max-w-[760px]" : width === "wide" ? "max-w-[1180px]" : "max-w-[1040px]",
        className,
      )}
    >
      {children}
    </div>
  );
}
