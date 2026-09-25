"use client";

import { useRef } from "react";
import { cn } from "@/lib/cn";

export interface Segment<T extends string> {
  value: T;
  label: string;
  count?: number;
}

/** Radio-group semantics with arrow-key navigation. */
export function SegmentedControl<T extends string>({
  label,
  value,
  onChange,
  options,
  className,
}: {
  label: string;
  value: T;
  onChange: (value: T) => void;
  options: Segment<T>[];
  className?: string;
}) {
  const refs = useRef<(HTMLButtonElement | null)[]>([]);

  const onKeyDown = (event: React.KeyboardEvent, index: number) => {
    const delta = event.key === "ArrowRight" ? 1 : event.key === "ArrowLeft" ? -1 : 0;
    if (!delta) return;
    event.preventDefault();
    const next = (index + delta + options.length) % options.length;
    const option = options[next];
    if (!option) return;
    onChange(option.value);
    refs.current[next]?.focus();
  };

  return (
    <div
      role="radiogroup"
      aria-label={label}
      className={cn("inline-flex rounded-full border border-line bg-subtle/70 p-0.5", className)}
    >
      {options.map((option, i) => {
        const selected = option.value === value;
        return (
          <button
            key={option.value}
            ref={(el) => {
              refs.current[i] = el;
            }}
            type="button"
            role="radio"
            aria-checked={selected}
            tabIndex={selected ? 0 : -1}
            onKeyDown={(e) => onKeyDown(e, i)}
            onClick={() => onChange(option.value)}
            className={cn(
              "inline-flex h-7 shrink-0 items-center gap-1.5 rounded-full px-3 text-[13px] font-medium whitespace-nowrap transition-colors duration-150",
              selected ? "bg-surface text-ink shadow-card" : "text-ink-3 hover:text-ink",
            )}
          >
            {option.label}
            {option.count !== undefined ? (
              <span className={cn("tabular-nums", selected ? "text-ink-3" : "text-ink-3/80")}>{option.count}</span>
            ) : null}
          </button>
        );
      })}
    </div>
  );
}
