import type { ReactNode } from "react";

/** Public pages: landing, docs, sign-in. Always light; the app's theme never applies here. */
export default function PublicLayout({ children }: { children: ReactNode }) {
  return <div className="min-h-dvh bg-canvas text-ink">{children}</div>;
}
