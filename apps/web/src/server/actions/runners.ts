"use server";

import { and, eq, isNull } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { routes } from "@/lib/site";
import { liveSession } from "@/server/auth";
import { db, schema } from "@/server/db/client";
import { newRunnerToken } from "@/server/runner-auth";

export interface CreateTokenState {
  token: string | null;
  name: string | null;
  error: string | null;
}

export async function createRunnerTokenAction(_prev: CreateTokenState, formData: FormData): Promise<CreateTokenState> {
  const session = await liveSession();
  if (!session) return { token: null, name: null, error: "Sign in with GitHub to create runner tokens." };
  const name = String(formData.get("name") ?? "").trim().slice(0, 60) || "My machine";
  const { token, hash, prefix } = newRunnerToken();
  await db().insert(schema.runners).values({ userId: session.user.id, name, tokenHash: hash, tokenPrefix: prefix });
  revalidatePath(routes.settingsRunners);
  return { token, name, error: null };
}

export async function revokeRunnerAction(runnerId: string): Promise<{ error: string | null }> {
  const session = await liveSession();
  if (!session) return { error: "Sign in with GitHub first." };
  await db()
    .update(schema.runners)
    .set({ revokedAt: new Date() })
    .where(and(eq(schema.runners.id, runnerId), eq(schema.runners.userId, session.user.id), isNull(schema.runners.revokedAt)));
  revalidatePath(routes.settingsRunners);
  return { error: null };
}
