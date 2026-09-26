import { redirect } from "next/navigation";
import type { ReactNode } from "react";
import { AppFrame } from "@/components/layout/AppFrame";
import { routes } from "@/lib/site";
import { api } from "@/services";

export default async function AppLayout({ children }: { children: ReactNode }) {
  // proxy.ts already redirects signed-out visitors; this guards direct renders.
  const session = await api.session.get();
  if (!session) redirect(`${routes.login}?error=session`);

  const [user, searchItems, sample] = await Promise.all([api.user.get(), api.search.index(), api.isSample()]);

  return (
    <AppFrame user={user} searchItems={searchItems} sample={sample}>
      {children}
    </AppFrame>
  );
}
