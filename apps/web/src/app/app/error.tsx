"use client";

import { RouteError } from "@/components/layout/RouteError";

export default function AppError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return <RouteError error={error} reset={reset} message="This page didn't load. Your data is safe; try again in a moment." />;
}
