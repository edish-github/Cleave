import "server-only";
import type { CleaveClient } from "./types";
import { sampleClient } from "./sample/client";

/**
 * The single entry point for data. Pages and server actions import `api` and
 * never a concrete implementation.
 *
 * CLEAVE_DATA_SOURCE=sample (default) uses the built-in sample workspace.
 * When the backend exists, add `./http/client.ts` implementing CleaveClient and
 * return it here for CLEAVE_DATA_SOURCE=api. No page needs to change.
 */
function createClient(): CleaveClient {
  const source = process.env.CLEAVE_DATA_SOURCE ?? "sample";
  if (source !== "sample") {
    throw new Error(
      `CLEAVE_DATA_SOURCE=${source} is not implemented yet. Use "sample" until the backend client exists.`,
    );
  }
  return sampleClient;
}

export const api: CleaveClient = createClient();
export type { CleaveClient } from "./types";
