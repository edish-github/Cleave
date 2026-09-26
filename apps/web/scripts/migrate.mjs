/**
 * Apply ./drizzle migrations.
 *   npm run db:migrate                       needs DATABASE_URL
 *   node scripts/migrate.mjs --if-configured skip quietly without DATABASE_URL (Vercel build)
 */
import path from "node:path";
import { fileURLToPath } from "node:url";
import { drizzle } from "drizzle-orm/postgres-js";
import { migrate } from "drizzle-orm/postgres-js/migrator";
import postgres from "postgres";

const url = process.env.DATABASE_URL_UNPOOLED || process.env.DATABASE_URL;
if (!url) {
  if (process.argv.includes("--if-configured")) {
    console.log("DATABASE_URL not set; skipping migrations (sample workspace only).");
    process.exit(0);
  }
  console.error("Set DATABASE_URL to run migrations.");
  process.exit(1);
}

const here = path.dirname(fileURLToPath(import.meta.url));
const sql = postgres(url, { max: 1, prepare: false });
await migrate(drizzle(sql), { migrationsFolder: path.resolve(here, "../drizzle") });
await sql.end();
console.log("Migrations applied.");
