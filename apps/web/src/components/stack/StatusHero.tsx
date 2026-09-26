import type { ReactNode } from "react";
import { cn } from "@/lib/cn";
import type { StackStatus } from "@/lib/types";
import { StatusMark } from "./StackStatus";

const labels: Record<StackStatus, string> = {
  analyzing: "Analyzing",
  verified: "Verified",
  review: "Review required",
  published: "Published",
};

/** The one thing each stack page leads with: where this stack stands. */
export function StatusHero({
  status,
  message,
  actions,
  className,
}: {
  status: StackStatus;
  message: ReactNode;
  actions?: ReactNode;
  className?: string;
}) {
  return (
    <section
      aria-label="Status"
      className={cn(
        "relative overflow-hidden rounded-2xl border px-6 py-6 sm:px-7",
        status === "verified" && "border-ok-line bg-gradient-to-br from-ok-soft/70 via-surface to-surface",
        status === "review" && "border-warn-line bg-gradient-to-br from-warn-soft/70 via-surface to-surface",
        status === "published" && "border-line bg-gradient-to-br from-subtle via-surface to-surface",
        status === "analyzing" && "border-accent-line bg-gradient-to-br from-accent-soft/70 via-surface to-surface",
        className,
      )}
    >
      <div className="flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-4">
          <StatusMark status={status} size="lg" />
          <div>
            <p
              className={cn(
                "text-[12px] font-semibold tracking-[0.08em] uppercase",
                status === "verified" && "text-ok",
                status === "review" && "text-warn",
                status === "published" && "text-ink-2",
                status === "analyzing" && "text-accent-ink",
              )}
            >
              {labels[status]}
            </p>
            <p className="mt-1 text-[16px] text-ink">{message}</p>
          </div>
        </div>
        {actions ? <div className="flex flex-wrap items-center gap-2">{actions}</div> : null}
      </div>
    </section>
  );
}
