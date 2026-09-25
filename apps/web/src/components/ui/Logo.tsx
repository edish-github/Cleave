import { cn } from "@/lib/cn";

/** Cleave mark: a diamond split cleanly in two. */
export function LogoMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className={cn("size-5", className)}>
      <path d="M1.5 10.8 12 0.6l10.5 10.2H1.5Z" fill="currentColor" />
      <path d="M1.5 13.2h21L12 23.4 1.5 13.2Z" fill="var(--accent)" />
    </svg>
  );
}

export function Logo({ className }: { className?: string }) {
  return (
    <span className={cn("inline-flex items-center gap-2 text-ink", className)}>
      <LogoMark />
      <span className="text-[15px] font-semibold tracking-[-0.01em]">Cleave</span>
    </span>
  );
}
