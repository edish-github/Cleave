import { twMerge } from "tailwind-merge";

/**
 * Joins class names, skipping falsy values, and lets later Tailwind classes
 * override earlier ones (so `className="hidden sm:flex"` beats a base `inline-flex`).
 */
export function cn(...values: Array<string | false | null | undefined>): string {
  return twMerge(values.filter(Boolean).join(" "));
}
