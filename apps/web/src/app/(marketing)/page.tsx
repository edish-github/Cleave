import { BobSection } from "@/components/landing/BobSection";
import { FinalCta } from "@/components/landing/FinalCta";
import { Hero } from "@/components/landing/Hero";
import { HowItWorks } from "@/components/landing/HowItWorks";
import { ProductShowcase } from "@/components/landing/ProductShowcase";

export default function LandingPage() {
  return (
    <main>
      <Hero />
      <ProductShowcase />
      <HowItWorks />
      <BobSection />
      <FinalCta />
    </main>
  );
}
