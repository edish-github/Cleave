import "server-only";
import { cookies } from "next/headers";
import type { Session, Visibility } from "@/lib/types";

/**
 * Per-visitor state for the sample workspace, kept in an httpOnly cookie so it
 * survives serverless deployments without a database. It only records what the
 * visitor did (started a run, published, resolved a review); the data itself lives
 * in ./data. The backend client will not use this file.
 */

export interface SampleState {
  /** Analysis runs started from New split: stackId -> start time (ms). */
  runs: Record<string, number>;
  /** Stacks published in this session: stackId -> time (ms). */
  published: Record<string, number>;
  /** Reviews resolved by merging layers: stackId -> time (ms). */
  resolved: Record<string, number>;
  visibility: Record<string, Visibility>;
  profileName: string | null;
}

const STATE_COOKIE = "cleave_sample";
export const SESSION_COOKIE = "cleave_session";
const MAX_AGE = 60 * 60 * 24 * 14;

const empty = (): SampleState => ({
  runs: {},
  published: {},
  resolved: {},
  visibility: {},
  profileName: null,
});

function decode<T>(raw: string | undefined): T | null {
  if (!raw) return null;
  try {
    return JSON.parse(Buffer.from(raw, "base64url").toString("utf8")) as T;
  } catch {
    return null;
  }
}

function encode(value: unknown): string {
  return Buffer.from(JSON.stringify(value), "utf8").toString("base64url");
}

export async function readState(): Promise<SampleState> {
  const jar = await cookies();
  return { ...empty(), ...(decode<Partial<SampleState>>(jar.get(STATE_COOKIE)?.value) ?? {}) };
}

/** Only callable from server actions and route handlers. */
export async function writeState(state: SampleState): Promise<void> {
  const jar = await cookies();
  jar.set(STATE_COOKIE, encode(state), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: MAX_AGE,
  });
}

export async function updateState(fn: (state: SampleState) => void): Promise<SampleState> {
  const state = await readState();
  fn(state);
  await writeState(state);
  return state;
}

export async function readSession(): Promise<Session | null> {
  const jar = await cookies();
  const session = decode<Session>(jar.get(SESSION_COOKIE)?.value);
  return session && session.email ? session : null;
}

export async function writeSession(session: Session): Promise<void> {
  const jar = await cookies();
  jar.set(SESSION_COOKIE, encode(session), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: MAX_AGE,
  });
}

export async function clearSession(): Promise<void> {
  const jar = await cookies();
  jar.delete(SESSION_COOKIE);
}
