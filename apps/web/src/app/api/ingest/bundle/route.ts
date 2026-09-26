import { NextResponse } from "next/server";
import { routes, site } from "@/lib/site";
import { jsonError as error, readJson, requireRunner } from "@/server/http";
import { IngestError, ingestBundle } from "@/server/ingest";
import { validateBundle } from "@/server/schemas";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MAX_BYTES = 20 * 1024 * 1024;

/**
 * POST /api/ingest/bundle — `cleave push` lands here.
 * Auth: `Authorization: Bearer <runner token>`. Body: bundle JSON, optionally gzip-encoded.
 * Returns { stack_id, run_id, status, proof_url, stack_url }.
 */
export async function POST(request: Request) {
  const auth = await requireRunner(request);
  if ("response" in auth) return auth.response;
  const { runner } = auth;

  const body = await readJson(request, MAX_BYTES);
  if ("response" in body) return body.response;

  const result = validateBundle(body.data);
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
