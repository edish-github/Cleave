"use client";

import { useEffect } from "react";
import { ErrorState } from "@/components/ui/ErrorState";
import { PageContainer } from "./PageHeader";

/** Shared body for error.tsx boundaries: calm, contextual, with a retry. */
export function RouteError({ error, reset, message }: { error: Error & { digest?: string }; reset: () => void; message: string }) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <PageContainer>
      <ErrorState
        message={error.digest ? `${message} Reference ${error.digest}.` : message}
        onRetry={reset}
      />
    </PageContainer>
  );
}
