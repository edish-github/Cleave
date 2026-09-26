"use client";

import { RouteError } from "@/components/layout/RouteError";

export default function StackError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return <RouteError error={error} reset={reset} message="We couldn't load this stack. Nothing about it has changed." />;
}
