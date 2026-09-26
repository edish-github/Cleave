import { Check } from "lucide-react";
import { cn } from "@/lib/cn";
import type { VerificationCheck } from "@/lib/types";
import { HalfCircle } from "./StackStatus";

export function VerificationChecks({ checks }: { checks: VerificationCheck[] }) {
  return (
    <ul className="divide-y divide-line rounded-2xl border border-line bg-surface">
      {checks.map((check) => (
        <li key={check.id} className="flex items-start gap-4 px-5 py-4">
          <span
            className={cn(
              "mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-full",
              check.state === "pass" ? "bg-ok-soft text-ok" : "bg-warn-soft text-warn",
            )}
          >
            {check.state === "pass" ? <Check className="size-3.5" strokeWidth={2.6} /> : <HalfCircle className="size-3.5" />}
          </span>
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
              <p className="text-[15px] font-medium text-ink">{check.label}</p>
              <p className={cn("text-[14px] tabular-nums", check.state === "pass" ? "text-ink-2" : "font-medium text-warn")}>
                {check.state === "pass" ? check.value : `${check.value} · Needs review`}
              </p>
            </div>
            <p className="mt-0.5 text-[14px] text-ink-3">{check.description}</p>
            <p className="mt-2 font-mono text-[12px] text-ink-3">{check.evidence.replace(/`/g, "")}</p>
          </div>
        </li>
      ))}
    </ul>
  );
}
