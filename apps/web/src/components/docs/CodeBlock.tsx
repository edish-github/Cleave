import { CopyButton } from "@/components/ui/CopyButton";
import { cn } from "@/lib/cn";

/** A file or command, with its name and a copy button. No syntax colouring: the text is the point. */
export function CodeBlock({
  code,
  title,
  className,
  wrap = false,
}: {
  code: string;
  title?: string;
  className?: string;
  wrap?: boolean;
}) {
  return (
    <div className={cn("overflow-hidden rounded-2xl border border-line bg-sunken", className)}>
      <div className="flex h-10 items-center justify-between gap-3 border-b border-line bg-surface/70 pr-2 pl-4">
        <span className="truncate font-mono text-[12px] text-ink-3">{title ?? "Terminal"}</span>
        <CopyButton value={code} />
      </div>
      <pre
        className={cn(
          "scroll-thin overflow-x-auto px-4 py-3.5 text-[12.5px] leading-[1.7] text-ink",
          wrap && "break-words whitespace-pre-wrap",
        )}
      >
        {code}
      </pre>
    </div>
  );
}
