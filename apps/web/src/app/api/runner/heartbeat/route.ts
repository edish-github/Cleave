import { NextResponse } from "next/server";
import { jsonError, readJson, requireRunner } from "@/server/http";
import { JobError, recordHeartbeat } from "@/server/jobs";
import { validateHeartbeat } from "@/server/schemas";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * POST /api/runner/heartbeat — {runner_version, bob_version, os, job_id} → 204.
 * With a job_id that is no longer running (cancelled in the browser, or finished): 409.
 */
export async function POST(request: Request) {
  const auth = await requireRunner(request);
  if ("response" in auth) return auth.response;
  const body = await readJson(request, 64 * 1024);
  if ("response" in body) return body.response;
  const beat = validateHeartbeat(body.data);
  if (!beat.ok) return jsonError("Heartbeat doesn't match /schemas/job.schema.json#/$defs/heartbeat.", 422, beat.errors);
  try {
    await recordHeartbeat(auth.runner, beat.value);
    return new NextResponse(null, { status: 204 });
  } catch (e) {
    if (e instanceof JobError) return jsonError(e.message, e.status);
    throw e;
  }
}
