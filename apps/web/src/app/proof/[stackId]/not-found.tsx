import { ButtonLink } from "@/components/ui/Button";
import { Diamond } from "@/components/ui/Diamond";
import { routes } from "@/lib/site";

export default function ProofNotFound() {
  return (
    <main id="main" className="mx-auto flex max-w-[520px] flex-col items-center px-5 py-28 text-center">
      <Diamond className="size-8 text-ink-3" />
      <h1 className="mt-6 font-display text-[40px] leading-tight text-ink">No public proof here.</h1>
      <p className="mt-3 text-[15px] text-ink-3">
        This stack doesn&apos;t exist, or its owner hasn&apos;t made the proof public.
      </p>
      <ButtonLink href={routes.home} variant="secondary" className="mt-8">
        About Cleave
      </ButtonLink>
    </main>
  );
}
