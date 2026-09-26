"use client";

import { CircleHelp, Menu, Search, X } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { Kbd } from "@/components/ui/Kbd";
import { LogoMark } from "@/components/ui/Logo";
import { Tooltip } from "@/components/ui/Tooltip";
import { routes } from "@/lib/site";
import type { SearchItem, User } from "@/lib/types";
import { CommandMenu, useCommandMenu } from "./CommandMenu";
import { SidebarContent } from "./SidebarContent";

export function AppFrame({
  user,
  searchItems,
  sample,
  children,
}: {
  user: User;
  searchItems: SearchItem[];
  sample: boolean;
  children: ReactNode;
}) {
  const { open: searchOpen, setOpen: setSearchOpen } = useCommandMenu();
  const [navOpen, setNavOpen] = useState(false);
  const pathname = usePathname();
  const drawerRef = useRef<HTMLDialogElement>(null);

  // Close the mobile drawer when the route changes (adjusting state during render,
  // as React recommends, instead of in an effect).
  const [lastPath, setLastPath] = useState(pathname);
  if (pathname !== lastPath) {
    setLastPath(pathname);
    setNavOpen(false);
  }

  useEffect(() => {
    const d = drawerRef.current;
    if (!d) return;
    if (navOpen && !d.open) d.showModal();
    if (!navOpen && d.open) d.close();
  }, [navOpen]);

  return (
    <div className="app-root min-h-dvh bg-canvas text-ink">
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:fixed focus:top-3 focus:left-3 focus:z-50 focus:rounded-full focus:bg-ink focus:px-4 focus:py-2 focus:text-canvas"
      >
        Skip to content
      </a>

      {/* Desktop sidebar */}
      <aside className="fixed inset-y-0 left-0 hidden w-[248px] px-2 lg:block" aria-label="Sidebar">
        <SidebarContent user={user} />
      </aside>

      {/* Mobile drawer */}
      <dialog
        ref={drawerRef}
        aria-label="Navigation"
        onClick={(e) => e.target === e.currentTarget && setNavOpen(false)}
        onCancel={(e) => {
          e.preventDefault();
          setNavOpen(false);
        }}
        className="app-root fixed inset-y-0 right-auto left-0 m-0 h-dvh max-h-dvh w-[84vw] max-w-[300px] border-r border-line bg-canvas p-0 px-2 text-ink open:animate-slide-in-left"
      >
        <button
          type="button"
          onClick={() => setNavOpen(false)}
          aria-label="Close navigation"
          className="absolute top-3 right-3 rounded-full p-2 text-ink-3 hover:bg-subtle hover:text-ink"
        >
          <X className="size-4" />
        </button>
        <SidebarContent user={user} onNavigate={() => setNavOpen(false)} />
      </dialog>

      <div className="flex min-h-dvh flex-col lg:pl-[248px]">
        <div className="flex min-h-dvh flex-1 flex-col bg-surface lg:my-2 lg:mr-2 lg:min-h-[calc(100dvh-1rem)] lg:rounded-2xl lg:border lg:border-line lg:shadow-card">
          <header className="sticky top-0 z-30 flex h-14 items-center gap-3 border-b border-line bg-surface/85 px-4 backdrop-blur-md sm:px-6 lg:rounded-t-2xl lg:px-8">
            <button
              type="button"
              onClick={() => setNavOpen(true)}
              aria-label="Open navigation"
              className="-ml-1.5 rounded-full p-2 text-ink-2 hover:bg-subtle lg:hidden"
            >
              <Menu className="size-5" />
            </button>
            <Link href={routes.app} aria-label="Cleave overview" className="lg:hidden">
              <LogoMark />
            </Link>

            <button
              type="button"
              onClick={() => setSearchOpen(true)}
              className="ml-auto flex h-9 items-center gap-2.5 rounded-full border border-line bg-canvas/60 px-3 text-[13px] text-ink-3 transition-colors hover:border-line-strong hover:text-ink-2 sm:w-72 lg:ml-0"
              aria-label="Search"
            >
              <Search className="size-4" />
              <span className="hidden truncate sm:inline">Search</span>
              <span className="ml-auto hidden items-center gap-1 sm:flex">
                <Kbd>⌘</Kbd>
                <Kbd>K</Kbd>
              </span>
            </button>

            <div className="flex items-center gap-1 lg:ml-auto">
              {sample ? (
                <Tooltip
                  side="bottom"
                  content="You're looking at sample data. GitHub and live runs connect once the Cleave backend is running."
                >
                  <span
                    tabIndex={0}
                    className="hidden h-7 items-center gap-1.5 rounded-full border border-accent-line bg-accent-soft px-2.5 text-[12px] font-medium text-accent-ink sm:inline-flex"
                  >
                    <span className="size-1.5 rounded-full bg-accent" />
                    Sample workspace
                  </span>
                </Tooltip>
              ) : null}
              <Link
                href={routes.bobDocs}
                className="inline-flex h-9 items-center gap-1.5 rounded-full px-3 text-[13px] text-ink-2 transition-colors hover:bg-subtle hover:text-ink"
              >
                <CircleHelp className="size-4" />
                <span className="hidden sm:inline">Help</span>
              </Link>
            </div>
          </header>

          <main id="main" className="flex-1">
            {children}
          </main>
        </div>
      </div>

      <CommandMenu items={searchItems} open={searchOpen} onClose={() => setSearchOpen(false)} />
    </div>
  );
}
