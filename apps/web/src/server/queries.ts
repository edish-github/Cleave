import "server-only";
import { notFound } from "next/navigation";
import { cache } from "react";
import { api } from "@/services";

/** Loads a stack for an app page, or renders the stack's not-found page. */
export async function requireStack(stackId: string) {
  const stack = await api.stacks.get(stackId);
  if (!stack) notFound();
  return stack;
}

/**
 * One clock reading per request, so every relative time on a page ("2 minutes
 * ago") is computed from the same instant.
 */
export const requestNow = cache(() => Date.now());
