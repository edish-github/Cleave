import Link from "next/link";
import type { ComponentProps, ReactNode } from "react";
import { cn } from "@/lib/cn";
import { Spinner } from "./Spinner";

type Variant = "primary" | "secondary" | "ghost" | "quiet";
type Size = "sm" | "md" | "lg";

const base =
  "inline-flex items-center justify-center gap-2 rounded-full font-medium whitespace-nowrap select-none transition-[background-color,border-color,color,box-shadow,transform] duration-150 active:translate-y-px disabled:pointer-events-none disabled:opacity-45";

const variants: Record<Variant, string> = {
  primary: "bg-ink text-canvas shadow-[0_1px_0_rgb(255_255_255/0.08)_inset] hover:bg-ink/88",
  secondary: "bg-surface text-ink border border-line hover:border-line-strong hover:bg-subtle/60",
  ghost: "text-ink-2 hover:text-ink hover:bg-subtle",
  quiet: "text-accent-ink hover:text-accent hover:bg-accent-soft/70",
};

const sizes: Record<Size, string> = {
  sm: "h-8 px-3 text-[13px]",
  md: "h-10 px-4 text-sm",
  lg: "h-11 px-5 text-[15px]",
};

interface CommonProps {
  variant?: Variant;
  size?: Size;
  icon?: ReactNode;
  trailingIcon?: ReactNode;
  className?: string;
  children?: ReactNode;
}

export function buttonClasses(variant: Variant = "primary", size: Size = "md", className?: string) {
  return cn(base, variants[variant], sizes[size], className);
}

export function Button({
  variant = "primary",
  size = "md",
  icon,
  trailingIcon,
  className,
  children,
  loading = false,
  ...props
}: CommonProps & ComponentProps<"button"> & { loading?: boolean }) {
  return (
    <button
      className={buttonClasses(variant, size, className)}
      aria-busy={loading || undefined}
      disabled={loading || props.disabled}
      {...props}
    >
      {loading ? <Spinner /> : icon}
      {children}
      {!loading && trailingIcon}
    </button>
  );
}

export function ButtonLink({
  variant = "primary",
  size = "md",
  icon,
  trailingIcon,
  className,
  children,
  ...props
}: CommonProps & ComponentProps<typeof Link>) {
  return (
    <Link className={buttonClasses(variant, size, className)} {...props}>
      {icon}
      {children}
      {trailingIcon}
    </Link>
  );
}
