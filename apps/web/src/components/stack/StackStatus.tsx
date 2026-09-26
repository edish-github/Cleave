import { Check, CircleDashed, GitPullRequestArrow, X } from "lucide-react";
import { Badge, type Tone } from "@/components/ui/Badge";
import { cn } from "@/lib/cn";
import type { StackStatus } from "@/lib/types";

const meta: Record<StackStatus, { label: string; tone: Tone }> = {
  analyzing: { label: "Analyzing", tone: "accent" },
  verified: { label: "Verified", tone: "ok" },
  review: { label: "Review required", tone: "attention" },
  failed: { label: "Failed", tone: "bad" },
  published: { label: "Published", tone: "neutral" },
};

export function statusLabel(status: StackStatus) {
  return meta[status].label;
}

export function StatusBadge({ status, className }: { status: StackStatus; className?: string }) {
  const m = meta[status];
  return (
    <Badge tone={m.tone} dot pulse={status === "analyzing"} className={className}>
      {m.label}
    </Badge>
  );
}

/** Half-filled circle for "needs review": calm, not an alarm. */
export function HalfCircle({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 16 16" aria-hidden="true" className={cn("size-4", className)}>
      <circle cx="8" cy="8" r="6.25" fill="none" stroke="currentColor" strokeWidth="1.5" />
      <path d="M8 1.75a6.25 6.25 0 0 1 0 12.5Z" fill="currentColor" />
    </svg>
  );
}

export function StatusMark({ status, size = "md" }: { status: StackStatus; size?: "md" | "lg" }) {
  const box = size === "lg" ? "size-14" : "size-10";
  const icon = size === "lg" ? "size-6" : "size-5";
  if (status === "verified")
    return (
      <span className={cn("flex shrink-0 animate-pop-in items-center justify-center rounded-full bg-ok-soft text-ok ring-1 ring-ok-line", box)}>
        <Check className={icon} strokeWidth={2.2} />
      </span>
    );
  if (status === "review")
    return (
      <span className={cn("flex shrink-0 items-center justify-center rounded-full bg-warn-soft text-warn ring-1 ring-warn-line", box)}>
        <HalfCircle className={icon} />
      </span>
    );
  if (status === "failed")
    return (
      <span className={cn("flex shrink-0 items-center justify-center rounded-full bg-bad-soft text-bad ring-1 ring-bad/25", box)}>
        <X className={icon} strokeWidth={2.2} />
      </span>
    );
  if (status === "published")
    return (
      <span className={cn("flex shrink-0 items-center justify-center rounded-full bg-subtle text-ink ring-1 ring-line", box)}>
        <GitPullRequestArrow className={icon} />
      </span>
    );
  return (
    <span className={cn("flex shrink-0 items-center justify-center rounded-full bg-accent-soft text-accent ring-1 ring-accent-line", box)}>
      <CircleDashed className={cn(icon, "animate-spin-slow")} />
    </span>
  );
}
