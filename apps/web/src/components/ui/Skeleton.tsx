import { cn } from "@/lib/cn";

export function Skeleton({ className }: { className?: string }) {
  return <div aria-hidden="true" className={cn("animate-shimmer rounded-md bg-subtle", className)} />;
}

/** Wraps skeleton layouts so screen readers hear one "Loading" instead of many shapes. */
export function LoadingRegion({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div role="status" aria-live="polite" aria-label={label}>
      {children}
      <span className="sr-only">{label}</span>
    </div>
  );
}
