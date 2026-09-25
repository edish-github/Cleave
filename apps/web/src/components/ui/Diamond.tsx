import { cn } from "@/lib/cn";

/** The quiet ◇ glyph used for empty states and the analysis screen. */
export function Diamond({ className, filled = false }: { className?: string; filled?: boolean }) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className={cn("size-6", className)} fill="none">
      <path
        d="M12 2.5 21.5 12 12 21.5 2.5 12 12 2.5Z"
        stroke="currentColor"
        strokeWidth="1.4"
        strokeLinejoin="round"
        fill={filled ? "currentColor" : "none"}
        fillOpacity={filled ? 0.12 : 0}
      />
    </svg>
  );
}
