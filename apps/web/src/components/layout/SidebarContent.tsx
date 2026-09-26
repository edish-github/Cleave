"use client";

import { FolderGit2, House, Layers, Plus, Settings } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Logo } from "@/components/ui/Logo";
import { NavItem, isActivePath } from "@/components/navigation/NavItem";
import { cn } from "@/lib/cn";
import { routes } from "@/lib/site";
import type { User } from "@/lib/types";
import { UserMenu } from "./UserMenu";

export function SidebarContent({ user, onNavigate }: { user: User; onNavigate?: () => void }) {
  const pathname = usePathname();
  const newActive = isActivePath(pathname, routes.newSplit(), true);

  return (
    <div className="flex h-full flex-col">
      <div className="flex h-14 items-center px-3">
        <Link href={routes.app} onClick={onNavigate} aria-label="Cleave overview" className="rounded-lg px-1 py-1">
          <Logo />
        </Link>
      </div>

      <nav aria-label="Main" className="mt-4 flex flex-1 flex-col px-2">
        <div className="space-y-0.5">
          <NavItem href={routes.app} exact icon={<House className="size-4" />} onNavigate={onNavigate}>
            Overview
          </NavItem>
          <NavItem href={routes.stacks} icon={<Layers className="size-4" />} onNavigate={onNavigate}>
            Stacks
          </NavItem>
          <NavItem href={routes.repositories} icon={<FolderGit2 className="size-4" />} onNavigate={onNavigate}>
            Repositories
          </NavItem>
        </div>

        <div className="my-4 h-px bg-line" role="separator" />

        <Link
          href={routes.newSplit()}
          onClick={onNavigate}
          aria-current={newActive ? "page" : undefined}
          className={cn(
            "flex h-9 items-center gap-2.5 rounded-xl border px-3 text-[14px] font-medium transition-colors duration-150",
            newActive
              ? "border-ink bg-ink text-canvas"
              : "border-line bg-surface text-ink shadow-card hover:border-line-strong",
          )}
        >
          <Plus className="size-4" />
          New split
        </Link>

        <div className="my-4 h-px bg-line" role="separator" />

        <NavItem href={routes.settings} icon={<Settings className="size-4" />} onNavigate={onNavigate}>
          Settings
        </NavItem>

        <div className="mt-auto pt-6 pb-3">
          <UserMenu user={user} onNavigate={onNavigate} />
        </div>
      </nav>
    </div>
  );
}
