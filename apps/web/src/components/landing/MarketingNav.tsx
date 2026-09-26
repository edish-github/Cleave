import Link from "next/link";
import { ButtonLink } from "@/components/ui/Button";
import { Logo } from "@/components/ui/Logo";
import { routes, site } from "@/lib/site";

const links = [
  { href: "/#product", label: "Product" },
  { href: "/#how-it-works", label: "How it works" },
  { href: routes.results, label: "Results" },
  { href: routes.bobDocs, label: "Docs" },
];

export function MarketingNav() {
  return (
    <header className="relative z-20">
      <div className="mx-auto flex h-16 max-w-[1200px] items-center gap-8 px-5 sm:px-8">
        <Link href="/" aria-label="Cleave home" className="rounded-lg">
          <Logo />
        </Link>
        <nav aria-label="Primary" className="hidden items-center gap-7 text-[14px] text-ink-2 md:flex">
          {links.map((l) => (
            <Link key={l.href} href={l.href} className="transition-colors hover:text-ink">
              {l.label}
            </Link>
          ))}
          {site.githubUrl ? (
            <a href={site.githubUrl} className="transition-colors hover:text-ink" target="_blank" rel="noreferrer">
              GitHub
            </a>
          ) : null}
        </nav>
        <div className="ml-auto flex items-center gap-2">
          <Link href={routes.login} className="rounded-full px-3 py-2 text-[14px] font-medium text-ink hover:bg-subtle">
            Log in
          </Link>
          <ButtonLink href={routes.login} size="sm" className="h-9 px-4">
            Get started
          </ButtonLink>
        </div>
      </div>
    </header>
  );
}
