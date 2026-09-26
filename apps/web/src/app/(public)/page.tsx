import { BobSection } from "@/components/landing/BobSection";
import { FinalCta } from "@/components/landing/FinalCta";
import { Hero } from "@/components/landing/Hero";
import { HowItWorks } from "@/components/landing/HowItWorks";
import { ProductShowcase } from "@/components/landing/ProductShowcase";
import { ProofStrip } from "@/components/landing/ProofStrip";
import { SiteShell } from "@/components/landing/SiteShell";
import { summarizeEval } from "@/lib/eval";
import { routes } from "@/lib/site";
import { getEvalResults, getFeaturedProof } from "@/services";

/** Re-render every minute so the featured proof follows the newest public stack. */
export const revalidate = 60;

export default async function LandingPage() {
  const [featured, evalRows] = await Promise.all([getFeaturedProof(), getEvalResults()]);
  const proof = featured
    ? {
        href: routes.proof(featured.id),
        label: `${featured.repoFullName}${featured.prNumber ? ` #${featured.prNumber}` : ""}: ${featured.title}`,
        sample: featured.sample,
      }
    : null;
  return (
    <SiteShell>
      <main id="main">
        <Hero proof={proof} />
        {featured ? <ProofStrip proof={featured} evaluation={evalRows.length ? summarizeEval(evalRows) : null} /> : null}
        <ProductShowcase />
        <HowItWorks />
        <BobSection />
        <FinalCta />
      </main>
    </SiteShell>
  );
}
