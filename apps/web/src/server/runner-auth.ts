import "server-only";
import { createHash, randomBytes } from "node:crypto";
import { and, eq, isNull } from "drizzle-orm";
import { db, schema } from "./db/client";

const PREFIX = "clv_";

export interface NewToken {
  token: string;
  hash: string;
  prefix: string;
}

export function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

/** A new runner token. Only the hash is stored; the token is shown to the user once. */
export function newRunnerToken(): NewToken {
  const token = `${PREFIX}${randomBytes(24).toString("base64url")}`;
  return { token, hash: hashToken(token), prefix: token.slice(0, PREFIX.length + 6) };
}

/** Resolve `Authorization: Bearer clv_…` to an active runner, and mark it as seen. */
export async function runnerFromRequest(request: Request) {
  const header = request.headers.get("authorization") ?? "";
  const match = /^Bearer\s+(clv_[A-Za-z0-9_-]{20,})$/.exec(header.trim());
  if (!match) return null;
  const [runner] = await db()
    .select()
    .from(schema.runners)
    .where(and(eq(schema.runners.tokenHash, hashToken(match[1]!)), isNull(schema.runners.revokedAt)))
    .limit(1);
  if (!runner) return null;
  await db().update(schema.runners).set({ lastSeenAt: new Date() }).where(eq(schema.runners.id, runner.id));
  return runner;
}
