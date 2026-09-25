import { cn } from "@/lib/cn";

export function Avatar({ initials, className }: { initials: string; className?: string }) {
  return (
    <span
      aria-hidden="true"
      className={cn(
        "inline-flex size-8 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-accent-soft to-subtle text-[12px] font-semibold text-accent-ink ring-1 ring-line",
        className,
      )}
    >
      {initials}
    </span>
  );
}
