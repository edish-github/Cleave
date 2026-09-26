import type { ReactNode } from "react";
import { cn } from "@/lib/cn";

export function SettingsSection({
  title,
  description,
  children,
  footer,
  className,
}: {
  title: string;
  description?: ReactNode;
  children?: ReactNode;
  footer?: ReactNode;
  className?: string;
}) {
  return (
    <section aria-label={title} className={cn("overflow-hidden rounded-2xl border border-line bg-surface", className)}>
      <div className="px-6 pt-5 pb-5">
        <h2 className="text-[16px] font-medium text-ink">{title}</h2>
        {description ? <p className="mt-1 text-[14px] leading-relaxed text-ink-3">{description}</p> : null}
        {children ? <div className="mt-5">{children}</div> : null}
      </div>
      {footer ? (
        <div className="flex flex-col-reverse gap-3 border-t border-line bg-canvas/50 px-6 py-3.5 sm:flex-row sm:items-center sm:justify-between">
          {footer}
        </div>
      ) : null}
    </section>
  );
}
