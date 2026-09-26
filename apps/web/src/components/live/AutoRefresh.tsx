"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";

/**
 * Re-renders the current server page every `seconds` while `active`, so statuses that
 * change elsewhere (CI checks, a run on a runner) show up without a manual reload.
 * Pauses while the tab is hidden.
 */
export function AutoRefresh({ active, seconds = 20 }: { active: boolean; seconds?: number }) {
  const router = useRouter();
  useEffect(() => {
    if (!active) return;
    const id = window.setInterval(() => {
      if (document.visibilityState === "visible") router.refresh();
    }, seconds * 1000);
    return () => window.clearInterval(id);
  }, [active, seconds, router]);
  return null;
}
