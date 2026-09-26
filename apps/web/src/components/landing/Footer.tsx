import Link from "next/link";
import { Logo } from "@/components/ui/Logo";
import { routes, site } from "@/lib/site";

export function Footer() {
  return (
    <footer className="border-t border-line px-5 py-10 sm:px-8">
      <div className="mx-auto flex max-w-[1200px] flex-col gap-6 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-4">
          <Logo />
          <span className="text-[13px] text-ink-3">© {new Date().getFullYear()}</span>
        </div>
        <nav aria-label="Footer" className="flex flex-wrap gap-6 text-[13px] text-ink-3">
          <Link href={routes.bobDocs} className="hover:text-ink">
            Bob setup
          </Link>
          <Link href="/#how-it-works" className="hover:text-ink">
            How it works
          </Link>
          <Link href={routes.results} className="hover:text-ink">
            Results
          </Link>
          {site.githubUrl ? (
            <a href={site.githubUrl} className="hover:text-ink" target="_blank" rel="noreferrer">
              GitHub
            </a>
          ) : null}
          <Link href={routes.login} className="hover:text-ink">
            Log in
          </Link>
        </nav>
      </div>
    </footer>
  );
}
