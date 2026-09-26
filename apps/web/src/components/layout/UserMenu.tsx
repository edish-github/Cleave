"use client";

import { ChevronsUpDown, LogOut, Settings } from "lucide-react";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { signOutAction } from "@/server/actions/auth";
import { Avatar } from "@/components/ui/Avatar";
import type { User } from "@/lib/types";

export function UserMenu({ user, onNavigate }: { user: User; onNavigate?: () => void }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onPointer = (e: PointerEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("pointerdown", onPointer);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onPointer);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <div ref={ref} className="relative">
      {open ? (
        <div
          role="menu"
          aria-label="Account"
          className="absolute right-0 bottom-full left-0 mb-2 animate-fade-up rounded-xl border border-line bg-surface p-1 shadow-pop"
        >
          <Link
            role="menuitem"
            href="/app/settings"
            onClick={() => {
              setOpen(false);
              onNavigate?.();
            }}
            className="flex h-9 items-center gap-2.5 rounded-lg px-2.5 text-[14px] text-ink-2 hover:bg-subtle hover:text-ink"
          >
            <Settings className="size-4" /> Settings
          </Link>
          <form action={signOutAction}>
            <button
              role="menuitem"
              type="submit"
              className="flex h-9 w-full items-center gap-2.5 rounded-lg px-2.5 text-[14px] text-ink-2 hover:bg-subtle hover:text-ink"
            >
              <LogOut className="size-4" /> Sign out
            </button>
          </form>
        </div>
      ) : null}
      <button
        type="button"
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center gap-3 rounded-xl p-2 text-left transition-colors hover:bg-subtle"
      >
        <Avatar initials={user.initials} />
        <span className="min-w-0 flex-1">
          <span className="block truncate text-[13px] font-medium text-ink">{user.name}</span>
          <span className="block truncate text-[12px] text-ink-3">{user.email}</span>
        </span>
        <ChevronsUpDown className="size-3.5 shrink-0 text-ink-3" />
      </button>
    </div>
  );
}
