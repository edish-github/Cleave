import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import { ButtonLink } from "@/components/ui/Button";
import { Diamond } from "@/components/ui/Diamond";
import { Logo } from "@/components/ui/Logo";

export default function NotFound() {
  return (
    <div className="flex min-h-dvh flex-col bg-canvas">
      <header className="mx-auto flex h-16 w-full max-w-[1200px] items-center px-5 sm:px-8">
        <Link href="/" aria-label="Cleave home">
          <Logo />
        </Link>
      </header>
      <main className="flex flex-1 flex-col items-center justify-center px-6 pb-24 text-center">
        <Diamond className="size-8 text-accent" />
        <p className="mt-6 font-mono text-[13px] text-ink-3">404</p>
        <h1 className="mt-2 font-display text-[44px] leading-tight tracking-[-0.02em] text-ink">This page isn&rsquo;t here.</h1>
        <p className="mt-3 max-w-sm text-[15px] text-ink-3">
          The link may be old, or the stack may have been removed. Your stacks are still where you left them.
        </p>
        <div className="mt-8 flex flex-wrap justify-center gap-3">
          <ButtonLink href="/app" icon={<ArrowLeft className="size-4" />}>
            Back to Cleave
          </ButtonLink>
          <ButtonLink href="/" variant="secondary">
            Home
          </ButtonLink>
        </div>
      </main>
    </div>
  );
}
