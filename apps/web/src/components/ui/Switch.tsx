"use client";

import { cn } from "@/lib/cn";

export function Switch({
  checked,
  onChange,
  label,
  id,
  disabled,
}: {
  checked: boolean;
  onChange: (checked: boolean) => void;
  label: string;
  id?: string;
  disabled?: boolean;
}) {
  return (
    <button
      id={id}
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={cn(
        "relative inline-flex h-6 w-10 shrink-0 items-center rounded-full border transition-colors duration-200 disabled:opacity-50",
        checked ? "border-transparent bg-ink" : "border-line bg-subtle",
      )}
    >
      <span
        className={cn(
          "inline-block size-[18px] rounded-full bg-surface shadow-card transition-transform duration-200",
          checked ? "translate-x-[18px]" : "translate-x-[2px]",
        )}
      />
    </button>
  );
}
