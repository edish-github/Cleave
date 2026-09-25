"use client";

import { RotateCw } from "lucide-react";
import { cn } from "@/lib/cn";
import { Button } from "./Button";

/** Contextual, calm error block. Never a full red screen. */
export function ErrorState({
  message,
  onRetry,
  className,
}: {
  message: string;
  onRetry?: () => void;
  className?: string;
}) {
  return (
    <div role="alert" className={cn("rounded-2xl border border-line bg-surface px-6 py-10 text-center shadow-card", className)}>
      <div className="mx-auto mb-4 flex size-10 items-center justify-center rounded-full bg-warn-soft">
        <span className="size-2 rounded-full bg-warn" />
      </div>
      <h3 className="text-[16px] font-medium text-ink">Something needs attention</h3>
      <p className="mx-auto mt-1.5 max-w-sm text-sm text-ink-3">{message}</p>
      {onRetry ? (
        <Button variant="secondary" size="sm" className="mt-5" icon={<RotateCw className="size-3.5" />} onClick={onRetry}>
          Try again
        </Button>
      ) : null}
    </div>
  );
}
