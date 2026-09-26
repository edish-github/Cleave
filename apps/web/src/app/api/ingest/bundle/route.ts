import { gunzipSync } from "node:zlib";
import { NextResponse } from "next/server";
import { routes, site } from "@/lib/site";
import { databaseConfigured } from "@/server/db/client";
import { IngestError, ingestBundle } from "@/server/ingest";
import { runnerFromRequest } from "@/server/runner-auth";
import { validateBundle } from "@/server/schemas";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MAX_BYTES = 20 * 1024 * 1024;

function error(message: string, status: number, details?: string[]) {
  return NextResponse.json({ error: message, ...(details ? { details } : {}) }, { status });
}

/**
 * POST /api/ingest/bundle — `cleave push` lands here.
 * Auth: `Authorization: Bearer <runner token>`. Body: bundle JSON, optionally gzip-encoded.
 * Returns { stack_id, run_id, status, proof_url, stack_url }.
 */
export async function POST(request: Request) {
  if (!databaseConfigured) return error("This deployment has no database, so it can't store runs.", 503);

  const runner = await runnerFromRequest(request);
  if (!runner) return error("Missing or invalid runner token. Create one in Settings → Bob & runners.", 401);

  let raw = Buffer.from(await request.arrayBuffer());
  if (raw.byteLength > MAX_BYTES) return error("Bundle is larger than 20 MB.", 413);
  if ((request.headers.get("content-encoding") ?? "").includes("gzip") || (raw[0] === 0x1f && raw[1] === 0x8b)) {
    try {
      raw = gunzipSync(raw, { maxOutputLength: MAX_BYTES * 4 });
    } catch {
      return error("Body is marked gzip but couldn't be decompressed.", 400);
    }
  }

  let data: unknown;
  try {
    data = JSON.parse(raw.toString("utf8"));
  } catch {
    return error("Body is not valid JSON.", 400);
  }

  const result = validateBundle(data);
  if (!result.ok) return error("Bundle doesn't match /schemas/bundle.schema.json.", 422, result.errors);

  try {
    const stored = await ingestBundle(result.bundle, runner.userId, runner.id);
    return NextResponse.json(
      {
        stack_id: stored.stackId,
        run_id: stored.runId,
        status: stored.status,
        stack_url: `${site.url}${routes.stack(stored.stackId)}`,
        proof_url: `${site.url}${routes.proof(stored.stackId)}`,
      },
      { status: stored.created ? 201 : 200 },
    );
  } catch (e) {
    if (e instanceof IngestError) return error(e.message, e.status);
    console.error("ingest failed", e);
    return error("The run couldn't be stored.", 500);
  }
}
