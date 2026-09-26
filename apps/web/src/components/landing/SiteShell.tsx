import type { ReactNode } from "react";
import { Footer } from "./Footer";
import { MarketingNav } from "./MarketingNav";

export function SiteShell({ children }: { children: ReactNode }) {
  return (
    <>
      <MarketingNav />
      {children}
      <Footer />
    </>
  );
}
