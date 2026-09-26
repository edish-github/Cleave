import "server-only";
import { cache } from "react";
import type { Stack } from "@/lib/types";
import { databaseConfigured } from "@/server/db/client";
import { liveSession } from "@/server/auth";
import { createLiveClient, evalResults, featuredLiveStack, liveStackExists, loadStack, type EvalRow } from "./live/client";
import { sampleClient } from "./sample/client";
import type { CleaveClient } from "./types";

/**
 * The single entry point for data. Pages and server actions import `api` and never a
 * concrete implementation.
 *
 * Each request is served by one client:
 * - signed in with GitHub (and a database configured) -> the live workspace in Postgres
 * - otherwise -> the labelled sample workspace (cookie-backed, no backend needed)
 */
export const resolveClient = cache(async (): Promise<CleaveClient> => {
  const session = await liveSession();
  if (session) {
    return createLiveClient(
      session.user.id,
      { name: session.user.name ?? session.user.login, email: session.user.email ?? "" },
      session.accessToken ?? null,
    );
  }
  return sampleClient;
});

type Namespace = Exclude<keyof CleaveClient, "source">;

function delegate<K extends Namespace>(key: K): CleaveClient[K] {
  return new Proxy({} as CleaveClient[K], {
    get(_target, method: string) {
      return async (...args: unknown[]) => {
        const client = await resolveClient();
        const fn = (client[key] as unknown as Record<string, (...a: unknown[]) => unknown>)[method];
        if (typeof fn !== "function") throw new Error(`api.${String(key)}.${method} is not a function`);
        return fn(...args);
      };
    },
  });
}

export type Api = Omit<CleaveClient, "source"> & {
  /** True when this request is served by the sample workspace; pages label it. */
  isSample(): Promise<boolean>;
  /** True when the live session carries a GitHub token (false for the development login). */
  hasGitHub(): Promise<boolean>;
};

export const api: Api = {
  isSample: async () => (await resolveClient()).source === "sample",
  hasGitHub: async () => Boolean((await liveSession())?.accessToken),
  session: delegate("session"),
  user: delegate("user"),
  repositories: delegate("repositories"),
  stacks: delegate("stacks"),
  activity: delegate("activity"),
  search: delegate("search"),
};

/**
 * Public proof pages: any visitor, signed in or not. Live stacks are served when they're
 * public; the sample workspace's public stacks are served otherwise, and say so.
 */
export async function getPublicStack(stackId: string): Promise<{ stack: Stack; sample: boolean } | null> {
  if (databaseConfigured) {
    const live = await loadStack(stackId, null);
    if (live) return { stack: live, sample: false };
    // A private live stack is never replaced by a sample stack with the same id.
    if (await liveStackExists(stackId)) return null;
  }
  const sample = await sampleClient.stacks.getPublic(stackId);
  return sample ? { stack: sample, sample: true } : null;
}

export interface FeaturedProof {
  id: string;
  title: string;
  repoFullName: string;
  prNumber: number | null;
  sample: boolean;
}

/** The proof the landing page points to: the newest public live stack, else the sample one. */
export async function getFeaturedProof(): Promise<FeaturedProof | null> {
  if (databaseConfigured) {
    const live = await featuredLiveStack().catch(() => null);
    if (live) return { ...live, sample: false };
  }
  const sample = await sampleClient.stacks.getPublic("galaxium-travels-184").catch(() => null);
  return sample ? { id: sample.id, title: sample.title, repoFullName: sample.repoFullName, prNumber: sample.prNumber, sample: true } : null;
}

/** Rows for the public /results page. Empty until evaluation runs are pushed. */
export async function getEvalResults(): Promise<EvalRow[]> {
  if (!databaseConfigured) return [];
  return evalResults().catch(() => []);
}

export type { EvalRow } from "./live/client";
export type { CleaveClient } from "./types";
