import { cn } from "@/lib/cn";

/** A number with its label. Used for the few metrics a page leads with. */
export function Stat({
  value,
  label,
  detail,
  className,
}: {
  value: string;
  label: string;
  detail?: string;
  className?: string;
}) {
  return (
    <div className={cn("min-w-0", className)}>
      <div className="text-[28px] leading-none font-medium tracking-[-0.02em] text-ink tabular-nums">{value}</div>
      <div className="mt-2 text-[13px] text-ink-2">{label}</div>
      {detail ? <div className="mt-0.5 text-[12px] text-ink-3">{detail}</div> : null}
    </div>
  );
}
