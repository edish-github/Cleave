import type { ComponentProps, ReactNode } from "react";
import { cn } from "@/lib/cn";

export const inputClasses =
  "h-11 w-full rounded-xl border border-line bg-surface px-3.5 text-[15px] text-ink placeholder:text-ink-3 transition-[border-color,box-shadow] duration-150 outline-none hover:border-line-strong focus:border-accent focus:ring-4 focus:ring-accent-soft disabled:opacity-60 aria-[invalid=true]:border-bad";

export function Input({ className, ...props }: ComponentProps<"input">) {
  return <input className={cn(inputClasses, className)} {...props} />;
}

export function Field({
  label,
  htmlFor,
  hint,
  error,
  trailing,
  children,
}: {
  label: string;
  htmlFor: string;
  hint?: string;
  error?: string | null;
  trailing?: ReactNode;
  children: ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <div className="flex items-baseline justify-between">
        <label htmlFor={htmlFor} className="text-[13px] font-medium text-ink-2">
          {label}
        </label>
        {trailing}
      </div>
      {children}
      {error ? (
        <p id={`${htmlFor}-error`} className="text-[13px] text-bad">
          {error}
        </p>
      ) : hint ? (
        <p id={`${htmlFor}-hint`} className="text-[13px] text-ink-3">
          {hint}
        </p>
      ) : null}
    </div>
  );
}
