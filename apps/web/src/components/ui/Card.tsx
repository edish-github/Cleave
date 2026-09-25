import type { ComponentProps } from "react";
import { cn } from "@/lib/cn";

export function Card({ className, ...props }: ComponentProps<"div">) {
  return (
    <div
      className={cn("rounded-2xl border border-line bg-surface shadow-card", className)}
      {...props}
    />
  );
}

export function CardHeader({
  title,
  description,
  action,
  className,
}: {
  title: string;
  description?: string;
  action?: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("flex items-start justify-between gap-4 px-6 pt-5", className)}>
      <div className="min-w-0">
        <h2 className="text-[15px] font-medium text-ink">{title}</h2>
        {description ? <p className="mt-1 text-[13px] text-ink-3">{description}</p> : null}
      </div>
      {action}
    </div>
  );
}
