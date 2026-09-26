import { ButtonLink } from "@/components/ui/Button";
import { routes } from "@/lib/site";

export function FinalCta() {
  return (
    <section className="relative overflow-hidden px-5 py-28 text-center sm:px-8 md:py-36">
      <div
        aria-hidden="true"
        className="pointer-events-none absolute top-1/2 left-1/2 h-px w-[min(720px,80vw)] -translate-x-1/2 bg-gradient-to-r from-transparent via-[#e58bc7] to-transparent opacity-60"
      />
      <div aria-hidden="true" className="pointer-events-none absolute top-1/2 left-1/2 h-40 w-[520px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-[#b9b9f6] opacity-25 blur-[80px]" />
      <div className="relative mx-auto max-w-2xl rounded-3xl bg-canvas/80 px-6 py-10 backdrop-blur-sm">
        <h2 className="font-display text-[38px] leading-[1.06] tracking-[-0.02em] text-balance text-ink sm:text-[50px]">
          Start with your largest open pull request.
        </h2>
        <p className="mx-auto mt-4 max-w-md text-[15px] text-ink-3">
          Analyze it, check the proof, and publish a stack your reviewers can actually read.
        </p>
        <div className="mt-8 flex justify-center gap-3">
          <ButtonLink href={routes.signup} size="lg">
            Get started
          </ButtonLink>
          <ButtonLink href={routes.bobDocs} variant="secondary" size="lg">
            Read the Bob setup
          </ButtonLink>
        </div>
      </div>
    </section>
  );
}
