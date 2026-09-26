import { ArrowRight } from "lucide-react";
import { ButtonLink } from "@/components/ui/Button";
import { routes } from "@/lib/site";
import { SpectrumBackdrop } from "./SpectrumBackdrop";
import { WorkflowVisual } from "./WorkflowVisual";

export function Hero({ proof }: { proof: { href: string; label: string; sample: boolean } | null }) {
  return (
    <section className="relative">
      <div className="relative -mt-16 overflow-hidden pt-24 pb-10 sm:pt-28">
        <SpectrumBackdrop />
        <div className="relative px-5 sm:px-8">
          <WorkflowVisual />
        </div>
      </div>

      <div className="mx-auto grid max-w-[1200px] gap-8 px-5 pt-6 pb-20 sm:px-8 md:grid-cols-[1.25fr_1fr] md:items-end md:gap-16 md:pb-28">
        <h1 className="font-display text-[44px] leading-[1.02] tracking-[-0.02em] text-balance text-ink sm:text-[60px] lg:text-[72px]">
          Large changes, reviewed in small, proven steps.
        </h1>
        <div className="md:pb-2">
          <p className="max-w-md text-[16px] leading-relaxed text-ink-2">
            Cleave turns an oversized pull request into a stack of small ones. Every layer passes your tests on its own,
            and the stack matches the original change byte for byte.
          </p>
          <div className="mt-7 flex flex-wrap items-center gap-3">
            <ButtonLink href={routes.login} size="lg">
              Get started
            </ButtonLink>
            <ButtonLink href="/#how-it-works" variant="ghost" size="lg" trailingIcon={<ArrowRight className="size-4" />}>
              See how it works
            </ButtonLink>
          </div>
          {proof ? (
            <a
              href={proof.href}
              className="group mt-6 inline-flex items-center gap-2 rounded-full border border-line bg-surface/70 py-1 pr-3 pl-1 text-[13px] text-ink-2 backdrop-blur transition-colors hover:border-line-strong hover:text-ink"
            >
              <span className="rounded-full bg-ok-soft px-2 py-0.5 text-[12px] font-medium text-ok">
                {proof.sample ? "Sample proof" : "Live proof"}
              </span>
              {proof.label}
              <ArrowRight className="size-3.5 transition-transform group-hover:translate-x-0.5" />
            </a>
          ) : null}
        </div>
      </div>
    </section>
  );
}
