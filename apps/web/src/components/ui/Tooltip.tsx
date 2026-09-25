import { useId, type ReactNode } from "react";
import { cn } from "@/lib/cn";

/**
 * CSS-only tooltip. Shows on hover and on keyboard focus of the wrapped element;
 * the text is also linked with aria-describedby.
 */
export function Tooltip({
  content,
  children,
  side = "top",
  className,
}: {
  content: string;
  children: ReactNode;
  side?: "top" | "bottom";
  className?: string;
}) {
  const id = useId();
  return (
    <span className={cn("group/tip relative inline-flex", className)} aria-describedby={id}>
      {children}
      <span
        id={id}
        role="tooltip"
        className={cn(
          // display:none until shown, so the bubble never widens the page on small screens.
          "pointer-events-none absolute left-1/2 z-50 hidden w-max max-w-64 -translate-x-1/2 animate-fade-in rounded-lg bg-ink px-2.5 py-1.5 text-[12px] leading-snug text-canvas shadow-pop group-hover/tip:block group-focus-within/tip:block",
          side === "top" ? "bottom-full mb-2" : "top-full mt-2",
        )}
      >
        {content}
      </span>
    </span>
  );
}
