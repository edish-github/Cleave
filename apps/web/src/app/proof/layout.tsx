import Link from "next/link";
import type { ReactNode } from "react";
import { ButtonLink } from "@/components/ui/Button";
import { Logo } from "@/components/ui/Logo";
import { routes } from "@/lib/site";

/** Public, always-light shell for proof pages. No account needed to read one. */
export default function ProofLayout({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-dvh bg-canvas text-ink">
      <header className="border-b border-line bg-canvas/80 backdrop-blur-md">
        <div className="mx-auto flex h-14 max-w-[920px] items-center gap-3 px-5 sm:px-8">
          <Link href={routes.home} aria-label="Cleave home" className="rounded-lg">
            <Logo />
          </Link>
          <span className="hidden text-[13px] text-ink-3 sm:inline">Proof of split</span>
          <ButtonLink href={routes.home} variant="secondary" size="sm" className="ml-auto">
            What is Cleave?
          </ButtonLink>
        </div>
      </header>
      {children}
    </div>
  );
}
