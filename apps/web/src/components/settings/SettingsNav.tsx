"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/cn";
import { routes } from "@/lib/site";

const items = [
  { href: routes.settings, label: "Profile" },
  { href: routes.settingsGithub, label: "GitHub" },
  { href: routes.settingsRunners, label: "Bob & runners" },
  { href: routes.settingsAppearance, label: "Appearance" },
];

export function SettingsNav() {
  const pathname = usePathname();
  return (
    <nav aria-label="Settings" className="scroll-thin -mx-1 flex gap-1 overflow-x-auto px-1 md:mx-0 md:flex-col md:px-0">
      {items.map((item) => {
        const active = pathname === item.href;
        return (
          <Link
            key={item.href}
            href={item.href}
            aria-current={active ? "page" : undefined}
            className={cn(
              "flex h-9 shrink-0 items-center rounded-xl px-3 text-[14px] transition-colors",
              active ? "bg-subtle font-medium text-ink" : "text-ink-3 hover:bg-subtle/60 hover:text-ink",
            )}
          >
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}
