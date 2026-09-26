"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import { cn } from "@/lib/cn";

export function isActivePath(pathname: string, href: string, exact = false): boolean {
  if (exact) return pathname === href;
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function NavItem({
  href,
  icon,
  children,
  exact,
  onNavigate,
}: {
  href: string;
  icon: ReactNode;
  children: ReactNode;
  exact?: boolean;
  onNavigate?: () => void;
}) {
  const pathname = usePathname();
  const active = isActivePath(pathname, href, exact);
  return (
    <Link
      href={href}
      onClick={onNavigate}
      aria-current={active ? "page" : undefined}
      className={cn(
        "group flex h-9 items-center gap-2.5 rounded-xl px-3 text-[14px] transition-colors duration-150",
        active
          ? "bg-surface font-medium text-ink shadow-card ring-1 ring-line"
          : "text-ink-2 hover:bg-subtle hover:text-ink",
      )}
    >
      <span className={cn("flex size-4 items-center justify-center", active ? "text-ink" : "text-ink-3 group-hover:text-ink-2")}>
        {icon}
      </span>
      {children}
    </Link>
  );
}
