import { ArrowRight } from "lucide-react";
import { ButtonLink } from "@/components/ui/Button";
import { routes } from "@/lib/site";
import { SpectrumBackdrop } from "./SpectrumBackdrop";
import { WorkflowVisual } from "./WorkflowVisual";

export function Hero() {
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
            <ButtonLink href={routes.signup} size="lg">
              Get started
            </ButtonLink>
            <ButtonLink href="/#how-it-works" variant="ghost" size="lg" trailingIcon={<ArrowRight className="size-4" />}>
              See how it works
            </ButtonLink>
          </div>
        </div>
      </div>
    </section>
  );
}
