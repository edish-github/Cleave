import type { ReactNode } from "react";
import { PageContainer, PageHeader } from "@/components/layout/PageHeader";
import { SettingsNav } from "@/components/settings/SettingsNav";

export default function SettingsLayout({ children }: { children: ReactNode }) {
  return (
    <PageContainer>
      <PageHeader title="Settings" description="Your profile, connections and how Cleave looks." />
      <div className="mt-8 grid grid-cols-1 gap-8 md:grid-cols-[180px_minmax(0,1fr)] md:gap-12">
        <SettingsNav />
        <div className="min-w-0">{children}</div>
      </div>
    </PageContainer>
  );
}
