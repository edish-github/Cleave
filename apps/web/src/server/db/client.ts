import "server-only";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema";

/**
 * One pooled client per server instance. On Vercel, point DATABASE_URL at Neon's
 * pooled connection string (…-pooler…/?sslmode=require).
 */
declare global {
  var __cleaveSql: ReturnType<typeof postgres> | undefined;
}

export const databaseConfigured = Boolean(process.env.DATABASE_URL);

function connect() {
  if (!process.env.DATABASE_URL) {
    throw new Error("DATABASE_URL is not set. The live workspace needs Postgres; the sample workspace doesn't.");
  }
  globalThis.__cleaveSql ??= postgres(process.env.DATABASE_URL, {
    max: process.env.VERCEL ? 1 : 5,
    prepare: false,
    idle_timeout: 20,
  });
  return globalThis.__cleaveSql;
}

let instance: ReturnType<typeof drizzle<typeof schema>> | null = null;

export function db() {
  instance ??= drizzle(connect(), { schema });
  return instance;
}

export type Db = ReturnType<typeof db>;
export { schema };
