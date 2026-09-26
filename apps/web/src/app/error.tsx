"use client";

import { useEffect } from "react";
import { ErrorState } from "@/components/ui/ErrorState";

export default function RootError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <main id="main" className="mx-auto max-w-[560px] px-5 py-24">
      <ErrorState message="This page didn't load. Try again in a moment." onRetry={reset} />
    </main>
  );
}
